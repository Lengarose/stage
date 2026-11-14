import test from 'node:test';
import assert from 'node:assert/strict';
import { transferRoomPresentation } from '../transferRoomPresentation.js';
test('Transfer Room presentation keeps legacy artwork and bounds the six-photo slideshow',()=>{
  const legacy=transferRoomPresentation({background_url:'/uploads/room.png',background_zoom:120});
  assert.equal(legacy.banner_slides[0].url,'/uploads/room.png');
  const modern=transferRoomPresentation({banner_slides:JSON.stringify(Array.from({length:8},(_,i)=>({url:`/uploads/${i}.jpg`,zoom:800}))),banner_interval_seconds:1,default_view:'list',default_sort:'form',accent:'gold'});
  assert.equal(modern.banner_slides.length,6);assert.equal(modern.banner_slides[0].zoom,500);assert.equal(modern.banner_interval_seconds,3);assert.equal(modern.default_view,'list');assert.equal(modern.default_sort,'form');assert.equal(modern.accent,'gold');
  const invalid=transferRoomPresentation({banner_slides:[{url:'javascript:alert(1)'}],default_view:'unknown',accent:'unknown'});
  assert.deepEqual(invalid.banner_slides,[]);assert.equal(invalid.accent,'blue');assert.equal(invalid.default_view,'cards');
});
