export default function CompetitionTextTabs({ items, value, onChange, label = 'Competition sections' }) {
  return <nav aria-label={label} className="competition-text-tabs flex flex-wrap items-center gap-x-6 gap-y-1 py-3">{items.map(item => <button type="button" key={item.value} aria-current={value === item.value ? 'page' : undefined} onClick={() => onChange(item.value)} className={value === item.value ? 'font-bold' : 'font-medium'}>{item.label}</button>)}</nav>;
}
