import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import "./identityAvatar.css";

/** Shared circular portrait for compact identities. Full profile/editor frames stay independent. */
export default function IdentityAvatar({ src, alt = "", name, className, style, position, zoom, onError, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const imageStyle = { ...style, objectPosition: position || style?.objectPosition || "50% 50%" };
  const scale = Number(zoom);
  if (Number.isFinite(scale) && scale > 0) {
    imageStyle.transform = `scale(${scale / 100})`;
    imageStyle.transformOrigin = imageStyle.objectPosition;
  }
  return (
    <span {...props} className={cn("identity-avatar w-10", className)} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <span className="identity-avatar__crop">
        {src && failedSrc !== src ? <img src={src} alt="" style={imageStyle} onError={event => { setFailedSrc(src); onError?.(event); }} />
          : <span className="identity-avatar__fallback" aria-hidden="true">{name ? String(name).trim().slice(0, 2).toUpperCase() : <UserRound className="h-1/2 w-1/2" />}</span>}
      </span>
      <span className="identity-avatar__surface" aria-hidden="true" />
    </span>
  );
}
