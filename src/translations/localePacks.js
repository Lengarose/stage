/**
 * Locale overlay packs — full translations merged onto EN base catalogs.
 */
import nlSettings from "./packs/nl.settingsPage.json" with { type: "json" };
import esSettings from "./packs/es.settingsPage.json" with { type: "json" };
import deSettings from "./packs/de.settingsPage.json" with { type: "json" };
import itSettings from "./packs/it.settingsPage.json" with { type: "json" };
import ptSettings from "./packs/pt.settingsPage.json" with { type: "json" };
import zhSettings from "./packs/zh.settingsPage.json" with { type: "json" };
import jaSettings from "./packs/ja.settingsPage.json" with { type: "json" };
import koSettings from "./packs/ko.settingsPage.json" with { type: "json" };
import ruSettings from "./packs/ru.settingsPage.json" with { type: "json" };
import plSettings from "./packs/pl.settingsPage.json" with { type: "json" };
import trSettings from "./packs/tr.settingsPage.json" with { type: "json" };
import arSettings from "./packs/ar.settingsPage.json" with { type: "json" };
import { SECTION_PACKS } from "./localePackRegistry.js";

const SETTINGS_PACKS = {
  nl: nlSettings,
  es: esSettings,
  de: deSettings,
  it: itSettings,
  pt: ptSettings,
  zh: zhSettings,
  ja: jaSettings,
  ko: koSettings,
  ru: ruSettings,
  pl: plSettings,
  tr: trSettings,
  ar: arSettings,
};

export function applySettingsPacks(localized) {
  for (const [lang, pack] of Object.entries(SETTINGS_PACKS)) {
    if (!localized[lang]) continue;
    localized[lang].settingsPage = { ...(localized[lang].settingsPage || {}), ...pack };
  }
}

function mergePackPreferringTranslations(target, pack, enBase) {
  for (const [key, packValue] of Object.entries(pack || {})) {
    const enValue = enBase?.[key];
    const existing = target[key];
    const packIsTranslated = packValue !== enValue;
    const existingIsTranslated = existing != null && existing !== enValue;
    if (packIsTranslated || !existingIsTranslated) {
      target[key] = packValue;
    }
  }
}

export function applySectionPacks({
  commonPageTranslations,
  matchFlowTranslations,
  competitionFlowTranslations,
  tournamentDetailTranslations,
}) {
  const targets = {
    commonPages: commonPageTranslations,
    matchFlow: matchFlowTranslations,
    competitionFlow: competitionFlowTranslations,
    tournamentDetail: tournamentDetailTranslations,
  };

  for (const [lang, sections] of Object.entries(SECTION_PACKS)) {
    if (lang === "en" || lang === "fr") continue;
    for (const [section, pack] of Object.entries(sections || {})) {
      const bucket = targets[section];
      if (!bucket || !pack) continue;
      if (!bucket[lang]) bucket[lang] = { ...(bucket.en || {}) };
      mergePackPreferringTranslations(bucket[lang], pack, bucket.en);
    }
  }
}

export function listLoadedPacks() {
  const out = Object.keys(SETTINGS_PACKS).map((l) => `${l}.settingsPage`);
  for (const [lang, sections] of Object.entries(SECTION_PACKS)) {
    for (const section of Object.keys(sections || {})) out.push(`${lang}.${section}`);
  }
  return out.sort();
}
