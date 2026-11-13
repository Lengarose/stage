import smoke from "@/assets/regional-smoke.png";
import "./matchupBackdrop.css";

/** Decorative matchup artwork shared by agenda rows and the selected-match header. */
export default function MatchupBackdrop({ event, detail = false }) {
  return <span aria-hidden="true" className={`matchup-backdrop${detail ? " matchup-backdrop--detail" : ""}`}>
    {["home", "away"].map(side => <span key={side} className={`matchup-backdrop__half matchup-backdrop__half--${side}`}
      style={{ backgroundImage: event[`${side}AvatarUrl`] ? `url(${JSON.stringify(event[`${side}AvatarUrl`])})` : undefined,
        backgroundPosition: event[`${side}Photo`]?.position || "50% 35%" }} />)}
    <span className="matchup-backdrop__smoke" style={{ backgroundImage: `url(${JSON.stringify(smoke)})` }} />
    <span className="matchup-backdrop__shade" />
    <span className="matchup-backdrop__slash" />
  </span>;
}
