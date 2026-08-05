import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Shield, Trophy, X } from "lucide-react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { asObject } from "@/lib/safeData";
import { GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";
import PresidentSetup, {
  buildProfileFromPresident,
  toPresidentApiPayload,
} from "@/components/onboarding/PresidentSetup";
import { useTranslation } from "@/hooks/useTranslation";

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
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [row, me] = await Promise.all([
          stageClient.entities.President.get(id).catch(() => null),
          stageClient.auth.me().catch(() => null),
        ]);
        if (cancelled) return;
        const presidentRow = asObject(row);
        setPresident(presidentRow);
        setCurrentUser(asObject(me));
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

  async function handleSave(profile) {
    if (!president?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = toPresidentApiPayload(profile);
      const updated = asObject(await stageClient.entities.President.update(president.id, payload));
      setPresident(updated || { ...president, ...payload });
      setEditing(false);
    } catch (err) {
      console.error("Failed to save president profile:", err);
      setSaveError(err?.data?.error || err?.message || t("commonPages.obErrSave"));
    } finally {
      setSaving(false);
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
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => { setEditing(false); setSaveError(null); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 hover:text-white"
            >
              <X className="w-4 h-4" /> {t("commonPages.presCancelEdit")}
            </button>
          </div>
          {saveError ? (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {saveError}
            </p>
          ) : null}
          <PresidentSetup
            key={`edit-${president.id}-${president.updated_date || president.updated_at || ""}`}
            mode="edit"
            initialProfile={buildProfileFromPresident(president)}
            saving={saving}
            onContinue={handleSave}
          />
        </div>
      </GamerProfileShell>
    );
  }

  const socialLinks = parseSocialLinks(president.social_links);
  const successKey = SUCCESS_LABEL_KEYS[president.success_level];
  const successLabel = successKey ? t(`commonPages.${successKey}`) : president.success_level;
  const bannerStyle = president.banner_url
    ? {
        backgroundImage: `url(${president.banner_url})`,
        backgroundSize: `${president.banner_zoom || 150}%`,
        backgroundPosition: president.banner_position || "50% 50%",
      }
    : {};

  return (
    <GamerProfileShell>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              {t("commonPages.profEditProfile")}
            </Button>
          ) : null}
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="relative h-36 bg-gradient-to-r from-amber-500/20 via-cyan-500/10 to-white/5" style={bannerStyle}>
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-[#060912]/90" />
          </div>
          <div className="relative px-5 pb-6 -mt-12">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div
                className="w-28 h-28 rounded-2xl border border-white/15 bg-[#101827] overflow-hidden shadow-xl shrink-0"
                style={president.avatar_url ? {
                  backgroundImage: `url(${president.avatar_url})`,
                  backgroundSize: `${president.avatar_zoom || 150}%`,
                  backgroundPosition: president.avatar_position || "50% 50%",
                  backgroundRepeat: "no-repeat",
                } : undefined}
              >
                {!president.avatar_url ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield className="w-10 h-10 text-amber-300/80" />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">{t("commonPages.cdPresident")}</p>
                <h1 className="font-heading text-3xl font-black uppercase text-white mt-1">
                  {president.display_name || t("commonPages.cdPresident")}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {president.role_title ? <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-white/75">{president.role_title}</span> : null}
                  {successLabel ? <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200">{successLabel}</span> : null}
                  {president.management_style ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">{president.management_style}</span> : null}
                  {president.country_code ? <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-white/65">{president.country_code}</span> : null}
                </div>
              </div>
              {club?.id ? (
                <Link
                  to={`/clubs/${club.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-white/15"
                >
                  {club.logo_url ? (
                    <span
                      className="w-6 h-6 rounded-md border border-white/20 overflow-hidden"
                      style={{
                        backgroundImage: `url(${club.logo_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  ) : <Shield className="w-4 h-4" />}
                  {club.name || t("commonPages.obCreateClub")}
                </Link>
              ) : null}
            </div>

            {president.quote ? <p className="mt-5 text-sm font-semibold text-white/85">"{president.quote}"</p> : null}
            {president.bio ? <p className="mt-3 text-sm leading-relaxed text-white/60 max-w-3xl">{president.bio}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
              {president.started_at ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1">
                  <Trophy className="w-3 h-3 text-amber-300" /> {t("commonPages.presSince")} {String(president.started_at).slice(0, 10)}
                </span>
              ) : null}
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
          </div>
        </section>
      </div>
    </GamerProfileShell>
  );
}
