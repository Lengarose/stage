import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_16, fontDisplay, fontItalic, fontMono, pagePad } from './clips';

const TIERS = [
  { color: '#00d4ff', tier: 'commonPages.landV2Tier1', name: 'commonPages.landV2League1' },
  { color: '#facc15', tier: 'commonPages.landV2Tier2', name: 'commonPages.landV2League2' },
  { color: '#22c55e', tier: 'commonPages.landV2Tier3', name: 'commonPages.landV2League3' },
];

function TierCard({ color, tier, name }) {
  return (
    <div className={`${CLIP_16} h-full p-px`} style={{ background: color }}>
      <div className={`${CLIP_16} box-border h-full bg-[#0a1130] px-7 pb-8 pt-7`}>
        <div className={`${fontMono} flex items-center gap-2.5 text-xs font-bold uppercase tracking-[.3em]`} style={{ color }}>
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
          {tier}
        </div>
        <div className={`${fontDisplay} mt-3.5 text-[clamp(30px,3.2vw,44px)] font-normal uppercase leading-none`}>
          {name}
        </div>
      </div>
    </div>
  );
}

export default function TierCards() {
  const { t } = useTranslation();

  return (
    <section id="gost" className={`${pagePad} pt-[clamp(64px,8vw,120px)]`}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-16 gap-y-6">
        <div className="min-w-0 flex-[1_1_380px]">
          <div className={`${fontMono} mb-[18px] text-xs font-bold uppercase tracking-[.32em] text-[#00d4ff]`}>
            {t('commonPages.landV2GostKicker')}
          </div>
          <h2 className={`${fontDisplay} ${fontItalic} m-0 text-[clamp(64px,10vw,160px)] font-normal uppercase leading-[.88]`}>
            GOST
          </h2>
        </div>
        <p className="m-0 min-w-0 flex-[0_1_480px] text-lg leading-[1.6] text-[#aab3c8] text-pretty">
          {t('commonPages.landV2GostBody')}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {TIERS.map((tier) => (
          <TierCard key={tier.tier} color={tier.color} tier={t(tier.tier)} name={t(tier.name)} />
        ))}
      </div>
    </section>
  );
}
