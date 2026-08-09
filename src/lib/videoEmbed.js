/**
 * Turns a pasted video URL into something an <iframe> can play.
 *
 * Returns `null` for anything it does not positively recognise — that is the
 * normal, expected outcome, not an error. Callers are expected to fall back to a
 * plain clickable link, because we can neither control nor predict what people
 * paste (private Drive files, expiring share links, hosts we've never seen).
 * "I don't know how to embed this" must always degrade to "here's the link".
 *
 * Only https URLs on an exact-matched host are ever accepted, so a `javascript:`
 * payload or a lookalike domain can't reach an iframe `src`.
 *
 * IMPORTANT for callers: a non-null result means "worth *trying* to embed", not
 * "will definitely play". Whether a Drive or OneDrive file is actually viewable
 * depends on the owner's sharing settings, which are invisible from the URL — and
 * a cross-origin iframe gives us no reliable way to detect that it rendered a
 * permission wall instead of a video (an error page is still a successful load,
 * so no `error` event fires). Callers must therefore keep the plain link visible
 * alongside the player rather than treating the embed as a replacement for it.
 */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const DRIVE_HOSTS = new Set(["drive.google.com"]);

const ONEDRIVE_HOSTS = new Set(["onedrive.live.com", "1drv.ms"]);

const PROVIDER_LABELS = {
  youtube: "YouTube",
  drive: "Google Drive",
  onedrive: "OneDrive",
};

// A YouTube id is 11 chars of [A-Za-z0-9_-]; anything else is not an id.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
// Drive file ids share that alphabet but vary in length.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,128}$/;

function parseUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // https only: an http iframe is blocked as mixed content on our HTTPS origin,
  // which would render a blank frame. Rejecting it here means the caller shows a
  // working link instead of an empty box.
  if (url.protocol !== "https:") return null;
  return url;
}

function youtubeIdFrom(url) {
  const host = url.hostname.toLowerCase();
  // Short form: the id is the whole path.
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID.test(id) ? id : null;
  }
  // Watch form: ?v=<id>
  const fromQuery = url.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;
  // Path forms: /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && ["embed", "shorts", "live", "v"].includes(segments[0])) {
    return YOUTUBE_ID.test(segments[1]) ? segments[1] : null;
  }
  return null;
}

function driveIdFrom(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  // Anchored on the real share shape: /file/d/<id>/... — not just any "d" segment.
  if (segments[0] === "file" && segments[1] === "d" && segments[2]) {
    return DRIVE_ID.test(segments[2]) ? segments[2] : null;
  }
  // /open?id=<id>
  const fromQuery = url.searchParams.get("id");
  if (fromQuery && DRIVE_ID.test(fromQuery)) return fromQuery;
  return null;
}

/**
 * @param {unknown} value a URL someone pasted
 * @returns {{provider: string, label: string, embedUrl: string} | null}
 *          null means "not embeddable — show a link instead"
 */
export function resolveVideoEmbed(value) {
  const url = parseUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeIdFrom(url);
    if (!id) return null;
    // youtube-nocookie serves the same player without setting tracking cookies.
    return {
      provider: "youtube",
      label: PROVIDER_LABELS.youtube,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (DRIVE_HOSTS.has(host)) {
    const id = driveIdFrom(url);
    if (!id) return null;
    return {
      provider: "drive",
      label: PROVIDER_LABELS.drive,
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    };
  }

  if (ONEDRIVE_HOSTS.has(host)) {
    // OneDrive has two link shapes and each embeds differently:
    //   onedrive.live.com/...?cid=..&id=..  -> the /embed endpoint, same params
    //   1drv.ms/v/s!Abc  (short share link) -> same URL with embed=1
    const embedded = new URL(url.href);
    if (host === "1drv.ms") {
      embedded.searchParams.set("embed", "1");
    } else if (!embedded.pathname.startsWith("/embed")) {
      embedded.pathname = "/embed";
    }
    return { provider: "onedrive", label: PROVIDER_LABELS.onedrive, embedUrl: embedded.href };
  }

  return null;
}
