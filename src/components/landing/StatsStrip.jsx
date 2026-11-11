import { fontDisplay, fontMono } from './clips';

export default function StatsStrip({ stats }) {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] border-y border-white/[.08] bg-[#080d22]">
      {stats.map((stat, index) => {
        const last = index === stats.length - 1;
        return (
          <div
            key={`${stat.label}-${index}`}
            className={`py-9 ${index === 0 ? 'px-[clamp(20px,5vw,72px)]' : 'px-[clamp(20px,3vw,48px)]'} ${last ? '' : 'border-r border-white/[.08]'}`}
          >
            <div className={`${fontDisplay} whitespace-nowrap text-[clamp(34px,4.6vw,56px)] leading-none ${last ? 'text-[#00d4ff]' : ''}`}>
              {stat.value}
            </div>
            <div className={`${fontMono} mt-2.5 text-[11px] font-medium uppercase tracking-[.2em] text-[#7f8aa3]`}>
              {stat.label}
            </div>
          </div>
        );
      })}
    </section>
  );
}
