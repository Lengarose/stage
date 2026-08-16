import { timeAgo } from "@/pages/News";
import { newsStoryImage, toNewspaperHeadline } from "@/lib/newsPaper";

export default function PressArticleCard({ item, compact = false, variant }) {
  const image = newsStoryImage(item);
  const headline = toNewspaperHeadline(item.title);
  const quote = item.quotes?.[0];
  const caption = [item.player_name, item.club_name].filter(Boolean).join("  —  ");
  const meta = [quote?.outlet || quote?.reporter_name, timeAgo(item.published_at)]
    .filter(Boolean)
    .join("  ·  ");
  const layout = variant || (compact ? "brief" : "splash");
  const body = quote?.answer ? `“${quote.answer}”` : item.body;

  if (layout === "splash") {
    return (
      <article className="news-paper-splash">
        {image ? (
          <div className="news-paper-splash-media">
            <img src={image} alt={item.player_name || headline} />
            <span className="news-paper-ink-stamp">Press Room</span>
          </div>
        ) : (
          <span className="news-paper-ink-stamp">Press Room</span>
        )}
        <div className="news-paper-splash-copy">
          <h2 className="news-paper-headline">{headline}</h2>
          {body ? <p className="news-paper-dek">{body}</p> : null}
          {caption ? <p className="news-paper-caption">{caption}</p> : null}
          <p className="news-paper-meta">{meta}</p>
        </div>
      </article>
    );
  }

  if (layout === "secondary") {
    return (
      <article className="news-paper-secondary">
        <p className="news-paper-kicker-story">Press Room</p>
        {image ? (
          <div className="news-paper-photo news-paper-photo--landscape">
            <img src={image} alt={item.player_name || headline} loading="lazy" />
          </div>
        ) : null}
        <h3>{headline}</h3>
        {quote?.answer ? <p className="news-paper-quote">“{quote.answer}”</p> : item.body ? <p>{item.body}</p> : null}
        {caption ? <p className="news-paper-caption">{caption}</p> : null}
        <p className="news-paper-meta">{meta}</p>
      </article>
    );
  }

  return (
    <article className={image ? "news-paper-brief" : "news-paper-brief news-paper-brief--text"}>
      {image ? (
        <div className="news-paper-thumb">
          <img src={image} alt={item.player_name || headline} loading="lazy" />
        </div>
      ) : null}
      <div>
        <p className="news-paper-kicker-story">Press Room</p>
        <h3>{headline}</h3>
        {quote?.answer ? <p className="news-paper-quote">“{quote.answer}”</p> : item.body ? <p>{item.body}</p> : null}
        <p className="news-paper-meta">{meta}</p>
      </div>
    </article>
  );
}
