import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Shield } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BannerSelector from "@/components/BannerSelector";
import PresidentContractsPanel from "@/components/presidents/PresidentContractsPanel";
import PresidentProfileEdit from "@/components/presidents/PresidentProfileEdit";
import GamerPresidentProfileHero from "@/components/profile/gamer/GamerPresidentProfileHero";
import { asObject, asObjectArray } from "@/lib/safeData";
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";
import { useTranslation } from "@/hooks/useTranslation";

function formatTenureDate(value) {
  if (!value) return null;
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

const SUCCESS_LABEL_KEYS = {
  less_successful: "presSuccessLess",
  successful: "presSuccessSuccessful",
  more_successful: "presSuccessMore",
  most_successful: "presSuccessMost",
  boss: "presSuccessBoss",
};

function isSafeUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function parseSocialLinks(value) {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return parseSocialLinks(JSON.parse(value));
    } catch {
      return isSafeUrl(value) ? [{ label: "Link", url: value }] : [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((item, index) => (typeof item === "string" ? { label: `Link ${index + 1}`, url: item } : item))
      .filter((item) => isSafeUrl(item?.url));
  }
  return Object.entries(value)
    .filter(([, url]) => isSafeUrl(url))
    .map(([label, url]) => ({ label, url }));
}

function isAdminUser(user) {
  return Boolean(user?.role === "admin" || user?.is_admin || user?.role_id === 2);
}

export default function PresidentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [president, setPresident] = useState(null);
  const [club, setClub] = useState(null);
  const [clubHistory, setClubHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [mainTab, setMainTab] = useState("history");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [row, me, historyRows] = await Promise.all([
          stageClient.entities.President.get(id).catch(() => null),
          stageClient.auth.me().catch(() => null),
          stageClient.presidents.history(id).catch(() => []),
        ]);
        if (cancelled) return;
        const presidentRow = asObject(row);
        setPresident(presidentRow);
        setCurrentUser(asObject(me));
        setClubHistory(asObjectArray(historyRows));
        if (presidentRow?.club_id) {
          const clubRow = asObject(await stageClient.entities.Club.get(presidentRow.club_id).catch(() => null));
          if (!cancelled) setClub(clubRow);
        } else {
          setClub(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const canEdit = Boolean(
    president?.id
    && currentUser?.id
    && (String(president.user_id || "") === String(currentUser.id) || isAdminUser(currentUser))
  );

  async function handleBannerSelect(bannerId, position, zoom) {
    if (!president?.id) return;
    const update = { banner_url: bannerId };
    if (position) update.banner_position = position;
    if (zoom != null) update.banner_zoom = zoom;
    setBannerDialogOpen(false);
    setPresident((prev) => ({ ...prev, ...update }));
    try {
      await stageClient.entities.President.update(president.id, update);
    } catch (err) {
      console.error("Failed to save president banner:", err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!president?.id) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/50">{t("commonPages.presNotFound")}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          {t("commonPages.profBack")}
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <GamerProfileShell>
        <PresidentProfileEdit
          key={`edit-${president.id}-${president.updated_date || president.updated_at || ""}`}
          president={president}
          onBack={() => setEditing(false)}
          onSaved={(updated) => setPresident((prev) => ({ ...prev, ...updated }))}
        />
      </GamerProfileShell>
    );
  }

  const socialLinks = parseSocialLinks(president.social_links);
  const successKey = SUCCESS_LABEL_KEYS[president.success_level];
  const successLabel = successKey ? t(`commonPages.${successKey}`) : president.success_level;

  return (
    <GamerProfileShell>
      <GamerPresidentProfileHero
        president={president}
        club={club}
        successLabel={successLabel}
        sinceLabel={t("commonPages.presSince")}
        sinceDate={formatTenureDate(president.started_at)}
        onBannerClick={() => canEdit && setBannerDialogOpen(true)}
        topLeftActions={(
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
        )}
        topActions={canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white/80 text-xs font-bold uppercase tracking-wider"
          >
            <Pencil className="w-4 h-4" /> {t("commonPages.profEditProfile")}
          </button>
        ) : null}
      >
        {socialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-white/50">
            {socialLinks.map((link) => (
              <a
                key={`${link.label}-${link.url}`}
                href={isSafeUrl(link.url) ? link.url : "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-white/10 px-2.5 py-1 hover:text-white hover:border-white/25"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </GamerPresidentProfileHero>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-5 pb-10">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger
                value="history"
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/55 data-[state=active]:border-amber-300/35 data-[state=active]:bg-amber-300/10 data-[state=active]:text-amber-100"
              >
                {t("commonPages.presTabHistory")}
              </TabsTrigger>
              <TabsTrigger
                value="contracts"
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/55 data-[state=active]:border-amber-300/35 data-[state=active]:bg-amber-300/10 data-[state=active]:text-amber-100"
              >
                {canEdit ? t("commonPages.presTabContracts") : t("commonPages.presTabPlayersSigned")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0">
              <h2 className="sr-only">{t("commonPages.presClubHistory")}</h2>
              {clubHistory.length === 0 ? (
                <p className="text-sm text-white/45 py-6 text-center">{t("commonPages.presNoHistory")}</p>
              ) : (
                <ul className="space-y-3">
                  {clubHistory.map((tenure) => {
                    const start = formatTenureDate(tenure.started_at);
                    const end = tenure.ended_at ? formatTenureDate(tenure.ended_at) : null;
                    const isCurrent = !tenure.ended_at;
                    const name = tenure.club_name || tenure.club_tag || t("commonPages.obCreateClub");
                    return (
                      <li
                        key={tenure.id}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        {tenure.club_logo_url ? (
                          <span
                            className="w-10 h-10 rounded-lg border border-white/15 shrink-0"
                            style={{
                              backgroundImage: `url(${tenure.club_logo_url})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          />
                        ) : (
                          <span className="w-10 h-10 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center shrink-0">
                            <Shield className="w-4 h-4 text-white/40" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          {tenure.club_id ? (
                            <Link
                              to={`/clubs/${tenure.club_id}`}
                              className="text-sm font-bold text-white hover:text-amber-200 truncate block"
                            >
                              {name}
                            </Link>
                          ) : (
                            <p className="text-sm font-bold text-white truncate">{name}</p>
                          )}
                          <p className="text-xs text-white/45 mt-0.5">
                            {start || "—"}
                            {" → "}
                            {isCurrent ? t("commonPages.presHistoryPresent") : (end || "—")}
                            {isCurrent ? (
                              <span className="ml-2 text-amber-300/90">{t("commonPages.presHistoryCurrent")}</span>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="contracts" className="mt-0">
              <PresidentContractsPanel
                clubId={club?.id || president.club_id}
                showOfferStatuses={canEdit}
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <BannerSelector
        open={bannerDialogOpen}
        onClose={() => setBannerDialogOpen(false)}
        currentBannerId={president.banner_url}
        currentBannerPosition={president.banner_position}
        currentBannerZoom={president.banner_zoom}
        previewData={{
          name: president.display_name,
          subtitle: t("commonPages.presProfileMenu"),
          avatarUrl: president.avatar_url,
          type: "player",
        }}
        onSelect={handleBannerSelect}
      />
    </GamerProfileShell>
  );
}
