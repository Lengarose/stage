import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DiscordMark from "@/components/community/DiscordMark";
import { DISCORD_INVITE_URL, DISCORD_SERVER_ID, discordWidgetSrc } from "@/lib/discordConfig";
import { openDiscordInvite } from "@/lib/discordJoin";

/**
 * Discord returns 403 + code 50004 when the server widget is disabled in Server Settings.
 * The iframe still loads but spins forever — we probe widget.json first.
 */
async function checkWidgetAvailable(serverId) {
  if (!serverId) return { ok: false, reason: "no_id" };
  try {
    const res = await fetch(`https://discord.com/api/guilds/${encodeURIComponent(serverId)}/widget.json`);
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    if (body.code === 50004) return { ok: false, reason: "disabled" };
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export default function DiscordWidget({ theme = "dark", className = "", compact = false }) {
  const src = discordWidgetSrc(theme);
  const minH = compact ? "min-h-[200px]" : "min-h-[320px]";
  const iframeH = compact ? 300 : 500;
  const [status, setStatus] = useState(/** @type {'loading' | 'ready' | 'disabled' | 'error'} */ ("loading"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkWidgetAvailable(DISCORD_SERVER_ID);
      if (cancelled) return;
      if (result.ok) setStatus("ready");
      else if (result.reason === "disabled") setStatus("disabled");
      else setStatus("error");
    })();
    return () => { cancelled = true; };
  }, []);

  if (!src) return null;

  if (status === "loading") {
    return (
      <div className={cn("flex items-center justify-center bg-[#2f3136] text-white/50 text-sm", minH, className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#5865F2] animate-pulse" />
            <span className="w-2 h-2 rounded-sm bg-[#5865F2] animate-pulse [animation-delay:150ms]" />
          </div>
          <span>Checking Discord server…</span>
        </div>
      </div>
    );
  }

  if (status === "disabled" || status === "error") {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-[#2f3136] p-6 text-center", minH, className)}>
        <DiscordMark className="w-12 h-12 text-[#5865F2] mb-4 opacity-80" />
        <p className="text-white font-semibold text-sm mb-2">
          {status === "disabled" ? "Discord widget is turned off" : "Could not load server preview"}
        </p>
        <p className="text-white/50 text-xs leading-relaxed max-w-xs mb-4">
          {status === "disabled" ? (
            <>
              In Discord: <strong className="text-white/70">Server Settings → Widget</strong> → turn on{" "}
              <strong className="text-white/70">Enable Server Widget</strong>, then refresh this page.
              Your invite link still works below.
            </>
          ) : (
            "Use the Join Discord button — the preview is optional."
          )}
        </p>
        {DISCORD_INVITE_URL && (
          <Button
            type="button"
            onClick={() => openDiscordInvite(DISCORD_INVITE_URL)}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white gap-2"
          >
            <DiscordMark className="w-4 h-4" />
            Join Discord
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <iframe
      src={src}
      title="Discord Server"
      className={className}
      width="100%"
      height={iframeH}
      allowTransparency
      frameBorder="0"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
    />
  );
}
