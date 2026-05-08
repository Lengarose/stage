export const LIFESTYLE_CATEGORIES = [
  { id: 'houses',           label: 'Houses & Apts',   emoji: '🏠' },
  { id: 'cars',             label: 'Cars',             emoji: '🚗' },
  { id: 'watches',          label: 'Watches',          emoji: '⌚' },
  { id: 'fashion',          label: 'Fashion',          emoji: '👔' },
  { id: 'vip_experiences',  label: 'VIP',              emoji: '🌟' },
  { id: 'personal_services',label: 'Services',         emoji: '💼' },
  // Legacy category IDs kept for backward compat
  { id: 'real_estate',      label: 'Houses & Apts',   emoji: '🏠', hidden: true },
  { id: 'vehicle',          label: 'Cars',             emoji: '🚗', hidden: true },
  { id: 'clothing',         label: 'Fashion',          emoji: '👔', hidden: true },
  { id: 'extras',           label: 'Extras',           emoji: '✨', hidden: true },
  { id: 'lifestyle',        label: 'Services',         emoji: '💼', hidden: true },
  { id: 'event',            label: 'VIP',              emoji: '🌟', hidden: true },
  { id: 'charity',          label: 'Charity',          emoji: '💚', hidden: true },
];

// Maps any category ID to its display group
export const CATEGORY_DISPLAY_MAP = {
  real_estate: 'houses',
  vehicle: 'cars',
  clothing: 'fashion',
  extras: 'watches',
  lifestyle: 'personal_services',
  event: 'vip_experiences',
  charity: 'personal_services',
};

export function resolveCategory(raw) {
  return CATEGORY_DISPLAY_MAP[raw] || raw || 'fashion';
}

export function categoryLabel(raw) {
  const resolved = resolveCategory(raw);
  const cat = LIFESTYLE_CATEGORIES.find(c => c.id === resolved || c.id === raw);
  return cat?.label || raw || 'Other';
}

export function categoryEmoji(raw) {
  const resolved = resolveCategory(raw);
  const cat = LIFESTYLE_CATEGORIES.find(c => c.id === resolved || c.id === raw);
  return cat?.emoji || '✨';
}

export const LIFESTYLE_TIER_STYLES = {
  standard:  { label: 'Standard',  color: 'text-slate-300',   bg: 'bg-white/5 border-white/10',         badge: 'bg-slate-700/80 text-slate-200' },
  starter:   { label: 'Starter',   color: 'text-slate-300',   bg: 'bg-white/5 border-white/10',         badge: 'bg-slate-700/80 text-slate-200' },
  mid:       { label: 'Mid',       color: 'text-blue-400',    bg: 'bg-blue-500/5 border-blue-500/15',   badge: 'bg-blue-600/70 text-blue-100' },
  premium:   { label: 'Premium',   color: 'text-violet-400',  bg: 'bg-violet-500/5 border-violet-500/15',badge: 'bg-violet-600/70 text-violet-100' },
  luxury:    { label: 'Luxury',    color: 'text-amber-400',   bg: 'bg-amber-500/5 border-amber-500/15', badge: 'bg-amber-600/70 text-amber-100' },
  elite:     { label: 'Elite',     color: 'text-orange-400',  bg: 'bg-orange-500/5 border-orange-500/15',badge: 'bg-orange-600/70 text-orange-100' },
  legendary: { label: 'Legendary', color: 'text-rose-400',    bg: 'bg-rose-500/5 border-rose-500/15',   badge: 'bg-rose-600/70 text-rose-100' },
};

export const ASSET_FALLBACK_IMAGES = {
  houses:           'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80',
  real_estate:      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
  cars:             'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80',
  vehicle:          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80',
  watches:          'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&q=80',
  extras:           'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&q=80',
  fashion:          'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80',
  clothing:         'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80',
  vip_experiences:  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
  event:            'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=600&q=80',
  personal_services:'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80',
  lifestyle:        'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=600&q=80',
  charity:          'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80',
};

export function getAssetImage(item) {
  if (item?.image_url) return item.image_url;
  const cat = item?.category || 'fashion';
  return ASSET_FALLBACK_IMAGES[cat] || ASSET_FALLBACK_IMAGES.fashion;
}

export function formatSTC(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return v.toLocaleString();
}
