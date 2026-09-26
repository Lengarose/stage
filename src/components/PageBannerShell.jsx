import { cn } from "@/lib/utils";
import { PAGE_BANNER_HEIGHT_CLASS } from "@/lib/pageBanner";

/**
 * Shared page layout for full-width banners:
 * 1) banner scrolls away
 * 2) dock sticks under the app header
 * 3) further scroll happens inside the dock
 * 4) scroll-up at dock top brings the banner back
 *
 * Requires a full-bleed parent with a bounded height (see Layout banner routes).
 */
export default function PageBannerShell({
  banner,
  children,
  className,
  bannerClassName,
  dockClassName,
  /** When false, children manage their own overflow (Transfer Room / GameDay). */
  dockScroll = true,
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
        className
      )}
    >
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden",
          PAGE_BANNER_HEIGHT_CLASS,
          bannerClassName
        )}
      >
        {banner}
      </div>

      <div
        className={cn(
          "sticky top-0 z-10 flex h-full min-h-0 shrink-0 flex-col",
          dockClassName
        )}
      >
        {dockScroll ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
