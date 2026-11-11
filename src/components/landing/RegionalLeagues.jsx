import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { CLIP_12, CLIP_28, focusRing, fontDisplay, fontMono, pagePad } from './clips';

export default function RegionalLeagues({ onSignIn }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const label = t('commonPages.landV2RegionCta');
  const className = `${CLIP_12} ${focusRing} inline-block whitespace-normal px-7 py-4 text-center text-sm font-bold uppercase tracking-[.14em] text-white no-underline transition-colors sm:whitespace-nowrap bg-[#2563eb] hover:bg-[#3b76f6]`;

  return (
    <section id="leagues" className={`${pagePad} pt-[clamp(40px,5vw,72px)]`}>
      <div className={`${CLIP_28} bg-[rgba(77,141,255,.55)] p-px`}>
        <div className={`${CLIP_28} flex flex-wrap items-center justify-between gap-x-16 gap-y-7 bg-[#080d22] p-[clamp(28px,4vw,56px)]`}>
          <div className="min-w-0 flex-[1_1_340px]">
            <div className={`${fontMono} mb-[18px] text-xs font-bold uppercase tracking-[.32em] text-[#4d8dff]`}>
              {t('commonPages.landV2RegionKicker')}
            </div>
            <h2 className={`${fontDisplay} m-0 text-[clamp(44px,6vw,88px)] font-normal uppercase leading-[.92]`}>
              {t('commonPages.landV2RegionTitle')}
            </h2>
          </div>
          <div className="min-w-0 flex-[0_1_460px]">
            <p className="mb-6 mt-0 text-lg leading-[1.6] text-[#aab3c8] text-pretty">
              {t('commonPages.landV2RegionBody')}
            </p>
            {user ? (
              <Link to="/leagues" className={className}>{label}</Link>
            ) : (
              <button type="button" onClick={onSignIn} className={className}>{label}</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
