import storeBenefits from "../../server/src/shared/storeBenefits.json";
import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  CREDIT_PACKS,
  STAGE_PLUS_MONTHLY_CREDITS,
  STAGE_PLUS_PRICE,
  TIER_LABELS,
  TOURNAMENT_ENTRY_CREDITS,
  hasStagePlus,
} from "@/lib/subscriptionUtils";
import { Coins, Check, Crown, Shield, ArrowUpRight } from "lucide-react";
import "./store.css";
import { cn } from "@/lib/utils";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { useTranslation } from "@/hooks/useTranslation";

const DEFAULT_STORE_CONFIG = {
  name: "STAGE Plus",
  stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
  stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
  monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
  starter_credits: TOURNAMENT_ENTRY_CREDITS,
  tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
  community_tournament_limit: 0,
  ...storeBenefits,
  badge_image_url: "/uploads/stage-plus-badge.png",
  background_image_url: "",
  is_active: 1,
};

function normalizeStoreConfig(row = {}) {
  const rawDescription = String(row.description || "").trim();
  const legacyDescription = !rawDescription
    || /ranked play|^STAGE Plus unlocks official competitions/i.test(rawDescription)
    || (/monthly credit refresh/i.test(rawDescription) && !/full rankings/i.test(rawDescription));
  const rawPerks = Array.isArray(row.perks) ? row.perks : [];
  const hasLegacyPerks = rawPerks.some((perk) => /300 credits|advanced player and club discovery|active events|premium|150 credits refreshed every month|Ranked player and club tournament access|Enter official STAGE competitions/i.test(String(perk)));
  return {
    ...DEFAULT_STORE_CONFIG,
    ...row,
    stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
    stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
    monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
    starter_credits: TOURNAMENT_ENTRY_CREDITS,
    tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
    community_tournament_limit: 0,
    headline: !row.headline || row.headline === "One membership for serious competitors" ? storeBenefits.headline : row.headline,
    description: legacyDescription ? DEFAULT_STORE_CONFIG.description : rawDescription,
    perks: rawPerks.length && !hasLegacyPerks ? rawPerks : DEFAULT_STORE_CONFIG.perks,
  };
}



