import { COUNTRIES } from "@/lib/countries";
import { calculateTournamentPrizeBreakdown } from "@/lib/tournamentRules";

export const TOURNAMENT_RULE_TEMPLATE_IDS = ["standard_cup", "competitive", "pro_clubs", "prize"];

const MISSING = { fr: "à confirmer", en: "to be confirmed" };

const FORMAT_LABELS = {
  fr: {
    knockout: "Élimination directe",
    league: "Championnat",
    group_stage: "Phase de groupes",
    swiss_ucl: "Suisse (UCL)",
    double_elimination: "Double élimination",
  },
  en: {
    knockout: "Knockout",
    league: "League",
    group_stage: "Group stage",
    swiss_ucl: "Swiss UCL",
    double_elimination: "Double elimination",
  },
};

const PARTICIPANT_LABELS = {
  fr: { club: "Clubs", player: "Joueurs" },
  en: { club: "Clubs", player: "Players" },
};

const TEMPLATES = {
  standard_cup: {
    title: { fr: "Coupe standard", en: "Standard cup" },
    summary: {
      fr: "Fenêtre de coup d’envoi, délai de résultat, fair-play.",
      en: "Kickoff window, result deadline, fair play.",
    },
    body: {
      fr: `Règlement de {{tournament_name}}

Ce règlement s’applique à {{tournament_name}}, organisé par {{organizer}}.

Déroulement
- Format : {{format}}
- Plateforme : {{platform}}
- Zone : {{region}}
- Pays : {{country}}
- Participants : {{participant_type}}
- Places : {{max_teams}}
- Début : {{start_date}}
- Fin : {{end_date}}

Le coup d’envoi se joue dans la fenêtre annoncée. Le score est saisi avant la fin de cette fenêtre. Un abandon volontaire compte comme une défaite. Les insultes et la triche entraînent l’exclusion.

Inscription
- Frais : {{entry_fee_stc}} STC et {{entry_credits}} crédits
- Cagnotte : {{prize_pool}} STC
- Vainqueur : {{prize_winner}} STC
- Finaliste : {{prize_runner_up}} STC
- Troisième : {{prize_third}} STC`,
      en: `Rules of {{tournament_name}}

These rules apply to {{tournament_name}}, organized by {{organizer}}.

How it runs
- Format: {{format}}
- Platform: {{platform}}
- Region: {{region}}
- Country: {{country}}
- Entrants: {{participant_type}}
- Slots: {{max_teams}}
- Starts: {{start_date}}
- Ends: {{end_date}}

Kickoff happens inside the announced window. The score is submitted before that window ends. A voluntary quit counts as a loss. Abuse and cheating mean removal from the tournament.

Entry
- Fee: {{entry_fee_stc}} STC and {{entry_credits}} credits
- Prize pool: {{prize_pool}} STC
- Winner: {{prize_winner}} STC
- Runner-up: {{prize_runner_up}} STC
- Third place: {{prize_third}} STC`,
    },
  },
  competitive: {
    title: { fr: "Compétitif", en: "Competitive" },
    summary: {
      fr: "Déconnexion, preuve de score, litiges.",
      en: "Disconnects, score proof, disputes.",
    },
    body: {
      fr: `Règlement compétitif de {{tournament_name}}

{{tournament_name}} est un tournoi compétitif organisé par {{organizer}}. Format {{format}}, plateforme {{platform}}, zone {{region}}, pays {{country}}. Participants : {{participant_type}}. Places : {{max_teams}}. Début {{start_date}}. Fin {{end_date}}.

Une déconnexion en match compte comme une défaite, sauf preuve d’un problème commun aux deux équipes. Le score n’est officiel qu’avec une capture ou une preuve acceptée par l’organisateur. Un litige est envoyé à {{organizer}} avant la fin de la fenêtre de résultat. Pas de second report.

Inscription : {{entry_fee_stc}} STC et {{entry_credits}} crédits. Cagnotte {{prize_pool}} STC. Vainqueur {{prize_winner}} STC, finaliste {{prize_runner_up}} STC, troisième {{prize_third}} STC.`,
      en: `Competitive rules of {{tournament_name}}

{{tournament_name}} is a competitive tournament organized by {{organizer}}. Format {{format}}, platform {{platform}}, region {{region}}, country {{country}}. Entrants: {{participant_type}}. Slots: {{max_teams}}. Starts {{start_date}}. Ends {{end_date}}.

A disconnect during a match counts as a loss, unless both sides can show a shared problem. A score is official only with a screenshot or proof the organizer accepts. Disputes go to {{organizer}} before the result window closes. There is no second reschedule.

Entry: {{entry_fee_stc}} STC and {{entry_credits}} credits. Prize pool {{prize_pool}} STC. Winner {{prize_winner}} STC, runner-up {{prize_runner_up}} STC, third place {{prize_third}} STC.`,
    },
  },
  pro_clubs: {
    title: { fr: "Pro Clubs", en: "Pro Clubs" },
    summary: {
      fr: "Nom EA FC identique, effectif du club, président.",
      en: "Matching EA FC name, club squad, president.",
    },
    body: {
      fr: `Règlement Pro Clubs de {{tournament_name}}

{{tournament_name}} est réservé aux clubs. Organisateur : {{organizer}}. Format {{format}} sur {{platform}}, zone {{region}}, pays {{country}}. Places : {{max_teams}}. Début {{start_date}}. Fin {{end_date}}. Type d’inscription : {{participant_type}}.

Seul le président inscrit le club. Le nom EA FC Pro Clubs saisi à l’inscription doit être exactement celui utilisé en jeu. L’effectif qui joue est celui du club. Un club ne peut pas être remplacé après le tirage.

Frais : {{entry_fee_stc}} STC et {{entry_credits}} crédits. Cagnotte {{prize_pool}} STC. Vainqueur {{prize_winner}} STC, finaliste {{prize_runner_up}} STC, troisième {{prize_third}} STC.`,
      en: `Pro Clubs rules of {{tournament_name}}

{{tournament_name}} is for clubs. Organizer: {{organizer}}. Format {{format}} on {{platform}}, region {{region}}, country {{country}}. Slots: {{max_teams}}. Starts {{start_date}}. Ends {{end_date}}. Entry type: {{participant_type}}.

Only the club president can register the club. The EA FC Pro Clubs name entered at registration must be exactly the name used in game. The squad that plays is the club squad. A club cannot be replaced after the draw.

Fee: {{entry_fee_stc}} STC and {{entry_credits}} credits. Prize pool {{prize_pool}} STC. Winner {{prize_winner}} STC, runner-up {{prize_runner_up}} STC, third place {{prize_third}} STC.`,
    },
  },
  prize: {
    title: { fr: "Cagnotte", en: "Prize pool" },
    summary: {
      fr: "Répartition 70 / 20 / 10, pas de remboursement après le tirage.",
      en: "70 / 20 / 10 split, no refund after the draw.",
    },
    body: {
      fr: `Règlement cagnotte de {{tournament_name}}

{{tournament_name}}, organisé par {{organizer}}, joue en {{format}} sur {{platform}}. Zone {{region}}, pays {{country}}. Participants : {{participant_type}}. Places : {{max_teams}}. Début {{start_date}}. Fin {{end_date}}.

Chaque inscription verse {{entry_fee_stc}} STC et {{entry_credits}} crédits. La cagnotte est {{prize_pool}} STC. Elle est répartie ainsi : vainqueur {{prize_winner}} STC (70 %), finaliste {{prize_runner_up}} STC (20 %), troisième {{prize_third}} STC (10 %). Après le tirage, les frais ne sont plus remboursés, y compris en cas de forfait.

Le fair-play de {{tournament_name}} reste obligatoire : pas de triche, pas d’abandon pour protéger une mise.`,
      en: `Prize-pool rules of {{tournament_name}}

{{tournament_name}}, organized by {{organizer}}, is played as {{format}} on {{platform}}. Region {{region}}, country {{country}}. Entrants: {{participant_type}}. Slots: {{max_teams}}. Starts {{start_date}}. Ends {{end_date}}.

Each entry pays {{entry_fee_stc}} STC and {{entry_credits}} credits. The prize pool is {{prize_pool}} STC. It is split as winner {{prize_winner}} STC (70%), runner-up {{prize_runner_up}} STC (20%), third place {{prize_third}} STC (10%). After the draw, fees are not refunded, including a forfeit.

Fair play in {{tournament_name}} still applies: no cheating, and no quit meant to protect a stake.`,
    },
  },
};

