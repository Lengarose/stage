import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_16, CLIP_28, focusRing, fontDisplay, fontMono, pagePad } from './clips';

function ContractCard({ onSignIn }) {
  const { t } = useTranslation();
  const facts = [
    ['commonPages.landV2Wage', 'commonPages.landV2WageValue'],
    ['commonPages.landV2Length', 'commonPages.landV2LengthValue'],
    ['commonPages.landV2Role', 'commonPages.landV2RoleValue'],
  ];

  return (
    <div className={`${CLIP_16} mt-8 max-w-[440px] bg-[rgba(16,185,129,.6)] p-px`}>
      <div className={`${CLIP_16} ${fontMono} bg-[#0a1130] px-6 py-[22px] text-xs font-medium tracking-[.12em]`}>
        <div className="flex items-center justify-between gap-3 uppercase text-[#10b981]">
          <span>{t('commonPages.landV2Contract')}</span>
          <span className="text-[#f59e0b]">{t('commonPages.landV2New')}</span>
        </div>
        <div className={`${fontDisplay} mb-4 mt-3.5 text-[30px] font-normal uppercase leading-none tracking-[.01em] text-white`}>
          {t('commonPages.landV2ClubName')}
        </div>
        <div className="grid grid-cols-3 gap-3 border-y border-white/[.12] py-3.5">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="uppercase text-[#7f8aa3]">{t(label)}</div>
              <div className="mt-1.5 text-[15px] uppercase text-white">{t(value)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onSignIn}
            className={`${fontMono} ${focusRing} cursor-pointer border-0 bg-[#10b981] px-[18px] py-[11px] text-xs font-bold uppercase tracking-[.14em] text-[#04130d] transition-colors hover:bg-[#34d399]`}
          >
            {t('commonPages.landV2Accept')}
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className={`${fontMono} ${focusRing} cursor-pointer border-0 bg-white/10 px-[18px] py-[11px] text-xs font-bold uppercase tracking-[.14em] text-white transition-colors hover:bg-white/20`}
          >
            {t('commonPages.landV2Negotiate')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeatureSection({
  id,
  number,
  kicker,
  title,
  text,
  image,
  alt,
  accent,
  reverse = false,
  aspect = '16/9',
  objectPosition,
  imageZoom,
  padBottom = false,
  contract = false,
  onSignIn,
}) {
  const zoom = Number(imageZoom);
  const frame = (
    <div className={`${CLIP_28} w-full min-w-0 overflow-hidden [flex:1.2_1_420px] ${aspect === '16/10' ? 'aspect-[16/10]' : 'aspect-video'}`}>
      <img
        src={image}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{
          objectPosition: objectPosition || 'center',
          transform: Number.isFinite(zoom) && zoom > 0 ? `scale(${zoom / 100})` : undefined,
        }}
      />
    </div>
  );

  const copy = (
    <div className="min-w-0 [flex:1_1_380px]">
      <div className={`${fontMono} flex items-center gap-3.5 text-xs font-bold uppercase tracking-[.3em]`} style={{ color: accent }}>
        <span className={`${fontDisplay} text-[15px] font-normal tracking-[.08em]`}>{number}</span>
        <span aria-hidden="true" className="h-px w-9" style={{ background: accent }} />
        {kicker}
      </div>
      <h2 className={`${fontDisplay} mb-[22px] mt-5 text-[clamp(40px,5vw,72px)] font-normal uppercase leading-[.95]`}>
        {title}
      </h2>
      <p className="m-0 max-w-[560px] text-lg leading-[1.6] text-[#aab3c8] text-pretty">{text}</p>
      {contract ? <ContractCard onSignIn={onSignIn} /> : null}
    </div>
  );

  return (
    <section
      id={id}
      className={`${pagePad} flex items-center gap-[clamp(32px,5vw,80px)] pt-[clamp(64px,8vw,120px)] ${reverse ? 'flex-wrap-reverse' : 'flex-wrap'} ${padBottom ? 'pb-[clamp(64px,8vw,120px)]' : ''}`}
    >
      {reverse ? <>{copy}{frame}</> : <>{frame}{copy}</>}
    </section>
  );
}
