import platform from '@/assets/landing/platform.webp';
import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_28, fontDisplay, fontMono, pagePad } from './clips';

const CARDS = [
  { bar: '#f59e0b', title: 'commonPages.landFeat1Title', body: 'commonPages.landFeat1Desc' },
  { bar: '#2563eb', title: 'commonPages.landFeat2Title', body: 'commonPages.landFeat2Desc' },
  { bar: '#10b981', title: 'commonPages.landFeat3Title', body: 'commonPages.landFeat3Desc' },
  { bar: '#8b5cf6', title: 'commonPages.landFeat4Title', body: 'commonPages.landFeat4Desc' },
  { bar: '#ef4444', title: 'commonPages.landFeat5Title', body: 'commonPages.landFeat5Desc' },
  { bar: '#ec4899', title: 'commonPages.landFeat6Title', body: 'commonPages.landFeat6Desc' },
  { bar: '#22d3ee', title: 'commonPages.landFeat7Title', body: 'commonPages.landFeat7Desc' },
  { bar: '#fb923c', title: 'commonPages.landFeat8Title', body: 'commonPages.landFeat8Desc' },
];

export default function FeatureGrid() {
  const { t } = useTranslation();

  return (
    <section id="features" className={`${pagePad} border-t border-white/[.08] bg-[#080d22] py-[clamp(64px,8vw,112px)]`}>
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <h2 className={`${fontDisplay} m-0 text-[clamp(48px,7vw,104px)] font-normal uppercase leading-[.9]`}>
          {t('commonPages.landOnePlatform')}
          <br />
          <span className="text-[#00d4ff]">{t('commonPages.landEveryFeature')}</span>
        </h2>
        <div className={`${fontMono} text-xs font-bold uppercase tracking-[.32em] text-[#4d8dff]`}>
          {t('commonPages.landEverything')}
        </div>
      </div>
      <img
        src={platform}
        alt={t('commonPages.landV2AltPlatform')}
        loading="lazy"
        decoding="async"
        className={`${CLIP_28} mb-8 block aspect-video w-full object-cover`}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-px border border-white/10 bg-white/10">
        {CARDS.map((card) => (
          <div key={card.title} className="bg-[#080d22] px-8 pb-10 pt-9 transition-colors hover:bg-[#0c1330]">
            <div aria-hidden="true" className="mb-6 h-1 w-7" style={{ background: card.bar }} />
            <h3 className={`${fontDisplay} mb-3 mt-0 text-[26px] font-normal uppercase tracking-[.02em]`}>
              {t(card.title)}
            </h3>
            <p className="m-0 text-base leading-[1.6] text-[#aab3c8]">{t(card.body)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