const RULES_TEMPLATE_MARKER = /^rules_template:([a-z0-9_]+)$/;

export function normalizeRuleLocale(locale) {
  return String(locale || "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function isTournamentRuleTemplate(templateId) {
  return TOURNAMENT_RULE_TEMPLATE_IDS.includes(templateId);
}

export function encodeRulesTemplate(templateId) {
  return `rules_template:${templateId}`;
}

export function readStoredRulesTemplateId(tournament) {
  if (isTournamentRuleTemplate(tournament?.rules_template_id)) return tournament.rules_template_id;
  const custom = String(tournament?.custom_rules || "").trim();
  const match = custom.match(RULES_TEMPLATE_MARKER);
  if (match && isTournamentRuleTemplate(match[1])) return match[1];
  return null;
}

export function listTournamentRuleTemplates(locale) {
  const lang = normalizeRuleLocale(locale);
  return TOURNAMENT_RULE_TEMPLATE_IDS.map((id) => ({
    id,
    title: TEMPLATES[id].title[lang],
    summary: TEMPLATES[id].summary[lang],
  }));
}

function blank(locale) {
  return MISSING[normalizeRuleLocale(locale)];
}

function formatAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return String(Math.trunc(amount));
}

function formatRuleDate(value, locale) {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim();
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;
  const pad = (part) => String(part).padStart(2, "0");
  const day = pad(parsed.getDate());
  const month = pad(parsed.getMonth() + 1);
  const year = parsed.getFullYear();
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  return normalizeRuleLocale(locale) === "fr"
    ? `${day}/${month}/${year} ${hours}:${minutes}`
    : `${year}-${month}-${day} ${hours}:${minutes}`;
}

