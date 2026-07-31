#!/usr/bin/env node
/** Builds nl/de commonPages from EN + phrase maps + key overrides. */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { commonPagesOverrides } from './commonPages-overrides.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packsDir = join(__dirname, '..', '..', 'src/translations/packs');
const en = JSON.parse(readFileSync(join(packsDir, 'en.commonPages.json'), 'utf8'));
const fr = JSON.parse(readFileSync(join(packsDir, 'fr.commonPages.json'), 'utf8'));

function protect(text) {
  const tokens = [];
  let i = 0;
  const out = text.replace(/\{[^}]+\}/g, (m) => {
    const t = `__PH${i}__`;
    tokens.push([t, m]);
    i++;
    return t;
  });
  return { text: out, tokens };
}
function restore(text, tokens) {
  let out = text;
  for (const [t, m] of tokens) out = out.replaceAll(t, m);
  return out;
}
function buildPhraseMap(pairs) {
  return pairs.sort((a, b) => b[0].length - a[0].length);
}
function applyPhrases(text, phrases) {
  const { text: protectedText, tokens } = protect(text);
  let out = protectedText;
  for (const [from, to] of phrases) out = out.split(from).join(to);
  return restore(out, tokens);
}

// Minimal phrase maps — full maps in commonPages-overrides for quality
const NL_PHRASES = buildPhraseMap([
  ['Loading...', 'Laden...'], ['Saving...', 'Opslaan...'], ['Submitting...', 'Indienen...'],
  ['Search', 'Zoeken'], ['Cancel', 'Annuleren'], ['Delete', 'Verwijderen'], ['Back', 'Terug'],
  ['Next', 'Volgende'], ['Close', 'Sluiten'], ['Share', 'Delen'], ['View', 'Bekijken'],
  ['Accept', 'Accepteren'], ['Decline', 'Weigeren'], ['Confirm', 'Bevestigen'],
  ['Could not', 'Kon niet'], ['Please try again.', 'Probeer opnieuw.'],
  ['This cannot be undone.', 'Dit kan niet ongedaan worden gemaakt.'],
  ['You need', 'Je hebt nodig'], ['Your', 'Jouw'], ['your', 'je'],
  ['Game Day', 'Match Day'], ['Open Game Day', 'Match Day openen'],
  ['All rights reserved.', 'Alle rechten voorbehouden.'],
]);
const DE_PHRASES = buildPhraseMap([
  ['Loading...', 'Laden...'], ['Saving...', 'Speichern...'], ['Submitting...', 'Einreichen...'],
  ['Search', 'Suchen'], ['Cancel', 'Abbrechen'], ['Delete', 'Löschen'], ['Back', 'Zurück'],
  ['Next', 'Weiter'], ['Close', 'Schließen'], ['Share', 'Teilen'], ['View', 'Ansehen'],
  ['Accept', 'Annehmen'], ['Decline', 'Ablehnen'], ['Confirm', 'Bestätigen'],
  ['Could not', 'Konnte nicht'], ['Please try again.', 'Bitte erneut versuchen.'],
  ['This cannot be undone.', 'Das kann nicht rückgängig gemacht werden.'],
  ['You need', 'Du brauchst'], ['Your', 'Dein'], ['your', 'dein'],
  ['Game Day', 'Match Day'], ['Open Game Day', 'Match Day öffnen'],
  ['All rights reserved.', 'Alle Rechte vorbehalten.'],
]);

function translateKey(key, enText, lang) {
  const overrides = commonPagesOverrides[lang] ?? {};
  if (overrides[key] !== undefined) return overrides[key];
  return applyPhrases(enText, lang === 'nl' ? NL_PHRASES : DE_PHRASES);
}

const nl = {};
const de = {};
for (const key of Object.keys(en)) {
  nl[key] = translateKey(key, en[key], 'nl');
  de[key] = translateKey(key, en[key], 'de');
}
writeFileSync(join(packsDir, 'nl.commonPages.json'), JSON.stringify(nl, null, 2) + '\n');
writeFileSync(join(packsDir, 'de.commonPages.json'), JSON.stringify(de, null, 2) + '\n');
console.log('Wrote commonPages nl/de');
