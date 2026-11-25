import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessagesSquare, Users, Swords } from 'lucide-react';
import DiscordJoinCard from '@/components/community/DiscordJoinCard';
import StageTimesHero from '@/components/news/StageTimesHero';
import { stageClient } from '@/api/stageClient';
import { discordPresentation, DISCORD_ACCENTS } from '@/lib/discordPresentation';
import gamers from '@/assets/landing/gamers.webp';
import team from '@/assets/landing/team.webp';
import dribble from '@/assets/landing/dribble.webp';
import penalty from '@/assets/landing/penalty.webp';
import moments1 from '@/assets/landing/moments-1.webp';
import moments2 from '@/assets/landing/moments-2.webp';
import '@/components/community/communityPage.css';

const defaultSlides = [gamers, team, dribble, penalty, moments1, moments2].map(url => ({ url, position: '50% 50%', zoom: 100 }));
const spaces = [
  { icon: Users, title: 'Find your people', text: 'Meet other players and clubs. Talk football, share ideas and build your next connection.' },
  { icon: Swords, title: 'Beyond the final whistle', text: 'Talk tactics and organise with the community. Official fixtures and results stay here on STAGE.' },
  { icon: MessagesSquare, title: 'Stay in the conversation', text: 'Follow announcements, ask questions and connect with the STAGE community on Discord.' },
];

export default function Community() {
  const [presentation, setPresentation] = useState(() => discordPresentation());
  const [status, setStatus] = useState('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    stageClient.entities.DiscordPageConfig.filter({ key: 'main' }, '-updated_date', 1)
      .then(rows => { if (active) { setPresentation(discordPresentation(rows[0] || {})); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [retry]);
  // Resolve saved artwork before deciding whether default photos are needed.
  const slides = status === 'ready' ? (presentation.banner_slides.length ? presentation.banner_slides : defaultSlides) : [];
  return <main className="discord-community" style={{ '--discord-accent': DISCORD_ACCENTS[presentation.accent] }}>
    <StageTimesHero slides={slides} interval={presentation.banner_interval_seconds}
      title={<>{presentation.hero_title}<span aria-hidden="true">.</span></>}
      kicker="STAGE / THE COMMUNITY" description={presentation.hero_description}
      actionLabel="Meet the community" actionHref="#discord-community-join"
      editionLabel="OFF THE PITCH. STILL IN THE GAME." editionText="One community. More connections."
      imageLabel="community" label="Discord community introduction" />
    {status !== 'ready' && <div role="status" className="discord-art-status">{status === 'loading' ? 'Loading community photos…' : <>Community photos could not be loaded. <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></>}</div>}
    <section className="discord-spaces" aria-label="Inside the community">{spaces.map(({ icon: Icon, title, text }, i) => <article key={title}><span className="discord-space-number">0{i + 1}</span><Icon size={25} aria-hidden="true"/><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section id="discord-community-join" className="discord-join-section"><div className="discord-section-heading"><div><p>YOUR NEXT CONVERSATION STARTS HERE</p><h2>The STAGE server</h2></div><span>Join. Say hello. Find your squad.</span></div><DiscordJoinCard variant="full" className="discord-join-panel" /></section>
    <footer className="discord-community-links"><p>Keep your football on STAGE.</p><Link to="/directory">Explore the directory <ArrowUpRight size={18}/></Link><Link to="/game-day">Open GameDay <ArrowUpRight size={18}/></Link></footer>
  </main>;
}
