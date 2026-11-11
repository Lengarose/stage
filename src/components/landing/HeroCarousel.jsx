import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import gamers from '@/assets/landing/gamers.webp';
import dribble from '@/assets/landing/dribble.webp';
import penalty from '@/assets/landing/penalty.webp';
import team from '@/assets/landing/team.webp';
import moments1 from '@/assets/landing/moments-1.webp';
import moments2 from '@/assets/landing/moments-2.webp';
import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_12, focusRing, fontDisplay, fontItalic, fontMono } from './clips';

const AUTOPLAY_MS = 4500;

export default function HeroCarousel({ onSignIn, eyebrow, description, leadImage }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const slides = [
    {
      src: leadImage?.src || gamers,
      alt: t('commonPages.landV2AltGamers'),
      position: leadImage?.position,
      zoom: leadImage?.zoom,
    },
    { src: dribble, alt: t('commonPages.landV2AltDribble') },
    { src: penalty, alt: t('commonPages.landV2AltPenalty') },
    { src: team, alt: t('commonPages.landV2AltTeam') },
    { src: moments1, alt: t('commonPages.landV2AltMoments1') },
    { src: moments2, alt: t('commonPages.landV2AltMoments2') },
  ];
  const count = slides.length;

  useEffect(() => {
    if (reduce || hovered || focused) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [reduce, hovered, focused, count]);

  const go = (next) => setIndex(((next % count) + count) % count);

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  };

  const primaryBtn = `${CLIP_12} ${focusRing} inline-flex cursor-pointer items-center justify-center border-0 bg-[#2563eb] px-[clamp(16px,2vw,30px)] py-[clamp(10px,1.25vw,18px)] text-sm font-bold uppercase tracking-[.14em] text-white shadow-[0_10px_40px_rgba(37,99,235,.45)] transition-colors hover:bg-[#3b76f6]`;
  const ghostBtn = `${CLIP_12} ${focusRing} inline-flex cursor-pointer items-center justify-center border-0 bg-white/10 px-[clamp(16px,2vw,30px)] py-[clamp(10px,1.25vw,18px)] text-sm font-bold uppercase tracking-[.14em] text-white transition-colors hover:bg-white/20`;

  return (
    <section
      id="top"
      aria-roledescription="carousel"
      aria-label={eyebrow}
      className="relative box-border flex aspect-auto min-h-[720px] flex-col justify-center overflow-hidden bg-[#06091a] px-[clamp(20px,5vw,72px)] pb-[clamp(96px,10vw,120px)] pt-[clamp(16px,4vw,72px)] lg:aspect-video lg:min-h-0 lg:pb-[clamp(56px,6vw,96px)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="absolute inset-0 flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: reduce ? 'none' : 'transform .7s cubic-bezier(.2,.7,.2,1)',
        }}
      >
        {slides.map((slide, slideIndex) => (
          <img
            key={slide.alt}
            src={slide.src}
            alt={slide.alt}
            decoding="async"
            loading={slideIndex === 0 ? 'eager' : 'lazy'}
            fetchPriority={slideIndex === 0 ? 'high' : undefined}
            className="h-full w-full shrink-0 grow-0 basis-full object-cover"
            style={slide.position || slide.zoom ? {
              objectPosition: slide.position || 'center',
              transform: slide.zoom ? `scale(${slide.zoom / 100})` : undefined,
            } : undefined}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#06091a_0%,rgba(6,9,26,.92)_28%,rgba(6,9,26,.55)_52%,rgba(6,9,26,0)_78%)]"
      />

      <div className="relative z-10 max-w-[640px]">
        <div className={`${fontMono} mb-[clamp(8px,1.6vw,24px)] max-w-full text-xs font-bold uppercase tracking-[.16em] text-[#4d8dff] sm:tracking-[.32em]`}>
          {eyebrow}
        </div>
        <h1 className={`${fontDisplay} m-0 text-[clamp(36px,9vw,160px)] font-normal uppercase leading-[.88] tracking-[-.01em]`}>
          {t('commonPages.landHeroYour')}
          <br />
          <span className={`${fontDisplay} ${fontItalic} text-[#00d4ff] [text-shadow:0_0_48px_rgba(0,212,255,.45)]`}>
            {t('commonPages.landHeroStage')}
          </span>
          <br />
          {t('commonPages.landHeroAwaits')}
        </h1>
        <p className="mb-[clamp(14px,2.2vw,36px)] mt-[clamp(12px,2vw,32px)] max-w-[520px] text-[clamp(13px,1.35vw,19px)] leading-[1.55] text-[#aab3c8] text-pretty">
          {description}
        </p>
        <div className="flex flex-wrap gap-3.5">
          <button type="button" onClick={onSignIn} className={primaryBtn}>
            {t('commonPages.landGetStarted')}
          </button>
          <button type="button" onClick={onSignIn} className={ghostBtn}>
            {t('commonPages.landV2SignIn')}
          </button>
        </div>
      </div>

      <div className="absolute bottom-[clamp(12px,1.8vw,28px)] left-[clamp(20px,5vw,72px)] right-[clamp(20px,5vw,72px)] z-20 flex items-center gap-2">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide.alt}
            type="button"
            aria-label={t('commonPages.landV2Dot', { n: slideIndex + 1 })}
            aria-current={slideIndex === index ? 'true' : undefined}
            onClick={() => go(slideIndex)}
            className={`${focusRing} landing-keep h-4 min-w-0 max-w-14 flex-1 cursor-pointer border-0 bg-clip-content px-0 py-1.5 ${slideIndex === index ? 'bg-[#00d4ff]' : 'bg-white/20'}`}
          />
        ))}
        <span className={`${fontMono} ml-4 shrink-0 text-[11px] font-medium tracking-[.2em] text-white`}>
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={t('commonPages.landV2Prev')}
            onClick={() => go(index - 1)}
            className={`${focusRing} ${fontDisplay} h-11 w-11 cursor-pointer border-0 bg-[rgba(6,9,26,.7)] p-0 text-[22px] font-normal text-white transition-colors hover:bg-[#2563eb]`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t('commonPages.landV2Next')}
            onClick={() => go(index + 1)}
            className={`${focusRing} ${fontDisplay} h-11 w-11 cursor-pointer border-0 bg-[rgba(6,9,26,.7)] p-0 text-[22px] font-normal text-white transition-colors hover:bg-[#2563eb]`}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
