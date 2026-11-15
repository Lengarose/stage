import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { lifestylePresentation } from '@/lib/lifestylePresentation';
import { categoryLabel, getAssetImage } from '@/lib/lifestyleItems';

export default function LifestyleStoreHero({ items, onExplore, presentation = lifestylePresentation() }) {
  // Use the actual catalogue artwork, prioritising hotels and properties.
  const catalogueSlides = [...items].filter(item => item.image_url).sort((a, b) => {
    const priority = item => /hotel|resort|penthouse|villa/i.test(item.name || '') ? 0 : ['houses', 'real_estate'].includes(item.category) ? 1 : 2;
    return priority(a) - priority(b);
  }).slice(0, 6);
  const slides = presentation.banner_slides.length ? presentation.banner_slides.map((slide, i) => ({ ...slide, id: `custom-${i}`, image_url: slide.url })) : catalogueSlides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const currentIndex = slides.length ? index % slides.length : 0;
  const current = slides[currentIndex];

  useEffect(() => {
    if (slides.length < 2 || paused || focused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % slides.length), presentation.banner_interval_seconds * 1000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, focused, presentation.banner_interval_seconds]);

  function move(step) { setIndex((currentIndex + step + slides.length) % slides.length); }

  return (
    <section className="ls-hero" aria-label="Lifestyle collections" onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="ls-hero-art" aria-hidden="true">
        {slides.map((item, i) => <img key={item.id} src={getAssetImage(item)} alt="" className={i === currentIndex ? 'is-visible' : ''} style={{ objectPosition: item.position || '50% 50%', transform: `scale(${Number(item.zoom || 100) / 100})` }} />)}
      </div>
      <div className="ls-hero-shade" />
      <div className="ls-hero-copy">
        <p className="ls-eyebrow">STAGE / LIFE BEYOND THE PITCH</p>
        <h1>{presentation.hero_title}<span>MAKE IT YOURS.</span></h1>
        <p>{presentation.hero_description}</p>
        <button type="button" className="ls-primary" onClick={() => onExplore('all')}>Explore the collection <ArrowUpRight size={18} /></button>
        <span className="ls-hero-note">Shop with STC · Your in-app currency</span>
      </div>
      {current?.name && <div className="ls-hero-feature">
        <span className="ls-eyebrow">IN THE COLLECTION / {categoryLabel(current.category)}</span>
        <button type="button" onClick={() => onExplore(current.category)}>{current.name}<ArrowUpRight size={22} /></button>
      </div>}
      {slides.length > 1 && <div className="ls-slide-controls" aria-label="Slideshow controls">
        <span>{String(currentIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        <button type="button" aria-label="Previous lifestyle image" onClick={() => move(-1)}><ChevronLeft size={18}/></button>
        <button type="button" aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} onClick={() => setPaused(!paused)}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button>
        <button type="button" aria-label="Next lifestyle image" onClick={() => move(1)}><ChevronRight size={18}/></button>
      </div>}
    </section>
  );
}
