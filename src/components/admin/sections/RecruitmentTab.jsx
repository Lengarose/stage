import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BadgeCheck,
  Building2,
  Handshake,
  RotateCcw,
  Search,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

const TYPE_LABELS = {
  player_lfg: "Player LFG",
  club_recruiting: "Club Recruiting",
  trial_request: "Trial Request",
};

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export default function RecruitmentTab({ posts = [], onRefresh }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (status !== "all" && post.status !== status) return false;
      if (!q) return true;
      const positions = [
        ...normalizeList(post.positions_needed),
        ...normalizeList(post.preferred_positions),
      ];
      return [
        post.title,
        post.body,
        post.author_player_gamertag,
        post.author_club_name,
        post.platform,
        post.region,
        post.discord_handle,
        ...positions,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [posts, search, status]);

  async function setPostStatus(post, nextStatus) {
    setBusyId(post.id);
    try {
      await stageClient.entities.RecruitmentPost.update(post.id, {
        status: nextStatus,
        reason: nextStatus === "closed" ? "Admin closed recruitment post" : "Admin reopened recruitment post",
      });
      await onRefresh?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-heading uppercase tracking-tight text-foreground flex items-center gap-2">
            <Handshake className="w-5 h-5 text-primary" /> Recruitment
          </h2>
          <p className="text-xs text-muted-foreground">
            Moderate LFG, club recruiting, and trial posts without changing transfers or contracts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
            {filteredPosts.length} shown
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_180px] gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, player, club, position..."
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {filteredPosts.map((post) => {
          const positions = post.post_type === "club_recruiting"
            ? normalizeList(post.positions_needed)
            : normalizeList(post.preferred_positions);
          const IdentityIcon = post.author_club_id ? Building2 : User;
          const profileUrl = post.author_club_id ? `/clubs/${post.author_club_id}` : `/players/${post.author_player_id}`;
          return (
            <div key={post.id} className="rounded border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded border border-primary/25 bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <IdentityIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-foreground truncate">
                        {post.author_club_name || post.author_player_gamertag || "Recruitment post"}
                      </p>
                      {Number(post.author_player_is_verified) === 1 && (
                        <BadgeCheck className="w-4 h-4 text-primary" />
                      )}
                      {post.verified_only ? (
                        <ShieldCheck className="w-4 h-4 text-success" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[post.post_type] || post.post_type} · {post.platform || "Any"} · {post.region || "Global"}
                    </p>
                  </div>
                </div>
                <span className="rounded border border-border bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {post.status || "open"}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-foreground">{post.title}</h3>
                {post.body ? <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.body}</p> : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {positions.map((position) => (
                  <span key={position} className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {position}
                  </span>
                ))}
                {post.availability_text ? (
                  <span className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {post.availability_text}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {post.author_player_id || post.author_club_id ? (
                  <Link to={profileUrl}>
                    <Button size="sm" variant="outline" className="h-8 text-xs">
                      View {post.author_club_id ? "Club" : "Profile"}
                    </Button>
                  </Link>
                ) : null}
                {post.status === "open" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === post.id}
                    onClick={() => setPostStatus(post, "closed")}
                    className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:text-destructive"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Close
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === post.id}
                    onClick={() => setPostStatus(post, "open")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reopen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          No recruitment posts match this filter.
        </div>
      ) : null}
    </div>
  );
}
