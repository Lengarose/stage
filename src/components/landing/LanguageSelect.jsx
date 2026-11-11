import { useEffect, useId, useRef, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';
import { flagImageUrl } from '@/lib/flagImages';
import { useTranslation } from '@/hooks/useTranslation';
import { focusRing } from './clips';

const COUNTRY = {
  en: 'gb',
  fr: 'fr',
  nl: 'nl',
  es: 'es',
  pt: 'pt',
  it: 'it',
  de: 'de',
  zh: 'cn',
  ja: 'jp',
  ko: 'kr',
  ru: 'ru',
  ar: 'sa',
  pl: 'pl',
  tr: 'tr',
};

function Flag({ code }) {
  const src = flagImageUrl(COUNTRY[code] || code, 40);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width="20"
      height="14"
      decoding="async"
      className="h-3.5 w-5 shrink-0 object-cover"
    />
  );
}

export default function LanguageSelect() {
  const { language, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const current = SUPPORTED_LANGUAGES.find((item) => item.value === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (value) => {
    setLanguage(value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={`${focusRing} flex h-11 cursor-pointer items-center gap-2 border border-white/15 bg-[#080d22] px-2.5 text-[13px] font-semibold normal-case tracking-normal text-white`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${t('auth.chooseLanguage')}: ${current.nativeLabel}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag code={current.value} />
        <span className="sm:hidden">{current.value.toUpperCase()}</span>
        <span className="hidden sm:inline">{current.nativeLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true" className="shrink-0 opacity-70">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-label={t('auth.chooseLanguage')}
        hidden={!open}
        className="absolute left-0 z-50 mt-2 max-h-[min(20rem,70vh)] w-56 overflow-auto border border-white/15 bg-[#080d22] py-1 shadow-[0_16px_40px_rgba(0,0,0,.45)] sm:left-auto sm:right-0"
      >
        {SUPPORTED_LANGUAGES.map((item) => {
          const selected = item.value === current.value;
          return (
            <li key={item.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(item.value)}
                className={`${focusRing} flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold normal-case tracking-normal ${selected ? 'bg-white/10 text-[#00d4ff]' : 'text-white hover:bg-white/10'}`}
              >
                <Flag code={item.value} />
                <span>{item.nativeLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