function countryLabel(code, countries = []) {
  if (!code) return null;
  const row = (countries || []).find((country) => country.code === code);
  if (!row) return String(code);
  const name = String(row.name).replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return name || String(code);
}

function explicitAmount(value) {
  if (value == null || value === "") return null;
  return formatAmount(value);
}

function ruleVariables(tournament, locale, countries = []) {
  const lang = normalizeRuleLocale(locale);
  const hasEntryFee = tournament?.entry_fee_stc != null && tournament?.entry_fee_stc !== "";
  const prizes = hasEntryFee
    ? calculateTournamentPrizeBreakdown(tournament.entry_fee_stc, tournament?.max_teams)
    : null;
  const formatKey = String(tournament?.type || "");
  const participantKey = String(tournament?.participant_type || "").toLowerCase();
  const organizer = tournament?.creator_gamertag || tournament?.organizer_email || tournament?.creator_email || tournament?.organizer || null;
  const prize = (explicit, calculated) => explicitAmount(explicit) || (prizes ? formatAmount(calculated) : null);
  return {
    tournament_name: String(tournament?.name || "").trim() || null,
    start_date: formatRuleDate(tournament?.start_date, lang),
    end_date: formatRuleDate(tournament?.end_date, lang),
    format: FORMAT_LABELS[lang][formatKey] || (formatKey || null),
    platform: String(tournament?.platform || "").trim() || null,
    region: String(tournament?.region || "").trim() || null,
    country: countryLabel(tournament?.country_code, countries),
    max_teams: tournament?.max_teams == null || tournament?.max_teams === "" ? null : String(tournament.max_teams),
    participant_type: PARTICIPANT_LABELS[lang][participantKey] || (participantKey || null),
    entry_fee_stc: explicitAmount(tournament?.entry_fee_stc),
    entry_credits: explicitAmount(tournament?.entry_credits),
    prize_pool: prize(tournament?.prize_pool_stc, prizes?.pool),
    prize_winner: prize(tournament?.prize_winner_stc, prizes?.winner),
    prize_runner_up: prize(tournament?.prize_runner_up_stc, prizes?.runnerUp),
    prize_third: prize(tournament?.prize_semi_final_stc, prizes?.thirdPlace),
    organizer: organizer ? String(organizer).trim() : null,
  };
}

function fillTemplate(body, values, locale) {
  const missing = blank(locale);
  return String(body).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    if (value == null || String(value).trim() === "") return missing;
    return String(value);
  });
}

function acceptanceLabel(name, locale) {
  const lang = normalizeRuleLocale(locale);
  const label = name || (lang === "fr" ? "ce tournoi" : "this tournament");
  return lang === "fr"
    ? `J'ai lu et j'accepte le règlement de ${label}.`
    : `I have read and accept the rules of ${label}.`;
}

const PRIVATE_TEST_CONFIDENTIALITY = {
  fr: `Confidentialité (tournoi test / cercle privé)
Ce tournoi est un test en cercle privé. Tu ne dois pas en parler à des personnes extérieures. Il se joue uniquement entre les participants invités. Toute divulgation hors de ce cercle est interdite.`,
  en: `Confidentiality (private test tournament)
This tournament is a closed private-circle test. Do not tell people outside the invited group. It is played only among yourselves. Sharing it outside this circle is forbidden.`,
};

export function isPrivateTestTournament(tournament) {
  if (!tournament || typeof tournament !== "object") return false;
  if (tournament.is_test === true || tournament.is_private === true) return true;
  const visibility = String(tournament.visibility || "").trim().toLowerCase();
  if (visibility === "private" || visibility === "test") return true;
  const hay = `${tournament.name || ""} ${tournament.description || ""}`.toLowerCase();
  return /\b(test|testing|beta|privé|prive|private|cercle)\b/.test(hay);
}

