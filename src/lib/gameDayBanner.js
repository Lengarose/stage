export const GAME_DAY_BANNER_DESCRIPTION = "Arrange matches, follow live streams and chat with your opponents. Your matchday starts here.";

export function getGameDayBannerSlides(config) {
  const slides = Array.isArray(config?.banner_slides) ? config.banner_slides : [];
  const source = slides.length ? slides : config?.banner_url ? [{
    url: config.banner_url,
    position: config.banner_position,
    zoom: config.banner_zoom,
  }] : [];
  return source.filter(slide => typeof slide?.url === "string" && slide.url.trim()).map(slide => ({
    url: slide.url.trim(),
    position: slide.position || "50% 50%",
    zoom: Number.isFinite(Number(slide.zoom)) && Number(slide.zoom) > 0 ? Number(slide.zoom) : null,
  }));
}

export function getGameDayBannerInterval(config) {
  const seconds = Number(config?.banner_interval_seconds);
  return (Number.isFinite(seconds) && seconds >= 3 && seconds <= 30 ? seconds : 6) * 1000;
}
