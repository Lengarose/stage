import NewsArticleCard from "@/components/news/NewsArticleCard";
import NewsFeaturedCard from "@/components/news/NewsFeaturedCard";
import PressArticleCard from "@/components/news/PressArticleCard";

export default function NewsPaperFront({ featured, rest = [], empty = "Nothing here yet." }) {
  if (!featured) {
    return <p className="mercato-empty-detail">{empty}</p>;
  }

  return (
    <div className={`news-paper-front${rest.length === 0 ? " news-paper-front--solo" : ""}`}>
      <div className="news-paper-gutter news-paper-gutter--splash">
        {featured._category === "press_conference"
          ? <PressArticleCard item={featured} />
          : <NewsFeaturedCard item={featured} />}
      </div>
      {rest.length > 0 ? (
        <aside className="news-paper-gutter news-paper-gutter--rail">
          {rest.map((item) => (
            item._category === "press_conference"
              ? <PressArticleCard key={item.id} item={item} compact />
              : <NewsArticleCard key={item.id} item={item} />
          ))}
        </aside>
      ) : null}
    </div>
  );
}
