import React from 'react';
import {createRoot} from 'react-dom/client';
import '@/registerFonts.js';
import '@/index.css';
import {GamerPlayerPhotoFrame} from '@/components/profile/gamer/GamerProfileUI';
import photo from '@/assets/landing/player.webp';
const playerId="eb028a00-337d-40d2-91fb-763e1bb7e618";
createRoot(document.getElementById('root')).render(<main style={{padding:40,minHeight:'100vh',background:'#060912',color:'#eef3fb'}}><h1 className="font-heading text-3xl">PLAYER PHOTO · POSITION & LEVEL</h1><p className="mt-3 text-sm text-muted-foreground">Local preview · sample photo · actual test-player level</p><div style={{display:'flex',alignItems:'end',gap:64,marginTop:48}}>{['rectangle','parallelogram','circle'].map(frame=><section key={frame}><GamerPlayerPhotoFrame player={{id:playerId,gamertag:'Sample player',position:'CDM',shirt_number:17,avatar_frame:frame}} imageUrl={photo} imageZoom={100}/><p className="mt-4 font-heading text-lg">{frame}</p></section>)}</div></main>);
