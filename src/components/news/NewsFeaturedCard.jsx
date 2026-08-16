import { Link } from "react-router-dom";
import { CATEGORY_CONFIG, timeAgo } from "@/pages/News";
import { useTranslation } from "@/hooks/useTranslation";
import {
  formatTransferFee,
  newsStoryImage,
  storyByline,
  toNewspaperHeadline,
} from "@/lib/newsPaper";

export default function NewsFeaturedCard({ item }) {
  const { t } = useTranslation();
  const cat = CATEGORY_CONFIG[item._category] || CATEGORY_CONFIG.general;
  const image = newsStoryImage(item);
  const headline = toNewspaperHeadline(item.title);
  const fee = formatTransferFee(item.transfer_fee_stc);
  const byline = storyByline(item);
  const photoPosition = item.photo_position || "50% 18%";

  const inner = (
    <>
      {image ? (
        <div className="news-paper-splash-media">
          <img
            src={image}
            alt={item.player_name || headline}
            style={{ objectPosition: photoPosition }}
          />
          <span className="news-paper-ink-stamp">{t(`commonPages.${cat.labelKey}`)}</span>
          {fee ? <span className="news-paper-fee-stamp">{fee}</span> : null}
        </div>
      ) : (
        <span className="news-paper-ink-stamp">{t(`commonPages.${cat.labelKey}`)}</span>
      )}
      <div className="news-paper-splash-copy">
        <h2 className="news-paper-headline">{headline}</h2>
        {item.body ? <p className="news-paper-dek">{item.body}</p> : null}
        <p className="news-paper-meta">
          {[byline, fee, timeAgo(item.published_at)].filter(Boolean).join("  ·  ")}
        </p>
      </div>
    </>
  );

  if (item.link) return <Link to={item.link} className="news-paper-splash">{inner}</Link>;
  return <article className="news-paper-splash">{inner}</article>;
}
