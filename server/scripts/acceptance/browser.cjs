'use strict';
// Real Chrome/CDP, Vite and the explicitly isolated browser-fixture API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const config=JSON.parse(fs.readFileSync('/private/tmp/stage-browser-fixture.json','utf8'));
const origin='http://127.0.0.1:4174',out=path.resolve(__dirname,'../../../docs/acceptance-results/browser-2026-11-07');
fs.mkdirSync(out,{recursive:true});
const report={browser:'Chrome headless via CDP',source:'Real Vite routes and isolated MySQL/JWT API; synthetic acceptance clubs and trophies',flows:[],complete:false};
let socket;
(async()=>{
 const targets=await(await fetch('http://127.0.0.1:19222/json')).json();
 const target=targets.find(t=>t.type==='page');assert.ok(target);
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let sequence=0;const waiting=new Map(),errors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 socket.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const promise=waiting.get(message.id);waiting.delete(message.id);if(message.error)promise?.reject(Error(JSON.stringify(message.error)));else promise?.resolve(message.result);}
  else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text+': '+(message.params.exceptionDetails.exception?.description||''));
  else if(message.method==='Fetch.requestPaused'){
   const {requestId,request}=message.params;
   const local=/^(http|ws):\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(request.url)||/^(data|blob):/.test(request.url);
   send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  }
 };
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
 const until=async(expression,timeout=45000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(`Boolean(${expression})`))return;await new Promise(resolve=>setTimeout(resolve,250));}throw Error(`Browser wait timed out: ${expression}`);};
 if(process.argv.includes('--inspect-only')) { report.page=await evaluate(`({url:location.href,text:document.body?.innerText,overlay:document.querySelector('vite-error-overlay')?.shadowRoot?.textContent,html:document.documentElement.outerHTML.slice(0,1500)})`);return; }
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:origin});await until("location.origin==='http://127.0.0.1:4174' && document.readyState==='complete'");
 await evaluate(`(async()=>{const {storeTokens}=await import('/src/api/stageClient.js');storeTokens(${JSON.stringify({accessToken:config.accessToken,userId:config.userId,playerId:config.playerId,ownerId:config.ownerId})});return true;})()`);
 const navigate=async route=>{await send('Page.navigate',{url:origin+route});await until("document.readyState==='complete'");await until("document.querySelector('main') || document.querySelector('h1')");};
 const capture=async name=>{await evaluate(`(()=>{const done=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Done');if(done)done.click();})()`);await new Promise(resolve=>setTimeout(resolve,600));const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 const metrics=()=>evaluate(`({url:location.pathname+location.search,title:document.querySelector('h1')?.textContent,viewport:innerWidth,width:document.documentElement.scrollWidth,loanAction:[...document.querySelectorAll('button')].some(b=>/request loan|recall loan|exercise option/i.test(b.innerText)),text:document.body.innerText.slice(-600)})`);
 await navigate('/leagues');await until("/regional leagues/i.test(document.body.innerText)");
 await until("document.querySelector('nav[aria-label=\"Regional editions\"]')");await capture('regional-desktop');report.flows.push({view:'Regional hub desktop',...await metrics()});
 await navigate('/leagues/'+encodeURIComponent(config.league.slug));await until("document.querySelector('nav[aria-label=\"Competition sections\"]')");
 await evaluate(`document.querySelector('nav[aria-label="Competition sections"] button:nth-child(2)').click()`);
 await until("new URLSearchParams(location.search).get('tab')==='clubs'");await until("document.body.innerText.includes('Acceptance Club')");
 await capture('league-clubs-desktop');report.flows.push({view:'League Clubs tab clicked on desktop',...await metrics()});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('league-clubs-mobile');
 const mobile=await metrics();assert.equal(mobile.width<=mobile.viewport,true,'League directory overflows mobile viewport');
 const tabs=await evaluate(`Array.from(document.querySelectorAll('nav[aria-label="Competition sections"] button')).map(b=>({name:b.innerText,underline:getComputedStyle(b).textDecorationLine,border:getComputedStyle(b).borderBottomWidth,active:b.getAttribute('aria-current')}))`);
 assert.ok(tabs.every(tab=>tab.underline==='none'&&tab.border==='0px'));report.flows.push({view:'League Clubs mobile',...mobile,tabs});
 await navigate('/transfer-market');await until("document.body.innerText.includes('TRANSFER') || document.body.innerText.includes('Transfer')");await capture('transfer-market-mobile');const market=await metrics();assert.equal(market.loanAction,false);report.flows.push({view:'Transfer market mobile',...market});
 await navigate('/players/'+encodeURIComponent(config.playerId));await until("/player 0-0/i.test(document.body.innerText)");await capture('player-mobile');const player=await metrics();assert.equal(player.loanAction,false);report.flows.push({view:'Player profile mobile',...player});
 report.runtime_errors=errors;assert.equal(errors.length,0,errors.join('\n'));report.browser_route_complete=true;
})().catch(error=>{report.error=error.stack;process.exitCode=1;console.error(error);}).finally(()=>{socket?.close();report.finished_at=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
