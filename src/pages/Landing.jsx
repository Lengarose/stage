import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import triumph from '@/assets/landing/triumph.webp';
import coach from '@/assets/landing/coach.webp';
import player from '@/assets/landing/player.webp';
import { useTranslation } from '@/hooks/useTranslation';
import FadeIn from '@/components/landing/FadeIn';
import Nav from '@/components/landing/Nav';
import HeroCarousel from '@/components/landing/HeroCarousel';
import StatsStrip from '@/components/landing/StatsStrip';
import TierCards from '@/components/landing/TierCards';
import RegionalLeagues from '@/components/landing/RegionalLeagues';
import FeatureSection from '@/components/landing/FeatureSection';
import FeatureGrid from '@/components/landing/FeatureGrid';
import Steps from '@/components/landing/Steps';
import CtaBand from '@/components/landing/CtaBand';
import Footer from '@/components/landing/Footer';

const PICTURES = [
  {
    id: 'compete',
    number: '01',
    kickerKey: 'commonPages.landV2NavCompete',
    titleKey: 'commonPages.landV2CompeteTitle',
    bodyKey: 'commonPages.landV2CompeteBody',
    altKey: 'commonPages.landV2AltTriumph',
    image: triumph,
    accent: '#f59e0b',
    aspect: '16/9',
  },
  {
    id: 'manage',
    number: '02',
    kickerKey: 'commonPages.landV2NavManage',
    titleKey: 'commonPages.landV2ManageTitle',
    bodyKey: 'commonPages.landV2ManageBody',
    altKey: 'commonPages.landV2AltCoach',
    image: coach,
    accent: '#4d8dff',
    aspect: '16/10',
    reverse: true,
  },
  {
    id: 'grow',
    number: '03',
    kickerKey: 'commonPages.landV2NavGrow',
    titleKey: 'commonPages.landV2GrowTitle',
    bodyKey: 'commonPages.landV2GrowBody',
    altKey: 'commonPages.landV2AltPlayer',
    image: player,
    accent: '#10b981',
    aspect: '16/9',
    contract: true,
    padBottom: true,
  },
];

function readStats(cms, t) {
  try {
    const parsed = typeof cms?.stats_json === 'string' ? JSON.parse(cms.stats_json) : cms?.stats_json;
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((item) => ({
        value: String(item?.value ?? ''),
        label: String(item?.label ?? ''),
      }));
    }
  } catch {
    /* keep the design defaults */
  }
  return [
    { value: '2 000+', label: t('commonPages.landV2StatPlayers') },
    { value: '200+', label: t('commonPages.landV2StatClubs') },
    { value: '500+', label: t('commonPages.landV2StatComps') },
    { value: '10 000+', label: t('commonPages.landV2StatMatches') },
  ];
}

export default function Landing({ onSignIn }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [cms, setCms] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/stage/public/landing-content', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}))
      .then((data) => {
        if (!controller.signal.aborted) setCms(data || {});
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, [reduce]);

  const heroImage = cms?.hero_image_url || '';
  const heroZoom = cms?.hero_image_zoom ? Number(cms.hero_image_zoom) : null;
  const sections = PICTURES.map((section, index) => {
    const n = index + 1;
    const cmsImage = cms?.[`section${n}_image_url`];
    return {
      ...section,
      kicker: cms?.[`section${n}_tag`] || t(section.kickerKey),
      title: cms?.[`section${n}_title`] || t(section.titleKey),
      text: cms?.[`section${n}_text`] || t(section.bodyKey),
      image: cmsImage || section.image,
      alt: cmsImage ? (cms?.[`section${n}_title`] || t(section.titleKey)) : t(section.altKey),
      objectPosition: cms?.[`section${n}_image_position`] || undefined,
      imageZoom: cms?.[`section${n}_image_zoom`] ? Number(cms[`section${n}_image_zoom`]) : null,
    };
  });

  return (
    <div className="landing-v2 min-h-screen overflow-x-hidden bg-[#06091a] font-['Chakra_Petch',system-ui,sans-serif] text-white">
      <Nav onSignIn={onSignIn} />
      <HeroCarousel
        onSignIn={onSignIn}
        eyebrow={cms?.hero_title || t('commonPages.landV2Eyebrow')}
        description={cms?.hero_description || t('commonPages.landV2HeroDesc')}
        leadImage={heroImage ? {
          src: heroImage,
          position: cms?.hero_image_position || '50% 10%',
          zoom: heroZoom,
        } : null}
      />
      <StatsStrip stats={readStats(cms, t)} />
      <FadeIn><TierCards /></FadeIn>
      <FadeIn><RegionalLeagues onSignIn={onSignIn} /></FadeIn>
      {sections.map((section) => (
        <FadeIn key={section.id}>
          <FeatureSection {...section} onSignIn={onSignIn} />
        </FadeIn>
      ))}
      <FadeIn><FeatureGrid /></FadeIn>
      <FadeIn><Steps /></FadeIn>
      <FadeIn><CtaBand onSignIn={onSignIn} /></FadeIn>
      <Footer tagline={cms?.footer_tagline || ''} />
    </div>
  );
}
