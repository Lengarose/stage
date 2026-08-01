const TRANSFER_WINDOW_NAV_PATHS = new Set([
  "/transfer-market",
  "/contracts/create",
]);

export function canShowTransferNav(windowOpen) {
  return windowOpen === true;
}

export function canCreateContractOffer(windowOpen) {
  return windowOpen === true;
}

export function getTransferWindowIndicatorLabel(windowOpen) {
  return windowOpen === true ? "Transfer window open" : null;
}

export function filterTransferWindowNavGroups(groups = [], windowOpen) {
  if (canShowTransferNav(windowOpen)) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => {
        if (TRANSFER_WINDOW_NAV_PATHS.has(item.path)) return false;
        return !String(item.path || "").startsWith("/contracts/create");
      }),
    }))
    .filter((group) => group.items.length > 0);
}
