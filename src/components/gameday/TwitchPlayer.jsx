/**
 * TwitchPlayer — renders a Twitch live stream via iframe embed.
 * https://dev.twitch.tv/docs/embed/video-and-clips/
 * The `parent` param must be the hostname (no protocol, no trailing slash).
 */
export default function TwitchPlayer({ channel }) {
  if (!channel) return null;

  const parent = window.location.hostname;
  const src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=false`;

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-border bg-black"
      style={{ aspectRatio: "16/9" }}
    >
      <iframe
        src={src}
        width="100%"
        height="100%"
        allowFullScreen
        allow="autoplay; fullscreen"
        style={{ display: "block", border: "none" }}
        title={`Twitch: ${channel}`}
      />
    </div>
  );
}