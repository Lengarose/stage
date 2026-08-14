export function wrapIndex(index, length) {
  if (!length || length < 1) return 0;
  return ((Number(index) % length) + length) % length;
}

export function visibleCarouselSlots(length, center, radius = 2) {
  if (!length || length < 1) return [];
  const r = length === 1 ? 0 : Math.min(radius, length === 2 ? 1 : radius);
  const slots = [];
  for (let offset = -r; offset <= r; offset += 1) {
    slots.push({
      index: wrapIndex(center + offset, length),
      offset: offset === 0 ? 0 : offset,
    });
  }
  return slots;
}

export function stepCarouselIndex(center, length, direction) {
  if (!length || length < 1) return 0;
  return wrapIndex(Number(center) + (direction < 0 ? -1 : 1), length);
}
