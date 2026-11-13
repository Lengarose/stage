// Never render supplied HTML or use an arbitrary URL as an iframe source.
export function standsStream(url, hostname) {
  try {
    const u = new URL(url), host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    if (host === 'twitch.tv' && /^\/[a-zA-Z0-9_]+\/?$/.test(u.pathname)) return { name: 'Twitch', embed: `https://player.twitch.tv/?channel=${encodeURIComponent(u.pathname.split('/')[1])}&parent=${encodeURIComponent(hostname)}&autoplay=false`, minimumWidth: 400 };
    const video = host === 'youtu.be' ? u.pathname.slice(1) : ['youtube.com','m.youtube.com'].includes(host) ? u.searchParams.get('v') || u.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1] : null;
    if (video && /^[\w-]{11}$/.test(video)) return { name: 'YouTube', embed: `https://www.youtube.com/embed/${video}?autoplay=0`, minimumWidth: 200 };
    return { name: host === 'kick.com' ? 'Kick' : 'the streaming provider', embed: null, minimumWidth: 0 };
  } catch { return null; }
}
