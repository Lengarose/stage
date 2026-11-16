import StageTimesHero from '@/components/news/StageTimesHero';
import '@/pages/stageTimes.css';
import { useEffect, useState } from 'react';
import { ArrowDownRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { stageClient } from '@/api/stageClient';
import { competitionPagePresentation, COMPETITION_PAGE_ACCENTS } from '@/lib/competitionPagePresentation';
import team from '@/assets/landing/team.webp';
import gamers from '@/assets/landing/gamers.webp';
import dribble from '@/assets/landing/dribble.webp';
import penalty from '@/assets/landing/penalty.webp';
import moments1 from '@/assets/landing/moments-1.webp';
import moments2 from '@/assets/landing/moments-2.webp';
const artwork = [team, gamers, dribble, penalty, moments1, moments2].map(url => ({ url, position: '50% 50%', zoom: 100 }));
export default function CompetitionHubHero({ kind, children }) {
  const [presentation, setPresentation] = useState(() => competitionPagePresentation(kind));
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    let active = true;
    stageClient.entities.CompetitionPageConfig.filter({ key: kind }, '-updated_date', 1)
      .then(rows => { if (active) { setPresentation(competitionPagePresentation(kind, rows[0] || {})); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [kind]);
  const slides = presentation.banner_slides.length ? presentation.banner_slides : artwork;
  const current = index % slides.length;
  useEffect(() => {
    if (kind === 'regional' || paused || focused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % slides.length), presentation.banner_interval_seconds * 1000);
    return () => window.clearInterval(timer);
  }, [kind, paused, focused, slides.length, presentation.banner_interval_seconds]);
  if (kind === 'regional') return <section className="ch-regional-news" style={{ '--ch-accent': COMPETITION_PAGE_ACCENTS[presentation.accent] }}>
    <StageTimesHero slides={slides} interval={presentation.banner_interval_seconds} title={<>REGIONAL<br/><span className="ch-title-word">LEAGUES<span className="ch-title-dot" aria-hidden="true">.</span></span></>} kicker="STAGE / THE REGIONAL SYSTEM" description={presentation.hero_description} actionLabel="Browse the leagues" actionHref="#competition-directory" editionLabel="THE REGIONAL SYSTEM" editionText="YOUR REGION. YOUR SEASON." label="Regional Leagues introduction" />
    {error && <p role="status" className="px-6 py-2 text-xs text-muted-foreground">Custom presentation unavailable. Showing STAGE artwork.</p>}
  </section>;
  return <section className={`ch-hero ${kind === 'gost' ? 'ch-gost-stage' : 'ch-regional-feature'}`} style={{ '--ch-accent': COMPETITION_PAGE_ACCENTS[presentation.accent] }} aria-label={`${kind === 'gost' ? 'GOST' : 'Regional Leagues'} introduction`} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="ch-art" aria-hidden="true">{slides.map((slide, i) => <img key={`${i}:${slide.url}`} src={slide.url} alt="" className={i === current ? 'is-current' : ''} style={{ objectPosition: slide.position, transform: `scale(${slide.zoom / 100})` }} />)}</div>
    <div className="ch-shade" />
    <div className="ch-copy"><p className="ch-kicker">{kind === 'gost' ? 'GLOBAL OFFICIAL STAGE TOURNAMENTS' : 'STAGE / THE REGIONAL SYSTEM'}</p><h1>{kind === 'gost' ? 'GOST' : <>REGIONAL <span className="ch-title-word">LEAGUES<span className="ch-title-dot" aria-hidden="true">.</span></span></>}</h1>{kind === 'gost' && <h2 className="ch-editorial-title">{presentation.hero_title}</h2>}<p className="ch-description">{presentation.hero_description}</p>{kind !== 'gost' && <a className="ch-cta" href="#competition-directory">Browse the leagues<ArrowDownRight size={20}/></a>}</div>
    <div className="ch-controls"><span>{String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span><button type="button" aria-label="Previous competition picture" onClick={() => setIndex((current - 1 + slides.length) % slides.length)}><ChevronLeft size={18}/></button><button type="button" aria-label={paused ? 'Play competition slideshow' : 'Pause competition slideshow'} onClick={() => setPaused(!paused)}>{paused ? <Play size={15}/> : <Pause size={15}/>}</button><button type="button" aria-label="Next competition picture" onClick={() => setIndex((current + 1) % slides.length)}><ChevronRight size={18}/></button></div>
    {children}
    {error && <p role="status" className="ch-config-notice">Custom presentation unavailable. Showing STAGE artwork.</p>}
  </section>;
}
