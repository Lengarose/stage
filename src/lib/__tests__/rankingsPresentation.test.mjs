import test from 'node:test';
import assert from 'node:assert/strict';
import { rankingsPresentation } from '../rankingsPresentation.js';
test('existing single-image settings stay static and preserve crop', () => {
 const settings=rankingsPresentation({background_url:' /image.png ',background_position:'20% 30%',background_zoom:125});
 assert.equal(settings.background_url,'/image.png');
 assert.equal(settings.background_position,'20% 30%');
 assert.equal(settings.background_zoom,125);
 assert.equal(settings.slideshow_enabled,false);
 assert.deepEqual(settings.background_slides,[]);
});
test('optional slideshow survives a saved-settings round trip with bounded timing and image count',()=>{
 const settings=rankingsPresentation({slideshow_enabled:true,slide_interval_seconds:1,background_slides:Array.from({length:8},()=>({url:' /slide.png ',zoom:0}))});
 assert.equal(settings.slide_interval_seconds,3);
 assert.equal(settings.background_slides.length,5);
 assert.equal(settings.background_slides[0].url,'/slide.png');
 assert.equal(settings.background_slides[0].zoom,100);
 assert.deepEqual(rankingsPresentation(JSON.parse(JSON.stringify(settings))),settings);
});
