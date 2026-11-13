import test from 'node:test';
import assert from 'node:assert/strict';
import { getGameDayBannerSlides, getGameDayBannerInterval } from '../gameDayBanner.js';

test('existing single banners retain their crop when opened as a slideshow', () => {
  assert.deepEqual(getGameDayBannerSlides({ banner_url: '/uploads/old.png', banner_position: '30% 70%', banner_zoom: 120 }), [
    { url: '/uploads/old.png', position: '30% 70%', zoom: 120 },
  ]);
});

test('slides preserve admin ordering and individual crops, skipping unfinished uploads', () => {
  assert.deepEqual(getGameDayBannerSlides({ banner_url: '/uploads/old.png', banner_slides: [
    { url: '/uploads/b.png', position: '10% 20%', zoom: '140' },
    { url: '' },
    { url: ' /uploads/a.png ', zoom: 'bad' },
    null,
  ] }), [
    { url: '/uploads/b.png', position: '10% 20%', zoom: 140 },
    { url: '/uploads/a.png', position: '50% 50%', zoom: null },
  ]);
});

test('empty or cleared banners have no slides', () => {
  assert.deepEqual(getGameDayBannerSlides(null), []);
  assert.deepEqual(getGameDayBannerSlides({ banner_slides: [], banner_url: '' }), []);
});

test('rotation accepts saved timing and defaults safely for out-of-range values', () => {
  assert.equal(getGameDayBannerInterval({ banner_interval_seconds: '8' }), 8000);
  for (const value of [null, undefined, 'bad', 0, 2, 31]) {
    assert.equal(getGameDayBannerInterval({ banner_interval_seconds: value }), 6000);
  }
});
