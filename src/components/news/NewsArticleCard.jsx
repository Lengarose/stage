import { Link } from "react-router-dom";
import { CATEGORY_CONFIG, timeAgo } from "@/pages/News";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatTransferFee,
  newsStoryImage,
  storyByline,
  toNewspaperHeadline,
} from "@/lib/newsPaper";

export default function NewsArticleCard({ item, variant = "brief" }) {
  const { t } = useTranslation();
  const cat = CATEGORY_CONFIG[item._category] || CATEGORY_CONFIG.general;
  const image = newsStoryImage(item);
  const headline = toNewspaperHeadline(item.title);
  const fee = formatTransferFee(item.transfer_fee_stc);
  const byline = storyByline(item);
  const kicker = t(`commonPages.${cat.labelKey}`);
  const meta = [byline, fee, timeAgo(item.published_at)].filter(Boolean).join("  ·  ");

  if (variant === "secondary") {
    const inner = (
      <>
        <p className="news-paper-kicker-story">{kicker}</p>
        {image ? (
          <div className="news-paper-photo news-paper-photo--landscape">
            <img src={image} alt={item.player_name || headline} loading="lazy" />
          </div>
        ) : null}
        <h3>{headline}</h3>
        {item.body ? <p>{item.body}</p> : null}
        <p className="news-paper-meta">{meta}</p>
      </>
    );

    if (item.link) return <Link to={item.link} className="news-paper-secondary">{inner}</Link>;
    return <article className="news-paper-secondary">{inner}</article>;
  }

  const inner = (
    <>
      {image ? (
        <div className="news-paper-thumb">
          <img src={image} alt={item.player_name || headline} loading="lazy" />
        </div>
      ) : null}
      <div>
        <p className="news-paper-kicker-story">{kicker}</p>
        <h3>{headline}</h3>
        {item.body ? <p>{item.body}</p> : null}
        <p className="news-paper-meta">{meta}</p>
      </div>
    </>
  );

  const className = image ? "news-paper-brief" : "news-paper-brief news-paper-brief--text";
  if (item.link) return <Link to={item.link} className={className}>{inner}</Link>;
  return <article className={className}>{inner}</article>;
}
