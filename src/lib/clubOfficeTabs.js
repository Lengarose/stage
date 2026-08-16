export function buildClubTabGroups({
  t,
  canOpenOperations = false,
  isOwner = false,
  showRequests = false,
  limitedTournamentId = null,
} = {}) {
  const groups = [
    { label: t("commonPages.profTab_posts"), tabs: ["posts"] },
    { label: t("nav.squad"), tabs: ["squad"] },
    { label: t("commonPages.cdChat"), tabs: ["chat"] },
    { label: t("commonPages.profTab_trophies"), tabs: ["trophies"] },
    { label: t("commonPages.cdHistory"), tabs: ["history"] },
  ];

  if (canOpenOperations) {
    groups.push({ label: t("commonPages.profOperations"), tabs: ["operations"] });
  }

  if (showRequests && !limitedTournamentId) {
    groups.push({ label: t("commonPages.profJoinRequests"), tabs: ["requests"] });
  }

  if (isOwner && !limitedTournamentId) {
    groups.push({
      label: t("commonPages.cdClubOffice"),
      tabs: ["stadium", "contracts", "finance", "shirts"],
    });
  }

  return groups;
}

export function clubTabLabels(t) {
  return {
    posts: t("commonPages.profTab_posts"),
    squad: t("nav.squad"),
    chat: t("commonPages.cdChat"),
    trophies: t("commonPages.profTab_trophies"),
    history: t("commonPages.cdHistory"),
    operations: t("commonPages.profOperations"),
    requests: t("commonPages.profJoinRequests"),
    stadium: t("commonPages.cdStadium"),
    contracts: t("commonPages.contracts"),
    finance: t("commonPages.cdFinance"),
    shirts: t("commonPages.cdShirts"),
  };
}
