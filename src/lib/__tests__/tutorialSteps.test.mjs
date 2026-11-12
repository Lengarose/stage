import assert from 'node:assert/strict';
import test from 'node:test';
import {getTutorialSteps,normalizeTutorialIntent} from '../tutorialSteps.js';
test('saved role intents remain compatible while Manager is supported',()=>{
 for(const value of ['player','president','both'])assert.equal(normalizeTutorialIntent(value),value);
 assert.equal(normalizeTutorialIntent('manager'),'president');
 assert.equal(normalizeTutorialIntent(undefined),'player');
});
test('registration tutorials explain Board compensation without old self-pay, loans or availability gates',()=>{
 for(const role of ['player','president','both']){
  const steps=getTutorialSteps(role),copy=JSON.stringify(steps);
  assert.ok(steps.length<=6);
  for(const step of steps){assert.ok(step.where);assert.ok(step.description.length<240);assert.ok(step.points.length<=3);}
  assert.match(copy,/Level 1/);assert.match(copy,/100 XP/);assert.match(copy,/weekly/i);
  assert.doesNotMatch(copy,/Set Availability|Keep.*OVR|Recall|option-to-buy|Give Yourself Wages|President/);
 }
 const management=JSON.stringify(getTutorialSteps('both'));
 assert.match(management,/ownership/i);assert.match(management,/12 weeks/);assert.match(management,/Declining a paid offer does not remove ownership/);assert.match(management,/Club Board/);
});
