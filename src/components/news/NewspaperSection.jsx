import { useEffect, useMemo, useState } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import NewsPaperFront from "@/components/news/NewsPaperFront";
import { isNewspaperVisible, matchesNewsSection, mergeNewspaperFeed } from "@/lib/newsPaper";

export default function NewspaperSection({
  section = "all",
  featuredId = "",
  empty = "Nothing here yet.",
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      let player = null;
      let club = null;
      try {
        const resolved = await resolveMyPlayerAndClub();
        player = resolved.player;
        club = resolved.club;
      } catch {
        /* public paper still loads */
      }
      const news = await stageClient.entities.NewsItem.list("-published_at", 100).catch(() => []);
      if (!alive) return;
      setItems(mergeNewspaperFeed(news).filter((item) => isNewspaperVisible(item, player, club)));
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(
    () => items.filter((item) => matchesNewsSection(item, section)),
    [items, section],
  );
  const featured = filtered.find((item) => (
    String(item.id) === String(featuredId)
    || String(item.transfer_id || "") === String(featuredId)
  )) || filtered[0] || null;
  const rest = filtered.filter((item) => item !== featured);

  if (loading) {
    return <p className="mercato-loading">Opening the paper…</p>;
  }

  return <NewsPaperFront featured={featured} rest={rest} empty={empty} />;
}
