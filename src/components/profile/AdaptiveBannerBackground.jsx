import { useEffect, useState } from "react";
import { getBannerStyle, resolveBannerFillSize } from "@/lib/storeItems";
import { cn } from "@/lib/utils";

/**
 * Full-bleed profile banner layer.
 * Wide banner images fill the slot; narrow/small photos are scaled up with
 * `cover` so they take the screen width instead of sitting as a tiny center crop.
 */
export default function AdaptiveBannerBackground({
  bannerUrl,
  bannerPosition,
  bannerZoom,
  className,
  style,
}) {
  const base = getBannerStyle(bannerUrl, bannerPosition, bannerZoom);
  const [fillSize, setFillSize] = useState(
    base.backgroundSize || "cover"
  );

  useEffect(() => {
    if (!base.backgroundImage || !bannerUrl) {
      setFillSize(base.backgroundSize || "cover");
      return undefined;
    }

    const zoomNum = Number(bannerZoom);
    if (Number.isFinite(zoomNum) && zoomNum > 0) {
      setFillSize(`${zoomNum}%`);
      return undefined;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setFillSize(resolveBannerFillSize(img.naturalWidth, img.naturalHeight, bannerZoom));
    };
    img.onerror = () => {
      if (!cancelled) setFillSize("cover");
    };
    img.src = bannerUrl;
    return () => {
      cancelled = true;
    };
  }, [bannerUrl, bannerZoom, base.backgroundImage, base.backgroundSize]);

  if (!base.backgroundImage) {
    return <div className={cn("absolute inset-0", className)} style={{ ...base, ...style }} />;
  }

  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{
        ...base,
        backgroundSize: fillSize,
        backgroundPosition: bannerPosition || base.backgroundPosition || "50% 50%",
        ...style,
      }}
    />
  );
}
