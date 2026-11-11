import { useEffect, useState } from 'react';
import logo from '@/assets/landing/logo-white.png';
import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_12, focusRing, fontDisplay, fontItalic } from './clips';
import LanguageSelect from './LanguageSelect';

const LINKS = [
  ['#gost', 'commonPages.landV2NavGost'],
  ['#compete', 'commonPages.landV2NavCompete'],
  ['#manage', 'commonPages.landV2NavManage'],
  ['#grow', 'commonPages.landV2NavGrow'],
  ['#features', 'commonPages.landV2NavFeatures'],
  ['#how', 'commonPages.landHowItWorks'],
];

export default function Nav({ onSignIn }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass = `${focusRing} text-[13px] font-semibold uppercase tracking-[.1em] text-[#aab3c8] no-underline hover:text-white`;
  const mobileLinkClass = `${focusRing} block w-full border-b border-white/[.07] px-5 py-4 text-left text-[15px] font-semibold uppercase tracking-[.1em] text-white no-underline hover:bg-white/[.06]`;

  return (
    <header className="border-b border-white/[.07]">
      <div className="flex items-center justify-between gap-3 px-[clamp(20px,5vw,72px)] py-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className={`${focusRing} inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 bg-transparent lg:hidden`}
            aria-expanded={open}
            aria-controls="landing-nav-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? t('commonPages.landV2CloseMenu') : t('commonPages.landV2OpenMenu')}</span>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
              <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <a href="#top" className={`${focusRing} flex min-w-0 items-center gap-3 text-white no-underline`}>
            <img src={logo} alt="Stage" className="h-[30px] w-auto" />
            <span className={`${fontDisplay} ${fontItalic} hidden text-[22px] font-normal tracking-[.08em] sm:inline`}>STAGE</span>
          </a>
        </div>

        <nav className="hidden flex-wrap items-center justify-center gap-x-[clamp(12px,1.8vw,32px)] gap-y-2 whitespace-nowrap lg:flex" aria-label="Stage">
          {LINKS.map(([href, key]) => (
            <a key={href} href={href} className={linkClass}>
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelect />
          <button
            type="button"
            onClick={onSignIn}
            className={`${CLIP_12} ${focusRing} cursor-pointer whitespace-nowrap border-0 bg-[#2563eb] px-3.5 py-2.5 text-xs font-bold uppercase tracking-[.08em] text-white transition-colors hover:bg-[#3b76f6] sm:px-[22px] sm:py-3 sm:text-[13px] sm:tracking-[.12em]`}
          >
            {t('commonPages.landV2SignIn')}
          </button>
        </div>
      </div>

      <div id="landing-nav-menu" className={open ? 'border-t border-white/[.07] lg:hidden' : 'hidden'}>
        <nav aria-label="Stage" className="flex w-full max-w-xs flex-col">
          {LINKS.map(([href, key]) => (
            <a key={href} href={href} className={mobileLinkClass} onClick={() => setOpen(false)}>
              {t(key)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
