export function buildClubTabGroups({
  t,
  canSeeAvailability = false,
  canOpenClubOffice = false,
  showChat = false,
} = {}) {
  const groups = [
    { label: t("commonPages.profTab_posts"), tabs: ["posts"] },
    { label: t("nav.squad"), tabs: ["squad"] },
    { label: "Stats", tabs: ["stats"] },
    { label: "Fixtures", tabs: ["fixtures"] },
    { label: t("commonPages.profTab_trophies"), tabs: ["trophies"] },
  ];

  if (showChat) {
    groups.push({ label: t("commonPages.cdChat"), tabs: ["chat"] });
  }

  if (canSeeAvailability) {
    groups.push({ label: "Availability", tabs: ["availability"] });
  }

  if (canOpenClubOffice) {
    groups.push({
      label: "Club Office",
      tabs: ["club-office"],
    });
  }

  return groups;
}

export function clubTabLabels(t) {
  return {
    posts: t("commonPages.profTab_posts"),
    squad: t("nav.squad"),
    stats: "Stats",
    fixtures: "Fixtures",
    chat: t("commonPages.cdChat"),
    availability: "Availability",
    "club-office": "Club Office",
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
