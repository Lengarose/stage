import test from 'node:test';
import assert from 'node:assert/strict';
import {gameDayStatus, gameDayNextStep, gameDayCompetitionHref} from '../gameDayWorkspace.js';
import {isHubMatch, filterGameDayMatches} from '../gameDayHub.js';

test('a submitted proposal is awaiting confirmation even if storage still says in progress', () => {
 const game={id:'m',status:'in_progress',result_state:'AWAITING_AWAY_CONFIRMATION',result_home_submitted:'1'};
 assert.equal(gameDayStatus(game),'Awaiting confirmation');
 assert.equal(filterGameDayMatches([game],{status:'live'}).length,0);
 assert.equal(gameDayNextStep({game,result:{showConfirmResult:true}}).target,'result');
 assert.equal(gameDayNextStep({game}).target,undefined);
});
test('confirmed, disputed and admin results do not masquerade as live matches', () => {
 assert.equal(gameDayStatus({status:'completed',result_state:'CONFIRMED'}),'Confirmed result');
 assert.equal(gameDayStatus({status:'completed',result_state:'ADMIN_REVIEW'}),'Admin review');
 assert.equal(gameDayStatus({status:'in_progress',result_state:'DISPUTED'}),'Disputed result');
});
test('next step follows readiness without claiming an unknown squad is ready', () => {
 const args={game:{status:'scheduled'},clubMatch:true,home:true};
 assert.equal(gameDayNextStep(args).target,'squad');
 assert.match(gameDayNextStep({...args,preparation:{official:true,ready_at:'now',opponent_ready:false}}).text,/Waiting for your opponent/);
 assert.equal(gameDayNextStep({...args,preparation:{official:true,ready_at:'now',opponent_ready:true}}).target,'kickoff');
 assert.equal(gameDayNextStep({...args,preparation:{unavailable:true}}).target,undefined);
});
test('recent results remain for 24 hours, including forfeits; older results belong in Schedule', () => {
 const now=Date.parse('2026-11-15T12:00:00Z');
 for(const status of ['completed','forfeit']) {
  assert.equal(isHubMatch({id:'r',status,result_state:'CONFIRMED',updated_date:'2026-11-15T11:00:00Z'},now),true);
  assert.equal(isHubMatch({id:'r',status,result_state:'CONFIRMED',updated_date:'2026-11-14T12:00:00Z'},now),false);
 }
});

test('competition links retain the selected edition and never invent an arranged competition', () => {
 assert.equal(gameDayCompetitionHref({competition_key:'regional:season-2'}),'/leagues/season-2?season=season-2');
 assert.equal(gameDayCompetitionHref({competition_key:'regional_cup:cup-2'}),'/regional-cups?edition=cup-2');
 assert.equal(gameDayCompetitionHref({category:'supreme'}),'/competitions/supreme');
 assert.equal(gameDayCompetitionHref({tournament_id:'t-2'}),'/tournaments/t-2');
 assert.equal(gameDayCompetitionHref({type:'friendly'}),null);
 assert.equal(gameDayCompetitionHref({competition_href:'/custom?season=3'}),'/custom?season=3');
});
