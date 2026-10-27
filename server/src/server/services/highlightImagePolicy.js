function imageExtension(buffer) {
  if(buffer.length>=45&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.readUInt32BE(8)===13&&buffer.subarray(12,16).toString()==='IHDR'&&buffer.readUInt32BE(16)>0&&buffer.readUInt32BE(20)>0&&buffer.subarray(-8,-4).toString()==='IEND')return '.png';
  if(buffer.length>=20&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255&&buffer[buffer.length-2]===255&&buffer[buffer.length-1]===217)return '.jpg';
  if(buffer.length>=24&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.readUInt32LE(4)+8===buffer.length&&buffer.subarray(8,12).toString()==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(buffer.subarray(12,16).toString()))return '.webp';
  return null;
}
module.exports={imageExtension};