export default function Store() {
  const { t } = useTranslation();
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [notification, setNotification] = useState(null);
  const [creditConfirm, setCreditConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState("credits");
  const [subBilling, setSubBilling] = useState("monthly");
  const [subError, setSubError] = useState(null);
  const [storeConfig, setStoreConfig] = useState(DEFAULT_STORE_CONFIG);

  async function refreshStoreIdentity() {
    const refreshedUser = await stageClient.auth.me().catch(() => null);
    if (refreshedUser) setUser(refreshedUser);
    const refreshedPlayer = refreshedUser?.player_id
      ? await stageClient.entities.Player.get(refreshedUser.player_id).catch(() => null)
      : null;
    if (refreshedPlayer) setPlayer(refreshedPlayer);
    return { user: refreshedUser, player: refreshedPlayer };
  }

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("client") === "mobile") {
        const next = new URLSearchParams(params);
        next.delete("client");
        const qs = next.toString();
        window.location.replace(qs ? `stage://apps/store?${qs}` : "stage://apps/store");
        return;
      }

      const cfgRows = await stageClient.entities.StoreConfig.filter({ is_active: 1, with_defaults: 1 }, "-updated_date", 1).catch(() => []);
      const cfg = normalizeStoreConfig(cfgRows?.[0]);
      setStoreConfig(cfg);
      const { user: u, player: pl } = await resolveMyPlayerAndClub();
      if (!u) throw new Error("Sign in to view your Store balance and membership.");
      if (u.player_id && !pl) throw new Error("Could not load your membership. Please try again.");
      setUser(u);
      if (pl) setPlayer(pl);

      if (params.get('sub') === 'success') {
        setActiveTab('subscription');
        window.history.replaceState({}, '', '/store');
        try {
          const fixRes = await stageClient.functions.invoke('fixSubscription', {
            session_id: params.get('session_id'),
          });
          if (fixRes.data?.success) {
            await refreshStoreIdentity();
            showNotif(`STAGE Plus activated. Monthly credits refresh to ${Number(cfg.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS)}.`, 'success');
          } else {
            showNotif('Payment confirmation is pending. Please refresh your membership shortly.', 'success');
          }
        } catch (e) {
          showNotif('Payment confirmation is pending. Please refresh your membership shortly.', 'success');
        }
      } else if (params.get('sub') === 'cancelled') {
        showNotif('Subscription cancelled.', 'error');
        window.history.replaceState({}, '', '/store');
      }
      if (params.get('payment') === 'success') {
        const credits = parseInt(params.get('credits') || '0');
        const pack = params.get('pack');
        const sessionId = params.get('session_id');
        window.history.replaceState({}, '', '/store');
        // Actually grant the credits server-side (idempotent — the webhook may
        // have already done it). Credits are user-scoped and shared by player
        // and club tournament flows.
        try {
          const res = await stageClient.functions.invoke('fixCredits', { session_id: sessionId });
          if (res.data?.success) {
            const added = res.data.credits_added ?? credits;
            await refreshStoreIdentity();
            if (added > 0 || credits > 0) {
              setCreditConfirm({ credits: added || credits, id: pack });
              showNotif(`+${added || credits} credits added!`, 'success');
            }
          } else {
            showNotif('Payment received — credits will appear shortly.', 'success');
          }
        } catch (e) {
          showNotif('Payment received — credits will appear shortly.', 'success');
        }
      } else if (params.get('payment') === 'cancelled') {
        showNotif('Payment cancelled.', 'error');
        window.history.replaceState({}, '', '/store');
      }

      setLoading(false);
    }
    load().catch((err) => { setLoadError(err.message || "Could not load the Store."); setLoading(false); });
  }, []);

  async function handleCreditPurchase(pack) {
    if (purchasing) return;
    if (!player) { showNotif("Create a player profile first!", "error"); return; }
    if (window.self !== window.top) { await swalAlert("Checkout is only available from the published app, not the preview."); return; }
    setPurchasing(pack.id);
    try {
      const res = await stageClient.functions.invoke('stripeCheckout', {
        packId: pack.id,
        successUrl: `${window.location.origin}/store?payment=success&pack=${pack.id}&credits=${pack.credits}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/store?payment=cancelled`,
      });
      if (res.data?.url) window.location.href = res.data.url;
      else showNotif('Failed to start checkout.', 'error');
    } catch (err) {
      showNotif('Checkout error: ' + err.message, 'error');
    }
    setPurchasing(null);
  }

  async function handleSubscription() {
    if (purchasing) return;
    if (!user || !player) { showNotif("Create a player profile before subscribing.", "error"); return; }
    if (hasStagePlus(player)) { setSubError("Your STAGE Plus membership is already active."); return; }
    if (window.self !== window.top) { await swalAlert('Checkout is only available from the published app.'); return; }
    setPurchasing("sub_stage_plus");
    setSubError(null);
    try {
      const res = await stageClient.functions.invoke('stripeSubscription', {
        tier: "stage_plus",
        billing: subBilling,
        successUrl: `${window.location.origin}/store?sub=success&tier=stage_plus&billing=${subBilling}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/store?sub=cancelled`,
      });
      if (res.data?.url) window.location.href = res.data.url;
      else showNotif('Failed to start checkout.', 'error');
    } catch (err) {
      setSubError(err.message || 'Checkout error');
    }
    setPurchasing(null);
  }

  async function handleCancelSubscription() {
    if (!hasStagePlus(player)) return;
    const expiresLabel = player?.subscription_expires_at
      ? new Date(player.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const confirmed = await swalConfirm(
      expiresLabel
        ? t("commonPages.storeCancelConfirm", { date: expiresLabel })
        : t("commonPages.storeCancelConfirmNoDate"),
      {
        title: t("commonPages.storeCancelTitle"),
        confirmText: t("commonPages.storeCancelConfirmBtn"),
        cancelText: t("commonPages.cancel"),
      }
    );
    if (!confirmed) return;
    setPurchasing("cancel_stage_plus");
    setSubError(null);
    try {
      const res = await stageClient.functions.invoke("cancelStagePlus");
      if (res.data?.success) {
        setPlayer((prev) => prev ? {
          ...prev,
          subscription_cancel_at_period_end: 1,
          subscription_expires_at: res.data.expires_at || prev.subscription_expires_at,
        } : prev);
        showNotif(t("commonPages.storeCancelSuccess"), "success");
      } else {
        setSubError(t("commonPages.storeCancelFailed"));
      }
    } catch (err) {
      setSubError(err.message || t("commonPages.storeCancelFailed"));
    }
    setPurchasing(null);
  }


  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  if (loading) return <main className="stage-store"><p role="status">Loading the Store…</p></main>;
  if (loadError) return <main className="stage-store"><h1>STORE<span>.</span></h1><p role="alert">{loadError}</p><button type="button" className="store-action" onClick={() => window.location.reload()}>Try again</button></main>;

  const credits = Math.max(0, Number(user?.credits ?? player?.credits ?? 0));
  const currentTier = hasStagePlus(player) ? "stage_plus" : "free";
  const plusActive = currentTier === "stage_plus";
  const price = subBilling === "yearly" ? STAGE_PLUS_PRICE.yearly : STAGE_PLUS_PRICE.monthly;
  const saving = Math.round((1 - STAGE_PLUS_PRICE.yearly / (12 * STAGE_PLUS_PRICE.monthly)) * 100);
  const expiry = player?.subscription_expires_at
    ? new Date(player.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const cancelling = Number(player?.subscription_cancel_at_period_end) === 1;

  return (
    <main className="stage-store">
      {storeConfig.background_image_url && <div className="store-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(storeConfig.background_image_url)})` }} />}
      <div className="store-content">
        <header className="store-hero">
          <p className="store-eyebrow">STAGE / YOUR NEXT UPGRADE</p>
          <h1>{t("nav.store")}<span>.</span></h1>
          <p>Make more of your game.</p>
          <p className="store-muted">Explore STAGE Plus or top up your credits. One account for your Player and Manager roles.</p>
          <div className="store-account">
            <div><Coins size={20} /><span><strong>{credits.toLocaleString()}</strong> credits available</span></div>
            <div><Shield size={20} /><span>Current plan <strong>{TIER_LABELS[currentTier]}</strong>{plusActive && expiry && <small>{cancelling ? "Access ends" : "Current period ends"} {expiry}</small>}</span></div>
            <a href="/wallet">Open wallet <ArrowUpRight size={18} /></a>
          </div>
        </header>

        {notification && <div role="status" className={cn("store-notification", notification.type === "error" && "store-error")}>{notification.msg}</div>}
        <nav className="store-tabs" aria-label="Store categories">
          <button type="button" aria-pressed={activeTab === "credits"} onClick={() => setActiveTab("credits")}>Credits</button>
          <button type="button" aria-pressed={activeTab === "subscription"} onClick={() => setActiveTab("subscription")}>STAGE Plus</button>
        </nav>

        {activeTab === "credits" ? <section aria-label="Credit packs">
          <div className="store-section-heading"><div><p className="store-eyebrow">PLAY YOUR WAY</p><h2>Extra entries. On your terms.</h2></div><p>One-time purchases. Credits are separate from STC.</p></div>
          {creditConfirm && <p className="store-notice" role="status">{creditConfirm.credits} credits added. Balance: {credits.toLocaleString()} credits.</p>}
          <div className="store-packs">{CREDIT_PACKS.map(pack => <article className="store-pack" key={pack.id}>
            <p className="store-eyebrow">{pack.label}</p>
            <h3>{pack.credits}<small> credits</small></h3>
            <p>{pack.purpose} at the standard {TOURNAMENT_ENTRY_CREDITS}-credit entry cost.</p>
            <strong className="store-price">€{pack.price_eur.toFixed(2)}</strong>
            <button type="button" className="store-action" disabled={!!purchasing || !player} onClick={() => handleCreditPurchase(pack)}>{purchasing === pack.id ? "Opening checkout…" : `Buy ${pack.credits} credits`}<ArrowUpRight size={18} /></button>
          </article>)}</div>
          <aside className="store-callout"><div><h2>Play regularly?</h2><p>STAGE Plus includes a monthly {STAGE_PLUS_MONTHLY_CREDITS}-credit allowance and access to more competition features.</p><p className="store-muted">Credit packs do not unlock Plus-only features. Entry costs and eligibility still apply.</p></div><button type="button" className="store-action" onClick={() => setActiveTab("subscription")}>Explore STAGE Plus <ArrowUpRight size={18} /></button></aside>
        </section> : <section aria-label="STAGE Plus membership">
          <div className="store-section-heading"><div><p className="store-eyebrow">YOUR MEMBERSHIP</p><h2>{storeConfig.headline}</h2></div>
            <div className="store-billing" aria-label="Billing period"><button type="button" aria-pressed={subBilling === "monthly"} onClick={() => setSubBilling("monthly")}>Monthly</button><button type="button" aria-pressed={subBilling === "yearly"} onClick={() => setSubBilling("yearly")}>Yearly · save {saving}%</button></div>
          </div>
          {subError && <p className="store-notice store-error" role="alert">{subError}</p>}
          <div className="store-membership">
            <article className="store-plan">
              <div className="store-plan-title">{storeConfig.badge_image_url ? <img src={storeConfig.badge_image_url} alt="STAGE Plus" /> : <Crown size={36} />}<h3>{storeConfig.name}</h3></div>
              <p>{storeConfig.description}</p>
              <p className="store-price">€{price.toFixed(2)}<small> / {subBilling === "yearly" ? "year" : "month"}</small></p>
              <p className="store-muted">{subBilling === "yearly" ? "Billed annually. The credit allowance refreshes monthly." : "Billed monthly. Renews unless cancelled."}</p>
              {plusActive ? <div className="store-plan-status"><p><Check size={18} /> Your Plus membership is active.</p>{cancelling ? <p>{expiry ? `Renewal cancelled. Access continues until ${expiry}.` : "Renewal cancelled. Access continues until the end of your current period."}</p> : <button type="button" className="store-action store-secondary" disabled={!!purchasing} onClick={handleCancelSubscription}>{purchasing === "cancel_stage_plus" ? "Cancelling…" : t("commonPages.storeCancelSubscription")}</button>}</div>
                : <button type="button" className="store-action" disabled={!!purchasing || !player} onClick={handleSubscription}>{purchasing === "sub_stage_plus" ? "Opening checkout…" : `Subscribe — €${price.toFixed(2)}/${subBilling === "yearly" ? "year" : "month"}`}<ArrowUpRight size={18} /></button>}
              {!player && <p>Create a player profile before purchasing.</p>}
              <p className="store-muted">Your membership is personal. A Manager’s Plus plan does not cover the club’s other players.</p>
            </article>
            <article className="store-benefits"><p className="store-eyebrow">WHAT IS INCLUDED</p><h3>Built for your football life.</h3><ul>{storeConfig.perks.map(perk => <li key={perk}><Check size={18} /><span>{perk}</span></li>)}</ul>
              <p className="store-muted">GOST is not open yet. Competition entry, qualification, squad eligibility and applicable fees are separate requirements.</p>
            </article>
          </div>
          <aside className="store-callout"><div><h2>Start free.</h2><p>New accounts start with {TOURNAMENT_ENTRY_CREDITS} credits — enough for one standard community tournament entry. Top-ups are optional.</p></div><button type="button" className="store-action store-secondary" onClick={() => setActiveTab("credits")}>Browse credit packs <ArrowUpRight size={18} /></button></aside>
        </section>}
        <footer className="store-footer">Secure checkout opens with our payment provider. Review the total before confirming payment. <a href="/wallet">View your wallet →</a></footer>
      </div>
    </main>
  );
}
