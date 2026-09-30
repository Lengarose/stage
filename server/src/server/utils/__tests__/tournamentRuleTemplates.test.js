const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyStoredTournamentRules,
  renderTournamentRules,
  resolveTournamentRules,
} = require('../tournamentRuleTemplates');

test('private/test tournaments append a confidentiality clause', () => {
  const french = renderTournamentRules('standard_cup', {
    name: 'FC27 SEPTEMBER TOURNAMENT 26',
    description: 'THE FIRST TESTING OF THE STAGE LEAGUES APPLICATION.',
  }, 'fr');
  assert.match(french.body, /cercle privé/);
  assert.match(french.body, /ne dois pas en parler/);

  const english = renderTournamentRules('standard_cup', {
    name: 'Open Cup',
    description: 'Public launch event',
  }, 'en');
  assert.doesNotMatch(english.body, /private-circle test/);
});

test('standard_cup fills this tournament name and date and leaves no placeholders', () => {
  const french = renderTournamentRules('standard_cup', {
    name: 'Tournoi Test',
    start_date: '2026-09-01 21:00:00',
  }, 'fr');
  assert.match(french.body, /Tournoi Test/);
  assert.match(french.body, /01\/09\/2026 21:00/);
  assert.doesNotMatch(french.body, /\{\{/);
  assert.match(french.body, /à confirmer/);
  assert.equal(french.acceptanceLabel, "J'ai lu et j'accepte le règlement de Tournoi Test.");

  const english = renderTournamentRules('prize', {
    name: 'Tournoi Production',
    start_date: '2026-10-02 18:30:00',
    entry_fee_stc: 1000,
    max_teams: 8,
  }, 'en');
  assert.match(english.body, /Tournoi Production/);
  assert.match(english.body, /2026-10-02 18:30/);
  assert.match(english.body, /8000/);
  assert.doesNotMatch(english.body, /Tournoi Test/);
  assert.doesNotMatch(english.body, /\{\{/);
});

test('an empty rules field becomes a neutral phrase', () => {
  const english = renderTournamentRules('competitive', {}, 'en');
  assert.match(english.body, /to be confirmed/);
  assert.doesNotMatch(english.body, /\{\{/);

  const otherLanguage = renderTournamentRules('standard_cup', { name: 'Tournoi Test', platform: '' }, 'nl');
  assert.match(otherLanguage.body, /to be confirmed/);
  assert.equal(otherLanguage.templateId, 'standard_cup');
});

test('rules_template:prize is the prize model, not free text', () => {
  const resolved = resolveTournamentRules({
    name: 'Tournoi Test',
    custom_rules: 'rules_template:prize',
    start_date: '2026-09-01 21:00:00',
  }, 'fr');
  assert.equal(resolved.templateId, 'prize');
  assert.equal(resolved.source, 'template');
  assert.match(resolved.body, /Tournoi Test/);
  assert.match(resolved.body, /70 %/);
  assert.doesNotMatch(resolved.body, /rules_template:/);
  assert.doesNotMatch(resolved.body, /\{\{/);

  const legacy = resolveTournamentRules({
    name: 'Old Cup',
    custom_rules: 'No rage quit.',
  }, 'en');
  assert.equal(legacy.source, 'custom');
  assert.equal(legacy.body, 'No rage quit.');
});

test('a chosen template is stored as an id and a marker, never as filled text', () => {
  const stored = applyStoredTournamentRules({
    rules_template_id: 'standard_cup',
    custom_rules: 'Règlement de Tournoi Test déjà rempli',
  });
  assert.equal(stored.rules_template_id, 'standard_cup');
  assert.equal(stored.custom_rules, 'rules_template:standard_cup');

  const fromMarker = applyStoredTournamentRules({
    custom_rules: 'rules_template:prize',
  });
  assert.equal(fromMarker.rules_template_id, 'prize');
  assert.equal(fromMarker.custom_rules, 'rules_template:prize');

  const legacy = applyStoredTournamentRules({ custom_rules: 'Bring your own ball.' });
  assert.equal(legacy.rules_template_id, null);
  assert.equal(legacy.custom_rules, 'Bring your own ball.');
});
