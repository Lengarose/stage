import test from 'node:test';
import assert from 'node:assert/strict';
import { landingContent, landingTranslate, LANDING_COPY_GROUPS } from '../landingContent.js';
import { HOME_COPY, HOME_FAQ, refreshHomeCopy } from '../homePageCopy.js';

test('landing content roundtrips all six slide crops and text overrides',()=>{
  const input={slides:Array.from({length:6},(_,i)=>({url:`/uploads/slide-${i}.png`,position:'25% 75%',zoom:125})),copy:{'commonPages.landHeroYour':'Your next {chapter}'},interval:9,platform_image:{url:'/uploads/features.png'}};
  const saved=landingContent(JSON.stringify(input));
  assert.deepEqual(saved.slides,input.slides);assert.equal(saved.interval,9);assert.equal(saved.platform_image.url,input.platform_image.url);
  const t=landingTranslate(saved,key=>`translated:${key}`);
  assert.equal(t('commonPages.landHeroYour',{chapter:'season'}),'Your next season');assert.equal(t('other.key'),'translated:other.key');
  assert.equal(LANDING_COPY_GROUPS.length,9);
});
test('empty and unsafe artwork keeps defaults; malformed content is safe',()=>{
  assert.equal(landingContent('{bad').slides.length,6);
  const saved=landingContent({slides:[{url:'javascript:bad',zoom:9999}],interval:1});
  assert.equal(saved.slides[0].url,'');assert.equal(saved.slides[0].zoom,500);assert.equal(saved.interval,3);
});
test('current home answers explain Plus and preserve custom Admin copy',()=>{
  assert.equal(refreshHomeCopy({section2_title:'How It Works'}).section2_title,HOME_COPY.section2_title);
  assert.deepEqual(refreshHomeCopy({section1_text:'Our own editorial paragraph'}),{section1_text:'Our own editorial paragraph'});
  assert.equal(HOME_FAQ.length,5);assert.match(HOME_FAQ[4].answer,/personal|Personal/);assert.match(HOME_COPY.section3_text,/actually played/);
});
