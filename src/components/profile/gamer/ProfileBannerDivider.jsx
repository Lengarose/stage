export default function ProfileBannerDivider({ tone = "glow", portrait = "player" }) {
  return (
    <div aria-hidden="true" className="profile-banner-divider pointer-events-none absolute inset-x-0 bottom-0 flex h-px">
      <span className={tone === "white" ? "h-px bg-white/70" : "h-px bg-gradient-to-r from-sky-500/0 via-cyan-300/80 to-cyan-100 shadow-[0_0_7px_rgba(34,211,238,0.65)]"} style={{ width: "max(8px, calc((100% - 72rem) / 2 + 8px))" }} />
      {/* Clear the entire portrait footprint with 8px of space on BOTH sides. */}
      <span className={portrait === "club" ? "w-[200px] shrink-0 sm:w-[256px]" : "w-[184px] shrink-0 sm:w-[224px]"} />
      <span className={tone === "white" ? "h-px flex-1 bg-white/70" : "h-px flex-1 bg-gradient-to-r from-cyan-100 via-sky-400/75 to-sky-500/0 shadow-[0_0_7px_rgba(34,211,238,0.65)]"} />
    </div>
  );
}
