import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import { reviewTournamentClubRegistration, setAdminTournamentClubs } from "@/api/tournamentActions";
import { ArrowLeft, Shield, Search, Users, Check, Save, X, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { swalAlert, swalConfirm, swalPrompt } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";

function parseJsonList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseRegistrationProofs(value) {
  if (!value) return { club: {}, player: {} };
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return {
      club: parsed?.club && typeof parsed.club === "object" ? parsed.club : {},
      player: parsed?.player && typeof parsed.player === "object" ? parsed.player : {},
    };
  } catch {
    return { club: {}, player: {} };
  }
}

export default function ClubsRegistered({ overrideTournamentId } = {}) {
  const { t } = useTranslation();
  const params = useParams();
  const id = overrideTournamentId || params.id;
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [allClubs, setAllClubs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState("");
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    const [tData, clubs] = await Promise.all([
      stageClient.entities.Tournament.filter({ id }, null, 1),
      stageClient.entities.Club.list("-wins", 200),
    ]);
    const rawTournament = tData[0];
    const t = rawTournament
      ? {
          ...rawTournament,
          registered_clubs: parseJsonList(rawTournament.registered_clubs),
          registration_proofs: parseRegistrationProofs(rawTournament.registration_proofs),
        }
      : null;
    setTournament(t);
    setAllClubs(clubs);
    setSelected(new Set(t?.registered_clubs || []));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const maxTeams = tournament?.max_teams || 0;
  const isFull = selected.size >= maxTeams;

  function toggle(clubId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        if (next.size >= maxTeams) return prev; // full
        next.add(clubId);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const result = await setAdminTournamentClubs(id, [...selected]);
      if (!result?.data?.success) {
        throw new Error(result?.data?.error || "Could not save tournament clubs");
      }
      await load();
      await swalAlert([
        t("commonPages.crSaved"),
        result.data.added ? `${result.data.added} admin-selected club(s) processed.` : null,
        result.data.seeded_tournament_availability ? `${result.data.seeded_tournament_availability} tournament availability row(s) prepared.` : null,
        result.data.seeded_dressing_rooms ? `${result.data.seeded_dressing_rooms} dressing room(s) prepared.` : null,
      ].filter(Boolean).join("\n"));
    } catch (err) {
      await swalAlert(err?.message || "Could not save tournament clubs");
    } finally {
      setSaving(false);
    }
  }

  async function reviewPendingRegistration(clubId, action) {
    const club = allClubs.find((item) => String(item.id) === String(clubId));
    let reason = "";
    if (action === "decline") {
      reason = await swalPrompt(`Why are you declining ${club?.name || "this club"}?`, {
        title: "Decline registration",
        placeholder: "Optional admin note",
        confirmText: "Decline",
      });
      if (reason === null) return;
    } else {
      const ok = await swalConfirm(`Approve ${club?.name || "this club"} for ${tournament?.name}?`, {
        title: "Approve registration",
        confirmText: "Approve",
        icon: "question",
      });
      if (!ok) return;
    }

    setReviewing(`${action}:${clubId}`);
    try {
      const result = await reviewTournamentClubRegistration(id, clubId, action, reason);
      if (!result?.data?.success) {
        throw new Error(result?.data?.error || "Registration review failed");
      }
      await load();
      await swalAlert(action === "approve" ? "Club registration approved." : "Club registration declined.");
    } catch (err) {
      await swalAlert(err?.message || "Registration review failed");
    } finally {
      setReviewing("");
    }
  }

  const regions = [...new Set(allClubs.map(c => c.region).filter(Boolean))];
  const filtered = allClubs
    .filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.tag?.toLowerCase().includes(search.toLowerCase());
      const matchRegion = filterRegion === "all" || c.region === filterRegion;
      return matchSearch && matchRegion;
    })
    .sort((a, b) => (b.wins || 0) - (a.wins || 0));

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;
  const pendingClubProofs = Object.values(tournament?.registration_proofs?.club || {})
    .filter((proof) => String(proof?.status || "").toLowerCase() === "pending");

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> {t("commonPages.crAddClubs")}
          </h1>
          <p className="font-subtitle text-sm text-muted-foreground mt-1">
            {tournament?.name} · <span className={cn("font-semibold", isFull ? "text-destructive" : "text-success")}>{t("commonPages.crSlotsFilled", { filled: selected.size, max: maxTeams })}</span>
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground gap-2">
          <Save className="w-4 h-4" /> {saving ? t("commonPages.profSaving") : t("commonPages.crSaveParticipants")}
        </Button>
      </div>

      {isFull && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          {t("commonPages.crTournamentFull", { max: maxTeams })}
        </div>
      )}

      {pendingClubProofs.length > 0 && (
        <section className="mb-6 rounded-2xl border border-warning/25 bg-warning/5 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-black uppercase tracking-wide text-foreground">Pending club registrations</h2>
              <p className="text-xs text-muted-foreground">Review EA FC club names before clubs enter the tournament field.</p>
            </div>
            <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-warning">
              {pendingClubProofs.length} pending
            </span>
          </div>
          <div className="space-y-3">
            {pendingClubProofs.map((proof) => {
              const club = allClubs.find((item) => String(item.id) === String(proof.participant_id));
              const clubId = proof.participant_id;
              return (
                <div key={clubId} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10">
                      {club?.logo_url
                        ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                        : <Shield className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{club?.name || "Unknown club"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        EA FC: <span className="font-semibold text-warning">{proof.ea_club_name || "Not provided"}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Submitted {proof.submitted_at ? new Date(proof.submitted_at).toLocaleString() : "recently"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => reviewPendingRegistration(clubId, "approve")}
                      disabled={Boolean(reviewing)}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <Check className="mr-1.5 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => reviewPendingRegistration(clubId, "decline")}
                      disabled={Boolean(reviewing)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <X className="mr-1.5 h-4 w-4" /> Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("commonPages.crSearchPlaceholder")} className="pl-9 bg-secondary border-border" />
        </div>
        {regions.length > 0 && (
          <Select value={filterRegion} onValueChange={setFilterRegion}>
            <SelectTrigger className="w-40 bg-secondary border-border"><SelectValue placeholder={t("commonPages.profRegion")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("commonPages.allRegions")}</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider bg-secondary/50">
              <th className="w-10 px-4 py-3"></th>
              <th className="text-left px-4 py-3">{t("nav.club")}</th>
              <th className="hidden sm:table-cell px-3 py-3 text-left">{t("commonPages.profRegion")}</th>
              <th className="hidden md:table-cell px-3 py-3 text-center">W/D/L</th>
              <th className="px-3 py-3 text-center">{t("commonPages.status")}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((club) => {
              const isSelected = selected.has(club.id);
              const disabled = !isSelected && isFull;
              return (
                <tr
                  key={club.id}
                  onClick={() => !disabled && toggle(club.id)}
                  className={cn(
                    "border-b border-border/50 transition-colors cursor-pointer",
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary/30"
                  )}
                >
                  <td className="px-4 py-3 text-center">
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center mx-auto transition-all",
                      isSelected ? "bg-primary border-primary" : "border-border"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                        {club.logo_url
                          ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                          : <Shield className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{club.name}</p>
                        <p className="text-[10px] text-primary font-mono">[{club.tag}]</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-muted-foreground text-xs">{club.region || "—"}</td>
                  <td className="hidden md:table-cell px-3 py-3 text-center text-xs">
                    <span className="text-success">{club.wins || 0}W</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">{club.draws || 0}D</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-destructive">{club.losses || 0}L</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isSelected
                      ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/20">{t("commonPages.crRegistered")}</span>
                      : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">{t("commonPages.crAdd")}</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <div className="p-4 text-center border-t border-border">
            <Button variant="outline" onClick={() => setPage(p => p + 1)}>{t("commonPages.crLoadMore")}</Button>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t("commonPages.noClubsFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
