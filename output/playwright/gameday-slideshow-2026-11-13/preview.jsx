import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import GameDayBanner from '/src/components/gameday/GameDayBanner.jsx';
import GameDayBannerEditor from '/src/components/admin/gameday/GameDayBannerEditor.jsx';
import {stageClient} from '/src/api/stageClient.js';
const config = {id:'preview',key:'main',banner_interval_seconds:3,banner_slides:[
{url:'/output/imagegen/game-day-2026-11-13/01-victory-roar.png',position:'50% 50%',zoom:null},
{url:'/output/imagegen/game-day-2026-11-13/02-knee-slide.png',position:'50% 50%',zoom:null},
{url:'/output/imagegen/game-day-2026-11-13/03-hand-clasp.png',position:'50% 50%',zoom:null}]};
// Preview only: isolate all config reads and writes from production.
stageClient.entities.GameDayConfig.filter = async () => [JSON.parse(sessionStorage.getItem('banner-preview-config') || JSON.stringify(config))];
stageClient.entities.GameDayConfig.update = async (id,payload) => {const next={...payload,id};sessionStorage.setItem('banner-preview-config',JSON.stringify(next));window.savedBannerPreview=next;return next;};
const actions = ['Arrange Game','Livestream','Chat'].map(label => <button key={label} type="button" className="min-h-11 px-3 font-heading text-xs font-black uppercase text-white/85">{label}</button>);
createRoot(document.getElementById('root')).render(<div className="min-h-screen bg-[#07070b] text-white">{location.search.includes('admin') ? <GameDayBannerEditor/> : <><GameDayBanner config={config}>{actions}</GameDayBanner><div className="h-[500px] px-4 pt-6">Match Screens</div></>}</div>);
