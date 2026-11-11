import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_12, focusRing, fontDisplay, fontItalic, fontMono, pagePad } from './clips';

export default function CtaBand({ onSignIn }) {
  const { t } = useTranslation();

  return (
    <section
      id="join"
      className={`${pagePad} flex flex-wrap items-center justify-between gap-10 border-t border-white/[.08] bg-[radial-gradient(ellipse_80%_120%_at_80%_50%,#0f3a8a_0%,#0a1a44_55%,#06091a_100%)] py-[clamp(64px,8vw,120px)]`}
    >
      <div className="min-w-0 flex-[1_1_440px]">
        <div className={`${fontMono} mb-[18px] text-xs font-bold uppercase tracking-[.32em] text-[#5cc8ff]`}>
          {t('commonPages.landJoinCommunity')}
        </div>
        <h2 className={`${fontDisplay} m-0 text-[clamp(64px,10vw,160px)] font-normal uppercase leading-[.88]`}>
          {t('commonPages.landReadyTo')}{' '}
          <span className={`${fontDisplay} ${fontItalic} text-[#00d4ff]`}>{t('commonPages.landV2CompeteWord')}</span>
        </h2>
      </div>
      <div className="min-w-0 flex-[0_1_420px]">
        <p className="mb-7 mt-0 text-[19px] leading-[1.55] text-[#c5cde0] text-pretty">
          {t('commonPages.landCtaDesc')}
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className={`${CLIP_12} ${focusRing} inline-block cursor-pointer border-0 bg-[#2563eb] px-9 py-5 text-[15px] font-bold uppercase tracking-[.14em] text-white shadow-[0_10px_40px_rgba(37,99,235,.5)] transition-colors hover:bg-[#3b76f6]`}
        >
          {t('commonPages.landStartPlaying')}
        </button>
      </div>
    </section>
  );
}
