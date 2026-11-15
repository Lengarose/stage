import {useEffect,useState} from 'react';
import {useReducedMotion} from 'framer-motion';
import {ArrowDownRight,ChevronLeft,ChevronRight,Pause,Play,Plus,BookOpen} from 'lucide-react';
import team from '@/assets/landing/team.webp';
import gamers from '@/assets/landing/gamers.webp';
import dribble from '@/assets/landing/dribble.webp';
import penalty from '@/assets/landing/penalty.webp';
import moments1 from '@/assets/landing/moments-1.webp';
import moments2 from '@/assets/landing/moments-2.webp';
const defaults=[team,gamers,dribble,penalty,moments1,moments2].map(url=>({url,position:'50% 30%',zoom:100}));
export default function TournamentHubHero({presentation,openCount,liveCount,canCreate,onCreate,onRules}) {
 const slides=presentation.banner_slides.length?presentation.banner_slides:defaults;
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[focused,setFocused]=useState(false);
 const reduce=useReducedMotion(),active=index%slides.length;
 useEffect(()=>{if(reduce||paused||focused||slides.length<2)return;const timer=setInterval(()=>setIndex(n=>(n+1)%slides.length),presentation.banner_interval_seconds*1000);return()=>clearInterval(timer);},[reduce,paused,focused,slides.length,presentation.banner_interval_seconds]);
 return <header className="th-hero" onFocus={()=>setFocused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
  <div className="th-hero-copy"><p className="th-eyebrow">STAGE / THE COMPETITION FLOOR</p><h1>{presentation.hero_title}<span>.</span></h1><p className="th-intro">{presentation.hero_description}</p><div className="th-actions"><a className="th-primary" href="#tournament-directory">Find your tournament <ArrowDownRight size={20}/></a>{canCreate&&<button type="button" className="th-text" onClick={onCreate}><Plus size={17}/>Create tournament</button>}</div><div className="th-numbers"><div><strong>{openCount}</strong><span>Accepting entries</span></div><div><strong>{liveCount}</strong><span>Live competitions</span></div><button type="button" className="th-text" onClick={onRules}><BookOpen size={18}/>The rulebook →</button></div>{!canCreate&&<p className="th-membership">Want to host? STAGE Plus unlocks tournament creation.</p>}</div>
  <div className="th-poster"><div className="th-poster-images" aria-hidden="true">{slides.map((slide,i)=><img key={`${slide.url}:${i}`} src={slide.url} alt="" loading={i===0?'eager':'lazy'} className={active===i?'is-active':''} style={{objectPosition:slide.position,transform:`scale(${slide.zoom/100})`,transformOrigin:slide.position}}/>)}</div><div className="th-poster-shade"/><div className="th-slide-controls"><span>{String(active+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</span><div>{slides.map((slide,i)=><button type="button" key={`${slide.url}:${i}`} aria-label={`Show tournament photo ${i+1}`} aria-pressed={active===i} className={`th-dot ${active===i?'is-active':''}`} onClick={()=>setIndex(i)}/>)}</div><button type="button" aria-label="Previous tournament photo" onClick={()=>setIndex((active+slides.length-1)%slides.length)}><ChevronLeft size={18}/></button><button type="button" aria-label={paused?'Play tournament slideshow':'Pause tournament slideshow'} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button type="button" aria-label="Next tournament photo" onClick={()=>setIndex((active+1)%slides.length)}><ChevronRight size={18}/></button></div></div>
 </header>;
}
