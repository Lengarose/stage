import logo from '@/assets/landing/logo-white.png';
import { useTranslation } from '@/hooks/useTranslation';
import { pagePad } from './clips';

export default function Footer({ tagline }) {
  const { t } = useTranslation();

  return (
    <footer className={`${pagePad} flex flex-wrap items-center justify-between gap-4 border-t border-white/[.08] py-7 text-[13px] font-medium text-[#7f8aa3]`}>
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="" className="h-[22px] w-auto" />
        <span>{t('commonPages.landV2FooterBrand')}</span>
      </div>
      <span>{tagline || t('commonPages.landV2FooterTagline')}</span>
    </footer>
  );
}
