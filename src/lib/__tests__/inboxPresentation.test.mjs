import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxSender, inboxCategory, inboxNeedsResponse, STAGE_SYSTEM_AVATAR } from '../inboxPresentation.js';
test('STAGE System uses supplied artwork without replacing Board or club identities',()=>{
 assert.equal(inboxSender({sender_gamertag:'STAGE System',is_system:1}).avatar,STAGE_SYSTEM_AVATAR);
 assert.equal(inboxSender({is_system:1}).name,'STAGE System');
 assert.equal(inboxSender({sender_gamertag:'Club Board',is_system:1,sender_avatar_url:'/board.png'}).avatar,'/board.png');
 assert.equal(inboxSender({sender_club_name:'Atlas FC',sender_gamertag:'Manager',sender_avatar_url:'/atlas.png'}).name,'Atlas FC');
 assert.equal(inboxSender({is_system:0}).name,'Unknown sender');
});
test('response filter excludes resolved requests and navigation-only messages',()=>{
 assert.equal(inboxNeedsResponse({message_type:'match_invite',status:'pending'}),true);
 assert.equal(inboxNeedsResponse({message_type:'match_invite',status:'accepted'}),false);
 assert.equal(inboxNeedsResponse({action_type:'open_match',status:'pending'}),false);
});
test('message categories follow the linked business record',()=>{
 assert.equal(inboxCategory({related_entity_type:'club_contract_proposal'}),'contracts');
 assert.equal(inboxCategory({message_type:'match_invite'}),'matches');
 assert.equal(inboxCategory({message_type:'tournament_registration'}),'competitions');
 assert.equal(inboxCategory({message_type:'announcement'}),'system');
});
