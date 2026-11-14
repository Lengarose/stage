export const TRANSFER_ROOM_DEFAULTS = {
  hero_title: 'Transfer Room',
  hero_description: 'Discover free agents, explore players in the final 14 days of their contracts, and find the right signing for your club. Review a profile, compare performances and start a conversation with an offer.',
  accent: 'blue',
  default_view: 'cards',
  default_sort: 'recent',
  banner_interval_seconds: 6,
};
export const TRANSFER_ROOM_ACCENTS = { blue: '#4d8dff', cyan: '#00d4ff', gold: '#f5c542' };
const list = value => { try { const result = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(result) ? result : []; } catch { return []; } };
const imageUrl = value => typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value)) ? value : '';
export function transferRoomPresentation(config = {}) {
  const slides = list(config.banner_slides).slice(0,6).map(s => ({ url: imageUrl(s?.url), position: /^\d{1,3}% \d{1,3}%$/.test(s?.position) ? s.position : '50% 50%', zoom: Math.min(500, Math.max(100, Number(s?.zoom) || 100)) })).filter(s => s.url);
  if (!slides.length && imageUrl(config.background_url)) slides.push({ url: config.background_url, position: config.background_position || '50% 50%', zoom: Math.min(500, Math.max(100, Number(config.background_zoom) || 100)) });
  return {
    ...TRANSFER_ROOM_DEFAULTS,
    hero_title: String(config.hero_title || TRANSFER_ROOM_DEFAULTS.hero_title).slice(0,80),
    hero_description: String(config.hero_description || TRANSFER_ROOM_DEFAULTS.hero_description).slice(0,450),
    accent: Object.hasOwn(TRANSFER_ROOM_ACCENTS,config.accent) ? config.accent : 'blue',
    default_view: config.default_view === 'list' ? 'list' : 'cards',
    default_sort: ['recent','name','form'].includes(config.default_sort) ? config.default_sort : 'recent',
    banner_interval_seconds: Math.min(30,Math.max(3,Number(config.banner_interval_seconds) || 6)),
    banner_slides: slides,
  };
}
