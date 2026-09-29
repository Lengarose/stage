import { COUNTRIES } from "@/lib/countries";
import templates from "../../server/src/server/utils/tournamentRuleTemplates.js";

const {
  applyStoredTournamentRules,
  assertRulesAcceptance,
  encodeRulesTemplate,
  isTournamentRuleTemplate,
  listTournamentRuleTemplates,
  renderTournamentRules: renderTournamentRulesBase,
  resolveTournamentRules: resolveTournamentRulesBase,
  TOURNAMENT_RULE_TEMPLATE_IDS,
} = templates;

export {
  applyStoredTournamentRules,
  assertRulesAcceptance,
  encodeRulesTemplate,
  isTournamentRuleTemplate,
  listTournamentRuleTemplates,
  TOURNAMENT_RULE_TEMPLATE_IDS,
};

export function renderTournamentRules(templateId, tournament, locale) {
  return renderTournamentRulesBase(templateId, tournament, locale, COUNTRIES);
}

export function resolveTournamentRules(tournament, locale) {
  return resolveTournamentRulesBase(tournament, locale, COUNTRIES);
}
