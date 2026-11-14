import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import gamers from '@/assets/landing/gamers.webp';
import dribble from '@/assets/landing/dribble.webp';
import penalty from '@/assets/landing/penalty.webp';
import team from '@/assets/landing/team.webp';
import moments1 from '@/assets/landing/moments-1.webp';
import moments2 from '@/assets/landing/moments-2.webp';

const defaults = [gamers,dribble,penalty,team,moments1,moments2].map(url=>({url,position:'50% 30%',zoom:100}));
export default function TransferRoomHero({ presentation, freeCount, expiringCount, canManage, clubName, windowOpen }) {
  const slides=presentation.banner_slides.length ? presentation.banner_slides : defaults;
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[focused,setFocused]=useState(false);
  const reduce=useReducedMotion(),active=index % slides.length;
  useEffect(()=>{
    if(reduce||paused||focused||slides.length<2)return;
    const timer=setInterval(()=>setIndex(n=>(n+1)%slides.length),presentation.banner_interval_seconds*1000);
    return ()=>clearInterval(timer);
  },[reduce,paused,focused,slides.length,presentation.banner_interval_seconds]);
  function step(direction){setIndex((active+direction+slides.length)%slides.length);}
  return <section className="transfer-room-hero" aria-label="Transfer Room introduction" onFocus={()=>setFocused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
    <div className="tr-hero-images" aria-hidden="true">{slides.map((s,i)=><div key={`${s.url}:${i}`} className={`tr-hero-image ${i===active?'is-active':''}`}><img src={s.url} alt="" loading={i===0?'eager':'lazy'} style={{objectPosition:s.position,transform:`scale(${s.zoom/100})`,transformOrigin:s.position}}/></div>)}</div>
    <div className="tr-hero-shade"/>
    <div className="tr-hero-top"><div className="tr-kicker">STAGE / THE TRANSFER MARKET</div><span className="tr-window-state"><i/>{windowOpen?'Transfer window open':'Explore the market'}</span></div>
    <div className="tr-hero-copy"><h1>{presentation.hero_title}</h1><p>{presentation.hero_description}</p>
      <div className="tr-hero-actions"><a href="#transfer-talent" className="tr-primary">Explore players <ArrowDownRight size={19}/></a><Link to="/profile" className="tr-text-link">Your player profile <ArrowUpRight size={17}/></Link></div>
      <div className="tr-hero-numbers"><div><strong>{freeCount}</strong><span>Free agents</span></div><div><strong>{expiringCount}</strong><span>Expiring contracts</span></div><div className="tr-desk"><span>{canManage?'Your recruitment desk':'Your next chapter'}</span><b>{canManage?clubName:'Get discovered. Make your move.'}</b></div></div>
    </div>
    <div className="tr-hero-bottom"><span className="tr-photo-count">{String(active+1).padStart(2,'0')} <small>/ {String(slides.length).padStart(2,'0')}</small></span><div className="tr-photo-dots" aria-label="Banner photos">{slides.map((s,i)=><button key={`${s.url}:${i}`} type="button" aria-label={`Show banner photo ${i+1}`} aria-pressed={active===i} className={active===i?'is-active':''} onClick={()=>setIndex(i)}/>)}</div><div className="tr-photo-controls"><button type="button" aria-label="Previous banner photo" onClick={()=>step(-1)}><ChevronLeft size={20}/></button><button type="button" aria-label={paused?'Play banner slideshow':'Pause banner slideshow'} aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button type="button" aria-label="Next banner photo" onClick={()=>step(1)}><ChevronRight size={20}/></button></div></div>
  </section>;
}
