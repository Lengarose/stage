import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRightLeft, FileSignature, Shield, User, TrendingUp, Trophy, Megaphone, Star, Zap, ArrowUpRight, Search, X } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import StageTimesHero from "@/components/news/StageTimesHero";
import MatchupBackdrop from "@/components/schedule/MatchupBackdrop";
import { NEWS_SECTIONS } from "@/lib/stageTimes";
import "./stageTimes.css";
import "./newsDarkRed.css";

export const CATEGORY_CONFIG = {
  transfers:        { label: "Transfers",       labelKey: "transfers", icon: ArrowRightLeft,  color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  contracts:        { label: "Contracts",       labelKey: "contracts", icon: FileSignature,   color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  club_news:        { label: "Club News",       labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  player_news:      { label: "Player News",     labelKey: "playerNews", icon: User,            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  market:           { label: "Market",          labelKey: "market", icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  tournament:       { label: "Tournaments",     labelKey: "tournaments", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  stadium:          { label: "Stadium",         labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  shirts:           { label: "Shirts",          labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  tickets:          { label: "Tickets",         labelKey: "clubNews", icon: Shield,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  trophy:           { label: "Trophies",        labelKey: "clubNews", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  lifestyle:        { label: "Lifestyle",       labelKey: "playerNews", icon: User,            color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  motm:             { label: "MOTM",            labelKey: "playerNews", icon: Star,            color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  competitions:     { label: "Competitions",    labelKey: "competitions", icon: Trophy,          color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  ranking:          { label: "Rankings",        labelKey: "rankings", icon: TrendingUp,      color: "text-success",     bg: "bg-success/10 border-success/30" },
  general:          { label: "General",         labelKey: "general", icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  achievement:      { label: "Achievement",     labelKey: "achievement", icon: Star,            color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  app_update:       { label: "App Update",      labelKey: "appUpdate", icon: Zap,             color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  announcement:     { label: "Announcement",    labelKey: "announcement", icon: Megaphone,       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
};

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function StoryArt({ story, artwork }) {
  const art=artwork?.[story.kind]||{};
  const url=story.image_url||art.url;
  return <div className={`stage-times-art ${!story.match&&!url?'stage-times-art--empty':''}`}>
    {story.match?<MatchupBackdrop event={story.match} detail/>:url?<img src={url} alt="" style={{objectPosition:story.image_url?story.image_position:art.position,transform:`scale(${Number(story.image_url?story.image_zoom:art.zoom||100)/100})`}}/>:<div className="stage-times-empty-art"><span>STAGE / {story.kind.replaceAll('_',' ')}</span></div>}
    <span className="stage-times-art-label">{story.match?'MATCH CENTRE':url?'STAGE TIMES':'THE STORY'}</span>
  </div>;
}
export default function News() {
  const [params,setParams]=useSearchParams();
  const section=NEWS_SECTIONS.some(([id])=>id===params.get('section'))?params.get('section'):'for-you';
  const article=params.get('article');
  const [query,setQuery]=useState(''),[data,setData]=useState(null),[artwork,setArtwork]=useState({}),[presentation,setPresentation]=useState({hero_slides:[],hero_interval_seconds:7}),[error,setError]=useState(''),[retry,setRetry]=useState(0),[offset,setOffset]=useState(0),[selected,setSelected]=useState(null),[detailError,setDetailError]=useState('');
  useEffect(()=>{let active=true;setData(null);setError('');const timer=setTimeout(()=>{
    Promise.all([stageClient.http.get(`/news-items/feed?section=${section}&q=${encodeURIComponent(query)}&offset=${offset}&limit=12`),stageClient.entities.NewsPageConfig.filter({key:'main'},'-updated_date',1)]).then(([feed,config])=>{if(active){setData(feed);setArtwork(config[0]?.artwork||{});setPresentation({hero_slides:config[0]?.hero_slides||[],hero_interval_seconds:config[0]?.hero_interval_seconds||7});}}).catch(e=>{if(active)setError(e.message||'News could not be loaded.');});
  },200);return()=>{active=false;clearTimeout(timer);};},[section,query,offset,retry]);
  useEffect(()=>{let active=true;setSelected(null);setDetailError('');if(article)stageClient.http.get(`/news-items/feed?article=${encodeURIComponent(article)}&limit=1`).then(d=>{if(active){setSelected(d.stories[0]||null);if(!d.stories.length)setDetailError('This story is unavailable.');}}).catch(e=>{if(active)setDetailError(e.message);});return()=>{active=false;};},[article,retry]);
  useEffect(()=>{if(!article)return;const previous=document.activeElement;const close=e=>{if(e.key==='Escape')setParams(p=>{const next=new URLSearchParams(p);next.delete('article');return next;});if(e.key==='Tab'){const dialog=document.querySelector('.stage-times-modal');const controls=dialog?.querySelectorAll('button:not(:disabled),a[href],input,select,textarea');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);if(previous instanceof HTMLElement)previous.focus();};},[article,setParams]);
  function close(){setParams(p=>{const next=new URLSearchParams(p);next.delete('article');return next;});}
  return <div className="stage-times">
    <StageTimesHero slides={presentation.hero_slides} interval={presentation.hero_interval_seconds}/>
    <div className="stage-times-toolbar" id="stage-times-headlines"><nav aria-label="News sections">{NEWS_SECTIONS.map(([id,label])=><button type="button" key={id} aria-pressed={section===id} onClick={()=>{setOffset(0);setParams({section:id});}}>{label}</button>)}</nav><label className="stage-times-search"><Search size={17}/><input aria-label="Search STAGE Times" placeholder="Search the headlines" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);}}/></label></div>
    {error?<div role="alert" className="stage-times-status"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>:!data?<p role="status" className="stage-times-status">Loading your edition…</p>:<>
      <div className="stage-times-section-heading"><h2>{NEWS_SECTIONS.find(([id])=>id===section)?.[1]}</h2><span>{data.total} stories</span></div>
      {!data.stories.length?<div className="stage-times-status"><h2>{section==='club'&&!data.has_club?'Your club story starts here':'You’re up to date'}</h2><p>{section==='club'&&!data.has_club?'Join or create a club to follow its season here.':'Relevant updates will appear here as matches, competitions and announcements develop.'}</p><Link to={section==='club'?'/clubs':'/the-stands'}>{section==='club'?'Explore clubs':'Visit The Stands'} <ArrowUpRight size={16}/></Link></div>:<div className={`stage-times-grid ${offset===0?'stage-times-grid--lead':''}`}>{data.stories.map((story,index)=><article className={offset===0&&index===0?'stage-times-story stage-times-story--lead':'stage-times-story'} key={story.id}><button type="button" onClick={()=>setParams({section,article:story.id})} aria-label={`Read: ${story.title}`}><StoryArt story={story} artwork={artwork}/><div className="stage-times-copy"><div className="stage-times-meta"><span>{story.kind.replaceAll('_',' ')}</span><time>{timeAgo(story.published_at)}</time></div><h2>{story.title}</h2><p>{story.body}</p><span className="stage-times-read">Read the story <ArrowUpRight size={18}/></span></div></button></article>)}</div>}
      <div className="stage-times-pagination"><button type="button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-12))}>Previous</button><span>Page {Math.floor(offset/12)+1}</span><button type="button" disabled={!data.has_more} onClick={()=>setOffset(n=>n+12)}>Next</button></div>
    </>}
    <footer className="stage-times-around"><span>AROUND STAGE</span>{[['/leagues','Regional Leagues'],['/regional-cups','Regional Cups'],['/competitions','GOST'],['/tournaments','Tournaments'],['/the-stands','The Stands'],['/transfer-room','Transfer Room']].map(([link,label])=><Link key={link} to={link}>{label} <ArrowUpRight size={14}/></Link>)}</footer>
    {article&&<div className="stage-times-modal-backdrop" onClick={close}><section role="dialog" aria-modal="true" aria-label={selected?.title||'News story'} className="stage-times-modal" onClick={e=>e.stopPropagation()}><button type="button" className="stage-times-close" autoFocus onClick={close} aria-label="Close story"><X/></button>{detailError?<div role="alert" className="stage-times-status">{detailError}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>:!selected?<p className="stage-times-status">Loading story…</p>:<><StoryArt story={selected} artwork={artwork}/><div className="stage-times-copy"><p className="stage-times-kicker">{selected.kind.replaceAll('_',' ')} · {timeAgo(selected.published_at)}</p><h2>{selected.title}</h2><div className="stage-times-body">{selected.body.split(/\n+/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div><div className="stage-times-destinations">{selected.link&&<Link to={selected.link}>{selected.action_label||'Explore story'} <ArrowUpRight size={18}/></Link>}{selected.related_links?.map(link=><Link key={link.link} to={link.link}>{link.label} <ArrowUpRight size={16}/></Link>)}</div></div></>}</section></div>}
  </div>;
}
