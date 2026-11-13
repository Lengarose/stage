import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// The same 4:5 straight frame and saved crop used by club/player profile photos.
export default function SchedulePortrait({ image, photo, className }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const position = photo?.position || (photo?.isClub ? "50% 50%" : "50% 20%");
  const zoom = Number(photo?.zoom);
  return (
    <span className={cn("relative inline-flex aspect-[4/5] w-6 shrink-0 items-center justify-center overflow-hidden rounded-none border border-cyan-300/40 bg-secondary shadow-[0_0_12px_-5px_rgba(0,229,255,0.7)]", className)}>
      {image && !failed ? <img src={image} alt="" onError={() => setFailed(true)}
        className="h-full w-full object-cover"
        style={{ objectPosition: position, transformOrigin: position, transform: Number.isFinite(zoom) && zoom > 0 ? `scale(${zoom / 100})` : undefined }} />
        : <Shield aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />}
    </span>
  );
}
