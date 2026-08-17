import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, X } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { asObjectArray } from "@/lib/safeData";
import { useTranslation } from "@/hooks/useTranslation";

const STATUS_LABELS = {
  available: "Available",
  maybe: "Maybe",
  unavailable: "Unavailable",
  no_response: "No Response",
};

const EVENT_GROUPS = [
  "Tournament",
  "Competition",
  "Regional League",
  "Arrange Game / Game Day",
];

function fixtureDateValue(fixture) {
  return new Date(fixture.scheduled_date || fixture.match_date || fixture.created_date || 0).getTime();
}

function fixtureOpponent(fixture, clubId) {
  const isHome = fixture.home_club_id === clubId;
  return isHome ? fixture.away_club_name : fixture.home_club_name;
}

function fixtureLabel(fixture, clubId) {
  const isHome = fixture.home_club_id === clubId;
  const opponent = fixtureOpponent(fixture, clubId);
  return `${isHome ? "vs" : "at"} ${opponent || "TBD"}`;
}

function fixtureDateLabel(fixture) {
  const raw = fixture.scheduled_date || fixture.match_date || fixture.created_date;
  if (!raw) return "TBD";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function fixtureEventText(fixture) {
  return [
    fixture.event_type,
    fixture.fixture_type,
    fixture._fixtureType,
    fixture.competition_type,
    fixture.competition_name,
    fixture.tournament_name,
    fixture.league_name,
    fixture.name,
    fixture.title,
  ].filter(Boolean).join(" ").toLowerCase();
}

function fixtureGroup(fixture) {
  const text = fixtureEventText(fixture);
  if (text.includes("tournament")) return "Tournament";
  if (
    text.includes("supreme league") ||
    text.includes("elite league") ||
    text.includes("challenger league") ||
    text.includes("competition")
  ) return "Competition";
  if (text.includes("regional")) return "Regional League";
  if (
    text.includes("arrange") ||
    text.includes("game day") ||
    text.includes("gameday") ||
    text.includes("friendly")
  ) return "Arrange Game / Game Day";
  return fixture.tournament_id && fixture.tournament_id !== "ranked" ? "Tournament" : "Arrange Game / Game Day";
}

function groupFixtures(fixtures) {
  const map = new Map(EVENT_GROUPS.map((group) => [group, []]));
  for (const fixture of fixtures) {
    const group = fixtureGroup(fixture);
    map.get(group).push(fixture);
  }
  return [...map.entries()].filter(([, rows]) => rows.length > 0);
}

function currentStatusClass(status) {
  if (status === "available") return "border-emerald-300/40 bg-emerald-400/10 text-emerald-200";
  if (status === "unavailable") return "border-red-300/40 bg-red-400/10 text-red-200";
  if (status === "maybe") return "border-amber-300/40 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/5 text-white/45";
}

export default function ClubAvailabilityTab({ club, myPlayer, upcomingFixtures = [] }) {
  const { t } = useTranslation();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isClubMember = Boolean(myPlayer?.id && club?.id && myPlayer.club_id === club.id);
  const fixtures = useMemo(() => (
    asObjectArray(upcomingFixtures)
      .filter((fixture) => fixture?.id)
      .sort((a, b) => fixtureDateValue(a) - fixtureDateValue(b))
  ), [upcomingFixtures]);
  const groupedFixtures = useMemo(() => groupFixtures(fixtures), [fixtures]);
  const availabilityByFixture = useMemo(() => {
    const map = new Map();
    for (const row of asObjectArray(availability)) {
      if (String(row.player_id) === String(myPlayer?.id)) {
        map.set(String(row.fixture_id), row);
      }
    }
    return map;
  }, [availability, myPlayer?.id]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!club?.id || !myPlayer?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await stageClient.entities.ClubFixtureAvailability
          .filter({ club_id: club.id, player_id: myPlayer.id }, "-updated_date", 300)
          .catch(() => []);
        if (alive) setAvailability(asObjectArray(rows));
      } catch (err) {
        if (alive) setError(err?.message || "Could not load availability.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [club?.id, myPlayer?.id]);

  async function setMyAvailability(fixture, status) {
    if (!club?.id || !myPlayer?.id) return;
    const busyKey = `${fixture.id}:${status}`;
    setBusy(busyKey);
    setError(null);
    setNotice(null);
    const existing = availabilityByFixture.get(String(fixture.id));
    const body = {
      club_id: club.id,
      fixture_id: fixture.id,
      fixture_type: fixture._fixtureType || fixture.fixture_type || "match",
      player_id: myPlayer.id,
      status,
    };
    try {
      const saved = existing
        ? await stageClient.http.patch(`/club-fixture-availabilities/${existing.id}`, body)
        : await stageClient.http.post("/club-fixture-availabilities", body);
      setAvailability((prev) => {
        const rows = asObjectArray(prev).filter((row) => row.id !== saved?.id && String(row.fixture_id) !== String(fixture.id));
        return saved?.id ? [saved, ...rows] : rows;
      });
      setNotice(`Availability set to ${STATUS_LABELS[status]}.`);
    } catch (err) {
      setError(err?.message || "Could not update availability.");
    } finally {
      setBusy(null);
    }
  }

  if (!isClubMember) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-sm font-black uppercase tracking-[0.18em] text-white">
            Availability
          </h2>
        </div>
        <p className="mt-1 text-sm text-white/45">
          Set your match availability. Dressing-room seating stays in the matchday flow.
        </p>
      </div>

      {error ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </div>
      ) : null}

      {groupedFixtures.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-white/45">{t("commonPages.coopNoUpcomingFixtures") || "No upcoming fixtures."}</p>
        </div>
      ) : groupedFixtures.map(([group, rows]) => (
        <section key={group} className="space-y-3">
          <h3 className="font-heading text-xs font-black uppercase tracking-[0.18em] text-white/50">
            {group}
          </h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((fixture) => {
              const existing = availabilityByFixture.get(String(fixture.id));
              const status = existing?.status || "no_response";
              return (
                <article key={fixture.id} className="rounded-xl border border-white/10 bg-[#071018] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.22)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-heading text-lg font-black uppercase text-white">
                        {fixtureLabel(fixture, club.id)}
                      </p>
                      <p className="mt-1 text-xs text-white/45">{fixtureDateLabel(fixture)}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]", currentStatusClass(status))}>
                      {STATUS_LABELS[status] || status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      disabled={busy === `${fixture.id}:available`}
                      onClick={() => setMyAvailability(fixture, "available")}
                      className={cn(
                        "h-10 gap-2 rounded-sm text-xs font-black uppercase tracking-[0.14em]",
                        status === "available"
                          ? "bg-emerald-400 text-black hover:bg-emerald-300"
                          : "border border-emerald-300/35 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                      )}
                    >
                      {busy === `${fixture.id}:available` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Available
                    </Button>
                    <Button
                      type="button"
                      disabled={busy === `${fixture.id}:unavailable`}
                      onClick={() => setMyAvailability(fixture, "unavailable")}
                      className={cn(
                        "h-10 gap-2 rounded-sm text-xs font-black uppercase tracking-[0.14em]",
                        status === "unavailable"
                          ? "bg-red-400 text-black hover:bg-red-300"
                          : "border border-red-300/35 bg-red-400/10 text-red-200 hover:bg-red-400/20"
                      )}
                    >
                      {busy === `${fixture.id}:unavailable` ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Unavailable
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
