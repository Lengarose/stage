import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import {
  BadgeCheck, Briefcase, CalendarClock, Filter, Handshake, MessageSquare,
  Mic, Plus, Search, Shield, User, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { CONTRACT_TYPES } from "@/lib/contractTypes";

const POSITIONS = ["GK","CB","LB","RB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"];
const PLATFORMS = ["PlayStation", "Xbox", "PC", "Cross-Platform"];
const REGIONS = ["Europe", "North America", "South America", "Africa", "Asia", "Oceania", "Global"];

const TYPE_META = {
  player_lfg: { label: "Players Looking", singular: "Looking for Club", icon: User, tone: "text-primary border-primary/30 bg-primary/10" },
  club_recruiting: { label: "Clubs Recruiting", singular: "Club Recruiting", icon: Shield, tone: "text-success border-success/30 bg-success/10" },
  trial_request: { label: "Trials", singular: "Trial Request", icon: CalendarClock, tone: "text-warning border-warning/30 bg-warning/10" },
};

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

export default function Recruitment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [myContracts, setMyContracts] = useState([]);
  const [canManageClub, setCanManageClub] = useState(false);
  const [activeType, setActiveType] = useState("player_lfg");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [platform, setPlatform] = useState("");
  const [region, setRegion] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [interestTarget, setInterestTarget] = useState(null);
  const [interestMessage, setInterestMessage] = useState("");
  const [offerTarget, setOfferTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    post_type: "player_lfg",
    title: "",
    body: "",
    positions: [],
    platform: "PlayStation",
    region: "Europe",
    availability_text: "",
    discord_handle: "",
    mic_required: false,
    verified_only: false,
    expires_at: "",
  });
  const canCreateClubPost = Boolean(myClub && canManageClub);
  const canCreatePlayerPost = Boolean(myPlayer);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (loading) return;
    const createType = searchParams.get("create");
    if (!createType || createOpen) return;
    if (createType === "club_recruiting" && canCreateClubPost) {
      setActiveType("club_recruiting");
      openCreate("club_recruiting");
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("create");
        return next;
      }, { replace: true });
    } else if ((createType === "player_lfg" || createType === "trial_request") && canCreatePlayerPost) {
      setActiveType(createType);
      openCreate(createType);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("create");
        return next;
      }, { replace: true });
    }
  }, [loading, searchParams, createOpen, canCreateClubPost, canCreatePlayerPost, setSearchParams]);

  async function load() {
    setLoading(true);
    try {
      const u = await stageClient.auth.me();
      setUser(u);
      const [playerRows, clubRows, postRows] = await Promise.all([
        stageClient.entities.Player.filter({ email: u.email }).catch(() => []),
        stageClient.entities.Club.filter({ owner_email: u.email }).catch(() => []),
        stageClient.entities.RecruitmentPost.filter({}, "-created_date", 200).catch(() => []),
      ]);
      const player = playerRows[0] || null;
      const club = clubRows[0] || (player?.club_id ? (await stageClient.entities.Club.filter({ id: player.club_id }).catch(() => []))[0] : null);
      setMyPlayer(player);
      setMyClub(club || null);
      setPosts(postRows);
      if (club?.id) {
        setMyContracts(await stageClient.entities.PlayerContract.filter({ team_id: club.id }).catch(() => []));
        const roles = normalizeList(player?.club_roles);
        setCanManageClub(club.owner_email === u.email || roles.includes("president") || roles.includes("captain") || u.role === "admin");
      } else {
        setCanManageClub(false);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(post => {
      if (post.post_type !== activeType) return false;
      if (post.status !== "open") return false;
      if (platform && post.platform !== platform) return false;
      if (region && post.region !== region) return false;
      if (verifiedOnly && Number(post.author_player_is_verified) !== 1) return false;
      const positions = [...normalizeList(post.positions_needed), ...normalizeList(post.preferred_positions)];
      if (position && !positions.includes(position)) return false;
      if (q) {
        const hay = [
          post.title, post.body, post.author_player_gamertag, post.author_club_name,
          post.availability_text, post.discord_handle,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, activeType, platform, region, verifiedOnly, position, search]);

  function openCreate(type = activeType) {
    setForm({
      post_type: type,
      title: type === "club_recruiting" ? `${myClub?.name || "Club"} is recruiting` : `${myPlayer?.gamertag || "Player"} looking for a club`,
      body: "",
      positions: [],
      platform: myClub?.platform || myPlayer?.platform || "PlayStation",
      region: myClub?.region || "Europe",
      availability_text: "",
      discord_handle: "",
      mic_required: false,
      verified_only: false,
      expires_at: "",
    });
    setCreateOpen(true);
  }

  function togglePosition(pos) {
    setForm(prev => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter(p => p !== pos)
        : [...prev.positions, pos],
    }));
  }

  async function savePost() {
    if (!form.title.trim() || !form.platform || !form.region) return;
    setSaving(true);
    try {
      const isClub = form.post_type === "club_recruiting";
      const payload = {
        post_type: form.post_type,
        title: form.title.trim(),
        body: form.body.trim() || null,
        positions_needed: isClub ? form.positions : [],
        preferred_positions: isClub ? [] : form.positions,
        platform: form.platform,
        region: form.region,
        availability_text: form.availability_text.trim() || null,
        discord_handle: form.discord_handle.trim() || null,
        mic_required: form.mic_required,
        verified_only: form.verified_only,
        expires_at: form.expires_at || null,
        author_player_id: isClub ? null : myPlayer?.id,
        author_club_id: isClub ? myClub?.id : null,
        status: "open",
      };
      await stageClient.entities.RecruitmentPost.create(payload);
      setCreateOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function showInterest() {
    if (!interestTarget) return;
    setSaving(true);
    try {
      await stageClient.entities.RecruitmentInterest.create({
        recruitment_post_id: interestTarget.id,
        sender_player_id: interestTarget.post_type === "club_recruiting" ? myPlayer?.id : null,
        sender_club_id: interestTarget.post_type !== "club_recruiting" ? myClub?.id : null,
        message: interestMessage.trim() || null,
      });
      setNotice("Interest sent.");
      setInterestTarget(null);
      setInterestMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function closePost(post) {
    await stageClient.entities.RecruitmentPost.update(post.id, { status: post.status === "open" ? "closed" : "open" });
    await load();
  }

  async function handleOffer({ contract_type, offer_note, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc, performance_targets, captaincy_offered }) {
    if (!offerTarget?.author_player_id || !myClub) return;
    const result = await stageClient.functions.invoke("contractActions", {
      action: "offer",
      team_id: myClub.id,
      user_id: offerTarget.author_player_id,
      contract_type,
      offer_note,
      weekly_salary_stc,
      signing_bonus_stc,
      transfer_fee_stc,
      performance_targets,
      captaincy_offered,
    });
    const contractId = result?.data?.contract_id || result?.contract_id;
    const typeMeta = CONTRACT_TYPES[contract_type] || CONTRACT_TYPES.squad;
    if (contractId) {
      await ensureContractOfferInbox({
        contractId,
        player: {
          id: offerTarget.author_player_id,
          email: offerTarget.author_player_email,
          gamertag: offerTarget.author_player_gamertag,
        },
        club: myClub,
        contractType: contract_type,
        maxGames: typeMeta.max_games,
        maxDays: typeMeta.max_days,
        weeklySalary: weekly_salary_stc,
        signingBonus: signing_bonus_stc,
        offerNote: offer_note,
        senderEmail: myPlayer?.email,
      }).catch((err) => console.warn("[Recruitment] inbox fallback failed:", err?.message || err));
    }
    setOfferTarget(null);
    setNotice("Contract offer sent.");
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Handshake className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase" style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}>
                Recruitment
              </h1>
              <p className="text-xs text-muted-foreground mt-2">Find players, clubs, and trials. Official signings still go through contracts.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canCreatePlayerPost && (
              <Button onClick={() => openCreate("player_lfg")} className="gap-1.5"><Plus className="w-4 h-4" /> Player Post</Button>
            )}
            {canCreateClubPost && (
              <Button onClick={() => openCreate("club_recruiting")} variant="outline" className="gap-1.5"><Briefcase className="w-4 h-4" /> Club Post</Button>
            )}
          </div>
        </div>

        {notice && (
          <div className="rounded border border-success/30 bg-success/10 px-4 py-3 text-sm text-success flex items-center justify-between">
            {notice}
            <button type="button" onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {Object.entries(TYPE_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveType(key)}
                className={cn("flex items-center gap-2 rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap",
                  activeType === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                <Icon className="w-4 h-4" /> {meta.label}
              </button>
            );
          })}
        </div>

        <div className="rounded border border-border bg-card p-3">
          <div className="grid md:grid-cols-[1.3fr_repeat(4,1fr)] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..." className="pl-9" />
            </div>
            <select value={position} onChange={e => setPosition(e.target.value)} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <option value="">All positions</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <option value="">All platforms</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={region} onChange={e => setRegion(e.target.value)} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
              <option value="">All regions</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
              Verified only
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-card/40 p-10 text-center">
            <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">No open posts found</p>
            <p className="text-xs text-muted-foreground mt-1">Change filters or create the first recruitment post.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(post => (
              <RecruitmentCard
                key={post.id}
                post={post}
                user={user}
                myClub={myClub}
                canManageClub={canManageClub}
                myContracts={myContracts}
                onInterest={() => setInterestTarget(post)}
                onOffer={() => setOfferTarget(post)}
                onClosePost={() => closePost(post)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Recruitment Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={form.post_type} onChange={e => setForm(f => ({ ...f, post_type: e.target.value }))} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                <option value="player_lfg" disabled={!canCreatePlayerPost}>Player looking</option>
                <option value="trial_request" disabled={!canCreatePlayerPost}>Trial request</option>
                <option value="club_recruiting" disabled={!canCreateClubPost}>Club recruiting</option>
              </select>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" />
            <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Describe what you are looking for..." rows={4} />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{form.post_type === "club_recruiting" ? "Positions needed" : "Preferred positions"}</p>
              <div className="flex flex-wrap gap-1.5">
                {POSITIONS.map(pos => (
                  <button key={pos} type="button" onClick={() => togglePosition(pos)} className={cn("rounded border px-2 py-1 text-xs", form.positions.includes(pos) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>{pos}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} className="rounded border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>
            <Input value={form.availability_text} onChange={e => setForm(f => ({ ...f, availability_text: e.target.value }))} placeholder="Availability, e.g. Tonight 21:00 CET" />
            <Input value={form.discord_handle} onChange={e => setForm(f => ({ ...f, discord_handle: e.target.value }))} placeholder="Discord handle optional" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.mic_required} onChange={e => setForm(f => ({ ...f, mic_required: e.target.checked }))} /> Mic required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.verified_only} onChange={e => setForm(f => ({ ...f, verified_only: e.target.checked }))} /> Verified only</label>
            </div>
            <Button onClick={savePost} disabled={saving || !form.title.trim()} className="w-full">{saving ? "Saving..." : "Post"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!interestTarget} onOpenChange={(v) => !v && setInterestTarget(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Show Interest</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{interestTarget?.title}</p>
            <Textarea value={interestMessage} onChange={e => setInterestMessage(e.target.value)} rows={4} placeholder="Write a short message..." />
            <Button onClick={showInterest} disabled={saving} className="w-full gap-1.5"><MessageSquare className="w-4 h-4" /> Send Interest</Button>
          </div>
        </DialogContent>
      </Dialog>

      <OfferContractDialog
        open={!!offerTarget}
        onClose={() => setOfferTarget(null)}
        player={offerTarget ? {
          id: offerTarget.author_player_id,
          gamertag: offerTarget.author_player_gamertag,
          position: offerTarget.author_player_position,
          secondary_position: offerTarget.author_player_secondary_position,
          overall_rating: offerTarget.overall_rating || 70,
        } : null}
        existingActiveContract={offerTarget ? myContracts.some(c => c.user_id === offerTarget.author_player_id && ['active', 'pending', 'pending_window'].includes(c.status)) : null}
        playerContracts={myContracts.filter(c => c.user_id === offerTarget?.author_player_id)}
        onOffer={handleOffer}
        windowOpen={null}
        club={myClub}
      />
    </div>
  );
}

function RecruitmentCard({ post, user, myClub, canManageClub, myContracts, onInterest, onOffer, onClosePost }) {
  const meta = TYPE_META[post.post_type] || TYPE_META.player_lfg;
  const Icon = meta.icon;
  const positions = post.post_type === "club_recruiting" ? normalizeList(post.positions_needed) : normalizeList(post.preferred_positions);
  const isMine = post.author_user_id === user?.id || post.author_club_id === myClub?.id;
  const canOffer = canManageClub && post.author_player_id && post.author_club_id !== myClub?.id;
  const hasContractConflict = myContracts.some(c => c.user_id === post.author_player_id && ['active', 'pending', 'pending_window'].includes(c.status));
  const targetLink = post.author_club_id ? `/clubs/${post.author_club_id}` : `/players/${post.author_player_id}`;

  return (
    <div className="rounded border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded border flex items-center justify-center shrink-0", meta.tone)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground truncate">{post.author_club_name || post.author_player_gamertag || "Recruitment"}</p>
              {Number(post.author_player_is_verified) === 1 && <BadgeCheck className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">{post.platform || "Any platform"} · {post.region || "Global"}</p>
          </div>
        </div>
        <span className={cn("rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider", meta.tone)}>{meta.singular}</span>
      </div>

      <div>
        <h2 className="font-bold text-foreground leading-snug">{post.title}</h2>
        {post.body && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{post.body}</p>}
      </div>

      {positions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {positions.map(pos => <span key={pos} className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground font-semibold">{pos}</span>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded bg-secondary/60 px-2 py-2">{post.availability_text || "Availability open"}</div>
        <div className="rounded bg-secondary/60 px-2 py-2 flex items-center gap-1">{post.mic_required ? <Mic className="w-3 h-3" /> : null}{post.mic_required ? "Mic required" : "Mic optional"}</div>
      </div>

      {post.verified_only ? (
        <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded px-2 py-2">
          Verified players preferred. Unverified players may need identity review before acceptance.
        </p>
      ) : null}

      <div className="flex gap-2 flex-wrap pt-1">
        <Link to={targetLink}><Button size="sm" variant="outline" className="text-xs">View {post.author_club_id ? "Club" : "Profile"}</Button></Link>
        {!isMine && <Button size="sm" onClick={onInterest} className="text-xs gap-1"><MessageSquare className="w-3.5 h-3.5" /> Show Interest</Button>}
        {canOffer && <Button size="sm" variant="outline" disabled={hasContractConflict} onClick={onOffer} className="text-xs">Offer Contract</Button>}
        {isMine && <Button size="sm" variant="outline" onClick={onClosePost} className="text-xs">{post.status === "open" ? "Close" : "Reopen"}</Button>}
      </div>
    </div>
  );
}
