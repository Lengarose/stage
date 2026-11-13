import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { GAME_DAY_BANNER_DESCRIPTION, getGameDayBannerInterval, getGameDayBannerSlides } from "@/lib/gameDayBanner";

export default function GameDayBanner({ config, children }) {
  const slides = getGameDayBannerSlides(config);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const slideKey = JSON.stringify(slides);
  const interval = getGameDayBannerInterval(config);
  const currentIndex = activeIndex % (slides.length || 1);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => { setActiveIndex(0); }, [slideKey]);

  useEffect(() => {
    if (slides.length < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveIndex(index => (index + 1) % slides.length);
    }, interval);
    return () => window.clearInterval(timer);
  }, [slides.length, slideKey, interval, paused, hovered, focused, reducedMotion, currentIndex]);

  return (
    <section
      aria-labelledby="gameday-title"
      aria-roledescription={slides.length > 1 ? "carousel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className="relative flex min-h-[248px] w-full shrink-0 flex-col overflow-hidden border-b border-[#d8dee8]/30 bg-[#07070b] sm:min-h-[298px] xl:min-h-[328px]"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(110deg,#171c25_0%,#10141d_45%,#252b36_100%)]">
        {slides.map((slide, index) => (
          <div
            key={`${index}:${slide.url}`}
            data-banner-slide={index}
            className={`absolute inset-0 transition-opacity duration-1000 motion-reduce:transition-none ${index === currentIndex ? "opacity-100" : "opacity-0"}`}
            style={{
              backgroundImage: `url(${slide.url})`,
              backgroundPosition: slide.position,
              backgroundSize: slide.zoom ? `${slide.zoom}%` : "cover",
              backgroundRepeat: "no-repeat",
            }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-black/40" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
      <div className="relative z-10 min-h-[180px] flex-1 px-4 py-6 sm:min-h-[230px] sm:px-6 sm:py-8 lg:px-8 xl:min-h-[260px]">
        <h1 id="gameday-title" className="font-heading text-3xl font-black tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-4xl">GameDay</h1>
        <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-white/80 drop-shadow-md sm:max-w-sm sm:text-base">
          {GAME_DAY_BANNER_DESCRIPTION}
        </p>
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 sm:px-6 lg:px-8">
        {slides.length > 1 ? (
          <div className="flex items-center" role="group" aria-label="Banner slideshow controls">
            {slides.map((slide, index) => (
              <button
                key={`${index}:${slide.url}`}
                type="button"
                aria-label={`Show banner ${index + 1} of ${slides.length}`}
                aria-pressed={index === currentIndex}
                onClick={() => setActiveIndex(index)}
                className="flex h-11 w-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span className={`h-2 w-2 rounded-full border border-white/75 transition-colors ${index === currentIndex ? "bg-white" : "bg-white/20"}`} />
              </button>
            ))}
            {!reducedMotion && (
              <button type="button" aria-label={paused ? "Play banner slideshow" : "Pause banner slideshow"} onClick={() => setPaused(value => !value)} className="flex h-11 w-11 items-center justify-center rounded text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">{children}</div>
      </div>
    </section>
  );
}
