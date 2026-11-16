import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import { Link } from "react-router-dom";
import IdentityAvatar from "@/components/profile/IdentityAvatar";
import { getCountryShortName } from "@/lib/countryDisplay";
import "./directory.css";

export function DirectoryHeader({ kind, title, count, loading, scoped }) {
  return <header className="directory-header">
    <div>
      <p className="directory-eyebrow">STAGE / {scoped ? "Tournament participants" : "Community directory"}</p>
      <h1>{title}<span aria-hidden="true">.</span></h1>
      <p className="directory-intro">Players. Clubs. Managers. The people and identities behind the game.</p>
    </div>
    <div className="directory-header-side">
      <div className="directory-total"><strong>{loading ? "—" : count}</strong><span>{kind === "players" ? "Player profiles" : kind === "clubs" ? "Club profiles" : "Manager profiles"}</span></div>
      {!scoped && <nav aria-label="Community directories">
        <Link to="/directory?type=players" aria-current={kind === "players" ? "page" : undefined}>Players</Link>
        <Link to="/directory?type=clubs" aria-current={kind === "clubs" ? "page" : undefined}>Clubs</Link>
        <Link to="/directory?type=managers" aria-current={kind === "managers" ? "page" : undefined}>Managers</Link>
      </nav>}
    </div>
  </header>;
}

export function DirectoryTools({ children, search, onSearch, placeholder, view, onView, sort, onSort }) {
  return <div className="directory-tools">
    <label className="directory-search"><Search size={18} aria-hidden="true" /><span className="sr-only">{placeholder}</span><input type="search" value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder} /></label>
    {children}
    <label className="directory-select"><span className="sr-only">Sort profiles</span><select value={sort} onChange={e => onSort(e.target.value)}><option value="asc">Name: A–Z</option><option value="desc">Name: Z–A</option></select></label>
    <div className="directory-view" role="group" aria-label="Directory layout">
      <button type="button" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => onView("grid")}><LayoutGrid size={19} /></button>
      <button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => onView("list")}><List size={20} /></button>
    </div>
  </div>;
}

export function DirectoryCard({ kind, item, club, profileLabel }) {
  const isClub = kind === "clubs";
  const isManager = kind === "managers";
  const name = isClub ? item.name : isManager ? item.display_name : item.gamertag;
  const image = isClub ? item.logo_url : item.avatar_url;
  const country = getCountryShortName(item.country_code, item.country);
  return <Link to={`/${isClub ? "clubs" : "players"}/${isManager ? item.player_id : item.id}`} className="directory-card">
    <div className="directory-card-banner" aria-hidden="true">
      {item.banner_url && <div className="directory-card-art" style={{ backgroundImage: `url(${item.banner_url})`, backgroundSize: `${item.banner_zoom || 150}%`, backgroundPosition: item.banner_position || "50% 50%" }} />}
      <div className="directory-card-shade" />
      <span className="directory-card-index">{isClub ? (item.tag || "CLUB") : isManager ? "MANAGER" : [item.position, item.secondary_position].filter(Boolean).join(" / ") || "PLAYER"}</span>
    </div>
    <div className="directory-card-body">
      <IdentityAvatar src={image} name={name} alt="" className="directory-avatar" position={isClub ? item.logo_position : item.avatar_position} zoom={isClub ? item.logo_zoom : item.avatar_zoom} />
      <div className="directory-card-identity"><h2>{name || (isClub ? "Club" : "Player")}</h2>
        <p className="directory-card-meta">{[item.platform, isClub ? item.region : country].filter(Boolean).join(" · ") || "STAGE community"}</p>
        {!isClub && <p className="directory-card-affiliation">{club?.name || (item.club_id ? "Club player" : "Free agent")}</p>}
        {isClub && country && <p className="directory-card-affiliation">{country}</p>}
      </div>
      <span className="directory-card-link">{profileLabel}<ArrowRight size={18} aria-hidden="true" /></span>
    </div>
  </Link>;
}

export function DirectoryPagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return <nav className="directory-pagination" aria-label="Directory pages">
    <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /></button>
    <span>Page <strong>{page}</strong> of {totalPages}</span>
    <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => onPage(page + 1)}><ChevronRight size={18} /></button>
  </nav>;
}
