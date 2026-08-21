import { stageClient } from "@/api/stageClient";
import { asObjectArray } from "@/lib/safeData";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_MAX_PAGES = 40;

export async function loadPlayerDirectoryPages({
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, 100));
  const safeMaxPages = Math.max(1, Math.min(Number(maxPages) || DEFAULT_MAX_PAGES, 100));
  const byId = new Map();

  for (let page = 1; page <= safeMaxPages; page += 1) {
    const rows = asObjectArray(
      await stageClient.entities.Player.filter({ page }, null, safePageSize).catch(() => [])
    );
    rows.forEach((player) => {
      if (player?.id) byId.set(player.id, player);
    });
    if (rows.length < safePageSize) break;
  }

  return [...byId.values()];
}
