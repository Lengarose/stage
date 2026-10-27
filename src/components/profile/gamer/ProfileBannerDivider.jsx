export default function ProfileBannerDivider({ tone = "glow" }) {
  return (
    <div aria-hidden="true" className="profile-banner-divider pointer-events-none absolute inset-x-0 bottom-0 flex h-px">
      <span className={tone === "white" ? "h-px bg-white/70" : "h-px bg-gradient-to-r from-sky-500/0 via-cyan-300/80 to-cyan-100 shadow-[0_0_7px_rgba(34,211,238,0.65)]"} style={{ width: "max(1rem, calc((100% - 72rem) / 2 + 1rem))" }} />
      {/* Both profile cards share this footprint; clear transparent artwork too. */}
      <span className="w-[168px] shrink-0 sm:w-[208px]" />
      <span className={tone === "white" ? "h-px flex-1 bg-white/70" : "h-px flex-1 bg-gradient-to-r from-cyan-100 via-sky-400/75 to-sky-500/0 shadow-[0_0_7px_rgba(34,211,238,0.65)]"} />
    </div>
  );
}
