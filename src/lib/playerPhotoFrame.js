export const PLAYER_PHOTO_FRAMES = [
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'parallelogram', label: 'Parallelogram' },
  { id: 'circle', label: 'Circle' },
];
export function playerPhotoFrame(value) {
  return PLAYER_PHOTO_FRAMES.some(frame => frame.id === value) ? value : 'rectangle';
}
export function playerPhotoFrameStyle(value) {
  const frame = playerPhotoFrame(value);
  return {
    borderRadius: frame === 'circle' ? '50%' : '0',
    clipPath: frame === 'parallelogram' ? 'polygon(12% 0,100% 0,88% 100%,0 100%)' : 'none',
  };
}
