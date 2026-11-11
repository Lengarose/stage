import { useTranslation } from '@/hooks/useTranslation';
import { fontDisplay, fontItalic, fontMono, pagePad } from './clips';

const STEPS = [
  { num: '01', title: 'commonPages.landStep1Title', body: 'commonPages.landStep1Desc', filled: false },
  { num: '02', title: 'commonPages.landStep2Title', body: 'commonPages.landStep2Desc', filled: false },
  { num: '03', title: 'commonPages.landStep3Title', body: 'commonPages.landStep3Desc', filled: true },
];

export default function Steps() {
  const { t } = useTranslation();

  return (
    <section id="how" className={`${pagePad} py-[clamp(64px,8vw,112px)]`}>
      <div className={`${fontMono} mb-[18px] text-xs font-bold uppercase tracking-[.32em] text-[#4d8dff]`}>
        {t('commonPages.landGetStartedMinutes')}
      </div>
      <h2 className={`${fontDisplay} mb-14 mt-0 text-[clamp(48px,7vw,104px)] font-normal uppercase leading-[.9]`}>
        {t('commonPages.landHowItWorks')}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-10">
        {STEPS.map((step) => (
          <div key={step.num} className={`border-t-2 pt-6 ${step.filled ? 'border-[#00d4ff]' : 'border-[#2563eb]'}`}>
            <div
              className={`${fontDisplay} ${fontItalic} text-[96px] font-normal leading-none ${step.filled ? 'text-[#00d4ff] [text-shadow:0_0_28px_rgba(0,212,255,.6)]' : 'text-transparent [-webkit-text-stroke:1.5px_#4d8dff] [text-shadow:0_0_24px_rgba(77,141,255,.5)]'}`}
            >
              {step.num}
            </div>
            <h3 className={`${fontDisplay} mb-3 mt-5 text-[28px] font-normal uppercase leading-[1.1]`}>
              <span className={`${fontMono} mb-2 block text-[11px] font-medium tracking-[.14em] text-[#4d8dff]`}>
                {t('commonPages.landV2Level', { n: step.num })}
              </span>
              {t(step.title)}
            </h3>
            <p className="m-0 text-base leading-[1.6] text-[#aab3c8]">{t(step.body)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
