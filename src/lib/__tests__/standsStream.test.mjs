import test from 'node:test';
import assert from 'node:assert/strict';
import { standsStream } from '../standsStream.js';
test('only supported provider hosts produce embeds, with the current Twitch parent',()=>{
  const twitch=standsStream('https://www.twitch.tv/stage_channel','stageleagues.com');
  const u=new URL(twitch.embed);assert.equal(u.hostname,'player.twitch.tv');assert.equal(u.searchParams.get('parent'),'stageleagues.com');assert.equal(u.searchParams.get('channel'),'stage_channel');
  assert.equal(standsStream('https://youtu.be/abcdefghijk','stageleagues.com').embed,'https://www.youtube.com/embed/abcdefghijk?autoplay=0');
  assert.equal(standsStream('https://twitch.tv.evil.example/stage_channel','stageleagues.com').embed,null);
  assert.equal(standsStream('https://kick.com/channel','stageleagues.com').embed,null);
  assert.equal(standsStream('javascript:alert(1)','stageleagues.com'),null);
  assert.equal(standsStream('<iframe src="https://evil.example">','stageleagues.com'),null);
});
