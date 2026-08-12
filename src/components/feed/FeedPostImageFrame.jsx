import { getPostImageStyle } from "@/lib/feedMedia";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  thumbnail: "w-full h-full",
  preview: "w-44 h-44 sm:w-52 sm:h-52",
  card: "w-full max-h-96 aspect-square",
  modal: "w-full aspect-square max-h-[60vh] md:max-h-[86vh]",
};

export default function FeedPostImageFrame({
  post,
  src,
  alt = "",
  variant = "thumbnail",
  className,
}) {
  const imageSrc = src || post?.media_url;
  if (!imageSrc) return null;

  return (
    <div className={cn("relative overflow-hidden bg-secondary", SIZE_CLASS[variant], className)}>
      <img
        src={imageSrc}
        alt={alt}
        className="w-full h-full object-cover will-change-transform"
        style={getPostImageStyle(post)}
      />
    </div>
  );
}
