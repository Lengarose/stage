'use strict';
// User-approved deterministic extraction of the supplied white-on-blue mark.
// No redraw: preserves the original shape and its antialiased edges.
const fs = require('node:fs');
const zlib = require('node:zlib');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: node extract-plus-logo.cjs input.png output.png');
const bytes = fs.readFileSync(input);
if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('PNG input required');
let width, height, channels;
const compressed = [];
for (let offset = 8; offset < bytes.length;) {
  const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, offset + 8 + length);
  if (type === 'IHDR') {
    width = data.readUInt32BE(0); height = data.readUInt32BE(4);
    if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0) throw Error('8-bit non-interlaced RGB/RGBA required');
    channels = data[9] === 6 ? 4 : 3;
  }
  if (type === 'IDAT') compressed.push(data);
  offset += length + 12;
}
const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * channels, pixels = Buffer.alloc(height * stride);
const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  if (filter > 4) throw Error('Invalid PNG filter');
  for (let x = 0; x < stride; x++) {
    const left = x >= channels ? pixels[y * stride + x - channels] : 0, up = y ? pixels[(y - 1) * stride + x] : 0, corner = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
    const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
    pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
  }
}
const rgba = Buffer.alloc(width * height * 4);
let minX = width, minY = height, maxX = 0, maxY = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const i = y * stride + x * channels, target = (y * width + x) * 4;
  // Blue background has very little red. The foreground is white; interpolate
  // its coverage to retain smooth edges, then remove blue colour contamination.
  const coverage = Math.max(0, Math.min(1, (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) - 70) / 185));
  const alpha = Math.round(coverage * (channels === 4 ? pixels[i + 3] : 255));
  rgba[target] = rgba[target + 1] = rgba[target + 2] = 255; rgba[target + 3] = alpha;
  if (alpha > 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
}
if (minX > maxX || minY > maxY) throw Error('No white artwork found');
minX = Math.max(0, minX - 2); minY = Math.max(0, minY - 2); maxX = Math.min(width - 1, maxX + 2); maxY = Math.min(height - 1, maxY + 2);
const outWidth = maxX - minX + 1, outHeight = maxY - minY + 1, scanlines = Buffer.alloc((outWidth * 4 + 1) * outHeight);
for (let y = 0; y < outHeight; y++) rgba.copy(scanlines, y * (outWidth * 4 + 1) + 1, ((y + minY) * width + minX) * 4, ((y + minY) * width + maxX + 1) * 4);
function crc32(data) { let crc = 0xffffffff; for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const tag = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([tag, data]))); return Buffer.concat([length, tag, data, crc]); }
const header = Buffer.alloc(13); header.writeUInt32BE(outWidth); header.writeUInt32BE(outHeight, 4); header[8] = 8; header[9] = 6;
fs.writeFileSync(output, Buffer.concat([bytes.subarray(0, 8), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]));
console.log(JSON.stringify({ output, width: outWidth, height: outHeight, format: 'white RGBA PNG', originalGeometryPreserved: true }));
