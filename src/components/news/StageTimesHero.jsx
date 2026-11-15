import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
export default function StageTimesHero({ slides = [], interval = 7 }) {
  const images=slides.filter(s=>s?.url).slice(0,6);
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hovered,setHovered]=useState(false),[reduced,setReduced]=useState(false);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  useEffect(()=>{if(images.length<2||paused||hovered||reduced)return;const timer=setInterval(()=>setIndex(i=>(i+1)%images.length),Math.max(3,Math.min(30,Number(interval)||7))*1000);return()=>clearInterval(timer);},[images.length,interval,paused,hovered,reduced]);
  const current=index%Math.max(1,images.length);
  return <header className="stage-times-hero" aria-label="STAGE Times introduction" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
    <div className="stage-times-hero-images">{images.map((slide,i)=><div key={`${i}:${slide.url}`} className={`stage-times-hero-image ${i===current?'is-active':''}`} style={{backgroundImage:`url(${JSON.stringify(slide.url)})`,backgroundPosition:slide.position||'50% 50%',backgroundSize:Number(slide.zoom)>100?`${Number(slide.zoom)}%`:'cover'}}/>)}</div><div className="stage-times-hero-shade"/>
    <div className="stage-times-hero-copy"><p className="stage-times-kicker">INSIDE THE GAME. ACROSS STAGE.</p><h1>THE STAGE<br/><span>TIMES</span></h1><p>Your club. Your competitions.<br/>The latest across STAGE.</p><a href="#stage-times-headlines">Explore the headlines <span aria-hidden="true">↘</span></a></div>
    <div className="stage-times-hero-edition"><span>THE LATEST EDITION</span><time>{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</time></div>
    {images.length>1&&<div className="stage-times-slide-controls" aria-label="News slideshow controls"><button type="button" onClick={()=>setIndex((current+images.length-1)%images.length)} aria-label="Previous news image"><ChevronLeft size={18}/></button><span>{String(current+1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</span><button type="button" onClick={()=>setIndex((current+1)%images.length)} aria-label="Next news image"><ChevronRight size={18}/></button><button type="button" aria-label={paused?'Play slideshow':'Pause slideshow'} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div>}
  </header>;
}
