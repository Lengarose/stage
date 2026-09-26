/**
 * Missing admin UI labels — merged after base adminTranslations so wired
 * components stop showing raw keys like admin.leagues.club.
 */
const adminLabelPatchesEn = {
  sections: {
    matchArchive: "Match Archive",
    identityClaims: "Identity Claims",
    identityRepair: "Identity Repair",
    gost: "GOST",
  },
  nav: {
    gost: "GOST",
  },
  trophies: {
    selectCompetition: "— select competition —",
    selectLeague: "— select league —",
  },
  dialogs: {
    reasonOptional: "Reason (optional)",
  },
  disputes: {
    home: "Home",
    away: "Away",
    resolve: "Resolve",
  },
  economy: {
    checking: "Checking…",
    healthCheckFailed: "Health check failed",
    healthCheckTitle: "Economy health",
    runCheck: "Run check",
    tabs: {
      audit: "Audit",
      club: "Club",
      health: "Health",
      player: "Player",
      transactions: "Transactions",
    },
  },
  leagues: {
    actions: "Actions",
    all: "All",
    club: "Club",
    competitionSeason: "Competition season",
    div1Qualification: "Div 1 qualification",
    maxClubs: "Max clubs",
    platform: "Platform",
    processing: "Processing…",
    promotedSlots: "Promoted slots",
    qualificationEditHint: "Edit qualification slots for this region.",
    region: "Region",
    regionalLeague: "Regional league",
    seedCompetitionsFirst: "Seed competitions first",
    selectLeague: "Select league",
    waitlist: "Waitlist",
  },
  matchArchive: {
    cancel: "Cancel",
    correctFailed: "Could not correct the score.",
    correctScore: "Correct the score",
    correctedStamp: "Score corrected by an admin on {date}",
    correctionReason: "Reason (required)",
    correctionReasonPlaceholder: "What did the proof show?",
    correctionScope: "This only changes the official score. It does not settle, reverse or re-settle the wager, and rankings update on the next full recalculation.",
    newAwayScore: "New away score",
    newHomeScore: "New home score",
    saveCorrection: "Save correction",
  },
  news: {
    categories: {
      tournament: "Tournament",
    },
  },
  players: {
    credits: "Credits",
    deleteAccount: "Delete account",
    deleting: "Deleting...",
    kick: "Kick",
    noClub: "No Club",
    proof: "Proof",
  },
  rankings: {
    global: "Global",
  },
  transfers: {
    closed: "Closed",
    loadFailed: "Could not load transfers.",
    open: "Open",
  },
  seasonStatus: {
    draft: "Draft",
    open: "Open",
    registration: "Registration",
    in_progress: "In progress",
    inprogress: "In progress",
    completed: "Completed",
    archived: "Archived",
    cancelled: "Cancelled",
  },
};

const adminLabelPatchesFr = {
  nav: {
    gost: "GOST",
  },
  trophies: {
    selectCompetition: "— sélectionner une compétition —",
    selectLeague: "— sélectionner une ligue —",
  },
  sections: {
    matchArchive: "Archive des matchs",
    identityClaims: "Demandes d'identité",
    identityRepair: "Réparation d'identité",
    gost: "GOST",
  },
  dialogs: {
    reasonOptional: "Motif (optionnel)",
  },
  disputes: {
    home: "Domicile",
    away: "Extérieur",
    resolve: "Résoudre",
  },
  economy: {
    checking: "Vérification…",
    healthCheckFailed: "Échec du contrôle santé",
    healthCheckTitle: "Santé économie",
    runCheck: "Lancer le contrôle",
    tabs: {
      audit: "Audit",
      club: "Club",
      health: "Santé",
      player: "Joueur",
      transactions: "Transactions",
    },
  },
  leagues: {
    actions: "Actions",
    all: "Tout",
    club: "Club",
    competitionSeason: "Saison de compétition",
    div1Qualification: "Qualification Div 1",
    maxClubs: "Clubs max",
    platform: "Plateforme",
    processing: "Traitement…",
    promotedSlots: "Places de promotion",
    qualificationEditHint: "Modifier les places de qualification pour cette région.",
    region: "Région",
    regionalLeague: "Ligue régionale",
    seedCompetitionsFirst: "Initialisez d'abord les compétitions",
    selectLeague: "Sélectionner une ligue",
    waitlist: "Liste d'attente",
  },
  matchArchive: {
    cancel: "Annuler",
    correctFailed: "Impossible de corriger le score.",
    correctScore: "Corriger le score",
    correctedStamp: "Score corrigé par un admin le {date}",
    correctionReason: "Motif (obligatoire)",
    correctionReasonPlaceholder: "Que montrait la preuve ?",
    correctionScope: "Cela ne change que le score officiel. Cela ne règle, n'annule ni ne re-règle le pari, et les classements se mettent à jour au prochain recalcul complet.",
    newAwayScore: "Nouveau score extérieur",
    newHomeScore: "Nouveau score domicile",
    saveCorrection: "Enregistrer la correction",
  },
  news: {
    categories: {
      tournament: "Tournoi",
    },
  },
  players: {
    credits: "Crédits",
    deleteAccount: "Supprimer le compte",
    deleting: "Suppression...",
    kick: "Expulser",
    noClub: "Aucun club",
    proof: "Preuve",
  },
  rankings: {
    global: "Global",
  },
  transfers: {
    closed: "Fermé",
    loadFailed: "Impossible de charger les transferts.",
    open: "Ouvert",
  },
  seasonStatus: {
    draft: "Brouillon",
    open: "Ouvert",
    registration: "Inscriptions",
    in_progress: "En cours",
    inprogress: "En cours",
    completed: "Terminé",
    archived: "Archivé",
    cancelled: "Annulé",
  },
};

function mergeDeep(base, ext) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(ext || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = mergeDeep(out[k] && typeof out[k] === "object" ? out[k] : {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function applyAdminLabelPatches(translations, lang) {
  // Admin UI is authored in EN/FR; other locales fall back to English patches
  // so missing keys never surface as raw admin.* paths.
  const patch = lang === "fr" ? adminLabelPatchesFr : adminLabelPatchesEn;
  return mergeDeep(translations, patch);
}