function privateTestConfidentiality(locale) {
  return PRIVATE_TEST_CONFIDENTIALITY[normalizeRuleLocale(locale)];
}

function withPrivateTestConfidentiality(body, tournament, locale) {
  const text = String(body || "").trim();
  if (!text || !isPrivateTestTournament(tournament)) return text;
  const clause = privateTestConfidentiality(locale);
  if (text.includes(clause.split("\n")[0])) return text;
  return `${text}\n\n${clause}`;
}

export function renderTournamentRules(templateId, tournament = {}, locale = "en", countries = COUNTRIES) {
  const lang = normalizeRuleLocale(locale);
  const id = isTournamentRuleTemplate(templateId) ? templateId : "standard_cup";
  const template = TEMPLATES[id];
  const values = ruleVariables(tournament, lang, countries);
  return {
    templateId: id,
    title: template.title[lang],
    body: withPrivateTestConfidentiality(
      fillTemplate(template.body[lang], values, lang),
      tournament,
      lang,
    ),
    acceptanceLabel: acceptanceLabel(values.tournament_name, lang),
  };
}

export function resolveTournamentRules(tournament, locale = "en", countries = COUNTRIES) {
  const lang = normalizeRuleLocale(locale);
  const rulesFileUrl = String(tournament?.rules_file_url || "").trim() || null;
  const serverText = String(tournament?.rules_rendered || tournament?.rules_text || "").trim();
  const storedId = readStoredRulesTemplateId(tournament);
  if (serverText) {
    const title = storedId ? TEMPLATES[storedId].title[lang] : (lang === "fr" ? "Règlement" : "Rules");
    return {
      templateId: storedId,
      source: "server",
      title,
      body: withPrivateTestConfidentiality(serverText, tournament, lang),
      rulesFileUrl,
      fileLabel: lang === "fr" ? "Fichier de règlement" : "Rules file",
      acceptanceLabel: acceptanceLabel(String(tournament?.name || "").trim(), lang),
    };
  }
  const custom = String(tournament?.custom_rules || "").trim();
  if (!storedId && custom) {
    return {
      templateId: null,
      source: "custom",
      title: lang === "fr" ? "Règlement" : "Rules",
      body: withPrivateTestConfidentiality(custom, tournament, lang),
      rulesFileUrl,
      fileLabel: lang === "fr" ? "Fichier de règlement" : "Rules file",
      acceptanceLabel: acceptanceLabel(String(tournament?.name || "").trim(), lang),
    };
  }
  const rendered = renderTournamentRules(storedId || "standard_cup", tournament, lang, countries);
  return {
    ...rendered,
    source: storedId ? "template" : "default",
    rulesFileUrl,
    fileLabel: lang === "fr" ? "Fichier de règlement" : "Rules file",
  };
}

export function applyStoredTournamentRules(body = {}) {
  const chosen = isTournamentRuleTemplate(body.rules_template_id)
    ? body.rules_template_id
    : readStoredRulesTemplateId({ custom_rules: body.custom_rules });
  if (!chosen) {
    return {
      rules_template_id: null,
      custom_rules: body.custom_rules == null ? null : body.custom_rules,
    };
  }
  return {
    rules_template_id: chosen,
    custom_rules: encodeRulesTemplate(chosen),
  };
}

export function registrationRulesError(tournament, body = {}) {
  if (body.rules_accepted !== true) {
    return "Accept the tournament rules before registering.";
  }
  const stored = readStoredRulesTemplateId(tournament);
  const raw = body.rules_template_id;
  const sent = raw == null || String(raw).trim() === "" ? null : String(raw).trim();
  if (stored && sent !== stored) {
    return "These rules are out of date. Reload the tournament and accept the current rules.";
  }
  return null;
}

export function assertRulesAcceptance({
  rulesAccepted,
  rules_accepted: rulesAcceptedSnake,
  rulesTemplateId,
  rules_template_id: rulesTemplateSnake,
  tournament,
} = {}) {
  const accepted = rulesAccepted === true || rulesAcceptedSnake === true;
  if (!accepted) {
    throw new Error("Accept the tournament rules before registering.");
  }
  const stored = readStoredRulesTemplateId(tournament);
  const sent = rulesTemplateId || rulesTemplateSnake || null;
  if (stored && sent && sent !== stored) {
    throw new Error("These rules are out of date. Reload the tournament and accept the current rules.");
  }
  return {
    rules_accepted: true,
    rules_template_id: stored || sent || null,
  };
}
