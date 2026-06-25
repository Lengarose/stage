import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { STORE_ITEMS, RARITY_STYLES } from "@/lib/storeItems";
import {
  COMMUNITY_TOURNAMENT_LIMIT,
  STAGE_PLUS_MONTHLY_CREDITS,
  STAGE_PLUS_PRICE,
  TIER_COLORS,
  TIER_LABELS,
  TOURNAMENT_ENTRY_CREDITS,
  hasStagePlus,
  normalizeSubscriptionTier,
} from "@/lib/subscriptionUtils";
import { ShoppingBag, Coins, Check, Crown, Shield, Plus, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { swalAlert } from "@/lib/swal";

const TYPE_LABELS = { credits: "Credits", subscription: "Subscriptions" };
const TYPE_ICONS = { credits: Coins, subscription: Crown };
const DEFAULT_STORE_CONFIG = {
  name: "STAGE Plus",
  stage_plus_monthly_price: STAGE_PLUS_PRICE.monthly,
  stage_plus_yearly_price: STAGE_PLUS_PRICE.yearly,
  monthly_credits: STAGE_PLUS_MONTHLY_CREDITS,
  starter_credits: TOURNAMENT_ENTRY_CREDITS,
  tournament_entry_credits: TOURNAMENT_ENTRY_CREDITS,
  community_tournament_limit: COMMUNITY_TOURNAMENT_LIMIT,
  headline: "One membership for serious competitors",
  description: "STAGE Plus unlocks official competitions, tournament creation, ranked play, and a monthly credit refresh.",
  badge_image_url: "/uploads/stage-plus-badge.png",
  perks: [],
};

const CREDIT_PACKS = [
  { id: "credits_100",  credits: 100,  price_eur: 0.99, stripe_price_id: "price_1TOayT2fnaWmNMFQby00tHqR", label: null },
  { id: "credits_300",  credits: 300,  price_eur: 2.49, stripe_price_id: "price_1TOb0I2fnaWmNMFQyryD4Rpc", label: "Most Popular", highlight: "primary" },
  { id: "credits_700",  credits: 700,  price_eur: 4.99, stripe_price_id: "price_1TOb1N2fnaWmNMFQIcd2HIuy", label: "Best Value", highlight: "success" },
  { id: "credits_1500", credits: 1500, price_eur: 9.99, stripe_price_id: "price_1TOb2Y2fnaWmNMFQArERKaS1", label: null },
];

const BADGE_IMAGES = {};

export default function Store() {
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [notification, setNotification] = useState(null);
  const [creditConfirm, setCreditConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState("credits");
  const [creditTarget, setCreditTarget] = useState("player");
  const [subBilling, setSubBilling] = useState("monthly");
  const [subError, setSubError] = useState(null);
  const [storeConfig, setStoreConfig] = useState(DEFAULT_STORE_CONFIG);

  useEffect(() => {
    async function load() {
      const cfgRows = await stageClient.entities.StoreConfig.filter({ is_active: 1, with_defaults: 1 }, "-updated_date", 1).catch(() => []);
      const cfg = { ...DEFAULT_STORE_CONFIG, ...(cfgRows?.[0] || {}) };
      setStoreConfig(cfg);
      const { user: u, player: pl, club } = await resolveMyPlayerAndClub();
      if (!u) { setLoading(false); return; }
      setUser(u);
      if (pl) {
        setPlayer(pl);
        if (club) setMyClub(club);
      }
      const mode = localStorage.getItem("stage-account-mode") || "player";
      if (mode === "club") setCreditTarget("club");

      const params = new URLSearchParams(window.location.search);
      if (params.get('sub') === 'success') {
        setActiveTab('subscription');
        window.history.replaceState({}, '', '/store');
        try {
          const fixRes = await stageClient.functions.invoke('fixSubscription', {
            session_id: params.get('session_id'),
          });
          if (fixRes.data?.success) {
            const refreshedPl = u.player_id
              ? await stageClient.entities.Player.get(u.player_id).catch(() => null)
              : null;
            if (refreshedPl) setPlayer(refreshedPl);
            showNotif(`STAGE Plus activated. Monthly credits refresh to ${Number(cfg.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS)}.`, 'success');
          } else {
            showNotif('Subscription activated! It may take a moment to reflect.', 'success');
          }
        } catch (e) {
          showNotif('Subscription activated! It may take a moment to reflect.', 'success');
        }
      } else if (params.get('sub') === 'cancelled') {
        showNotif('Subscription cancelled.', 'error');
        window.history.replaceState({}, '', '/store');
      }
      if (params.get('payment') === 'success') {
        const credits = parseInt(params.get('credits') || '0');
        const target = params.get('target') || 'player';
        const pack = params.get('pack');
        if (credits > 0) {
          setCreditConfirm({ credits, target, id: pack });
          showNotif(`+${credits} credits added!`, 'success');
        }
        window.history.replaceState({}, '', '/store');
      } else if (params.get('payment') === 'cancelled') {
        showNotif('Payment cancelled.', 'error');
        window.history.replaceState({}, '', '/store');
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleCreditPurchase(pack) {
    if (!player) { showNotif("Create a player profile first!", "error"); return; }
    if (window.self !== window.top) { await swalAlert("Checkout is only available from the published app, not the preview."); return; }
    setPurchasing(pack.id);
    try {
      const res = await stageClient.functions.invoke('stripeCheckout', {
        packId: pack.id,
        creditTarget,
        successUrl: `${window.location.origin}/store?payment=success&pack=${pack.id}&credits=${pack.credits}&target=${creditTarget}`,
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
    if (window.self !== window.top) { await swalAlert('Checkout is only available from the published app.'); return; }
    if (hasStagePlus(player?.subscription) && player?.subscription_expires_at) {
      const expires = new Date(player.subscription_expires_at);
      if (expires > new Date()) {
        setSubError(`STAGE Plus is active until ${expires.toLocaleDateString('en-GB')}.`);
        return;
      }
    }
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


  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  const credits = creditTarget === "club" ? (myClub?.credits ?? 0) : (player?.credits ?? 0);
  const categories = ["credits", "subscription"];
  const currentTier = normalizeSubscriptionTier(player?.subscription);
  const badgeImg = currentTier === "stage_plus" ? storeConfig.badge_image_url : BADGE_IMAGES[`sub_${currentTier}`];
  const tierLabel = TIER_LABELS[currentTier];
  const tierColor = TIER_COLORS[currentTier];
  const monthlyCredits = Number(storeConfig.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS);
  const starterCredits = Number(storeConfig.starter_credits || TOURNAMENT_ENTRY_CREDITS);
  const entryCredits = Number(storeConfig.tournament_entry_credits || TOURNAMENT_ENTRY_CREDITS);
  const tournamentLimit = Number(storeConfig.community_tournament_limit || COMMUNITY_TOURNAMENT_LIMIT);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                STORE
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Customize your profile and club with exclusive items</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {myClub && (
              <div className="flex items-center gap-1 rounded-xl bg-secondary border border-border p-1">
                <button onClick={() => setCreditTarget("player")} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5", creditTarget === "player" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <User className="w-3 h-3" /> Player
                </button>
                <button onClick={() => setCreditTarget("club")} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5", creditTarget === "club" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <Shield className="w-3 h-3" /> Club
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
              <Coins className="w-4 h-4 text-warning shrink-0" />
              <span className="font-bold text-warning">{credits.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{creditTarget === "club" ? "club credits" : "credits"}</span>
            </div>
          </div>
        </div>

        {notification && (
          <div className={cn("fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium border",
            notification.type === "success" ? "bg-success/20 border-success/30 text-success" : "bg-destructive/20 border-destructive/30 text-destructive"
          )}>
            {notification.msg}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-card border border-warning/20 rounded-2xl p-4 sm:p-5 flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">STAGE Credits</p>
              <p className="font-heading text-2xl font-black text-warning">{credits.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-card border border-primary/20 rounded-2xl p-4 sm:p-5 flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
              {badgeImg ? <img src={badgeImg} alt={currentTier} className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Current Plan</p>
              <p className={cn("font-heading text-xl font-black", tierColor)}>{tierLabel}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-6">
            {categories.map(cat => {
              const Icon = TYPE_ICONS[cat];
              return (
                <TabsTrigger key={cat} value={cat} className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent pb-3 pt-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors min-w-0",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                )}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{TYPE_LABELS[cat]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="credits">
            {creditConfirm && (
              <div className="mb-6 flex items-center gap-4 bg-success/10 border border-success/30 rounded-2xl px-4 sm:px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-success">+{creditConfirm.credits} credits added!</p>
                  <p className="text-sm text-muted-foreground">Balance: <strong className="text-warning">{credits.toLocaleString()} credits</strong></p>
                </div>
                <button onClick={() => setCreditConfirm(null)} className="text-muted-foreground hover:text-foreground text-xl shrink-0">×</button>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              {CREDIT_PACKS.map(pack => (
                <CreditPackCard key={pack.id} pack={pack} purchasing={purchasing === pack.id} onBuy={() => handleCreditPurchase(pack)} />
              ))}
            </div>
            <div className="bg-gradient-to-r from-primary/10 via-card to-accent/10 border border-primary/20 rounded-2xl p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground mb-1">STAGE Plus unlocks the full competition loop</h3>
                  <p className="text-sm text-muted-foreground mb-4">Free accounts start with {starterCredits} credits. After that, Plus unlocks tournament creation, official competition access, ranked play, and a monthly credit refresh.</p>
                  <div className="grid sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                      <p className="font-bold text-primary text-sm">{monthlyCredits} credits</p>
                      <p className="text-xs text-muted-foreground">Monthly allowance refresh, not stacked</p>
                    </div>
                    <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
                      <p className="font-bold text-warning text-sm">{entryCredits} credits</p>
                      <p className="text-xs text-muted-foreground">Standard tournament entry cost</p>
                    </div>
                    <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                      <p className="font-bold text-success text-sm">{tournamentLimit} tournaments</p>
                      <p className="text-xs text-muted-foreground">Active community tournament slots</p>
                    </div>
                  </div>
                  <Button onClick={() => setActiveTab("subscription")} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 gap-2">
                    <Crown className="w-4 h-4" /> View STAGE Plus
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subscription">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-1 rounded-xl bg-secondary border border-border p-1">
                <button onClick={() => setSubBilling('monthly')} className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-all", subBilling === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Monthly</button>
                <button onClick={() => setSubBilling('yearly')} className={cn("px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5", subBilling === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  Yearly <span className="text-[10px] font-bold bg-success/20 text-success px-1.5 py-0.5 rounded-full">Save 25%</span>
                </button>
              </div>
              {hasStagePlus(player?.subscription) && player?.subscription_expires_at && (
                <div className="text-xs text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2">
                  Expires: <strong className="text-foreground">{new Date(player.subscription_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </div>
              )}
            </div>
            {subError && (
              <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">{subError}</div>
            )}
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 sm:gap-6">
              {STORE_ITEMS.filter(i => i.type === "subscription").map(item => (
                <SubCard key={item.id} item={item}
                  purchasing={purchasing === item.id}
                  onBuy={handleSubscription}
                  currentTier={currentTier} billing={subBilling} expiresAt={player?.subscription_expires_at}
                  storeConfig={storeConfig}
                />
              ))}
              <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Free Account</p>
                  <h3 className="text-2xl font-bold text-foreground">Start with {starterCredits} credits</h3>
                  <p className="text-sm text-muted-foreground mt-2">Enough for one tournament entry. Credit packs stay available for extra entries or club spending without changing your subscription.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-secondary/60 p-3">
                    <p className="text-2xl font-black text-warning">{starterCredits}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Starter credits</p>
                  </div>
                  <div className="rounded-xl border border-border bg-secondary/60 p-3">
                    <p className="text-2xl font-black text-primary">1</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Tournament entry</p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab("credits")} variant="outline" className="w-full border-warning/30 text-warning hover:bg-warning/10 gap-2">
                  <Coins className="w-4 h-4" /> Buy Credits Separately
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CreditPackCard({ pack, purchasing, onBuy }) {
  const isPopular = pack.highlight === "primary";
  const isBest = pack.highlight === "success";
  return (
    <div className={cn("relative bg-card border rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all",
      isPopular && "border-primary/50 shadow-lg shadow-primary/10",
      isBest && "border-success/50 shadow-lg shadow-success/10",
      !isPopular && !isBest && "border-border"
    )}>
      {pack.label && (
        <div className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
          isPopular && "bg-primary text-primary-foreground border-primary",
          isBest && "bg-success text-black border-success"
        )}>{pack.label}</div>
      )}
      <div className="text-center pt-2">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Coins className={cn("w-4 h-4 sm:w-5 sm:h-5", isPopular ? "text-primary" : isBest ? "text-success" : "text-warning")} />
          <span className={cn("text-2xl sm:text-3xl font-black", isPopular ? "text-primary" : isBest ? "text-success" : "text-foreground")}>{pack.credits.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground">credits</p>
      </div>
      <div className="text-center">
        <p className="text-xl sm:text-2xl font-bold text-foreground">€{pack.price_eur.toFixed(2)}</p>
      </div>
      <Button onClick={onBuy} disabled={purchasing} className={cn("w-full font-bold",
        isPopular && "bg-primary text-primary-foreground hover:bg-primary/90",
        isBest && "bg-success text-black hover:bg-success/90",
        !isPopular && !isBest && "bg-secondary text-foreground border border-border hover:bg-secondary/80"
      )}>
        {purchasing ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Buy</>}
      </Button>
    </div>
  );
}

function SubCard({ item, purchasing, onBuy, currentTier, billing, expiresAt, storeConfig = DEFAULT_STORE_CONFIG }) {
  const rarity = RARITY_STYLES[item.rarity];
  const badgeImg = item.id === "sub_stage_plus" ? storeConfig.badge_image_url : BADGE_IMAGES[item.id];
  const tier = item.id.replace('sub_', '');
  const isCurrentTier = item.id === `sub_${currentTier}`;
  const hasActiveSub = hasStagePlus(currentTier) && expiresAt && new Date(expiresAt) > new Date();
  const prices = tier === "stage_plus"
    ? {
        monthly: Number(storeConfig.stage_plus_monthly_price || STAGE_PLUS_PRICE.monthly),
        yearly: Number(storeConfig.stage_plus_yearly_price || STAGE_PLUS_PRICE.yearly),
      }
    : null;
  const displayPrice = prices ? (billing === 'yearly' ? prices.yearly : prices.monthly) : null;
  const monthlyEquiv = prices && billing === 'yearly' ? (prices.yearly / 12).toFixed(2) : null;
  const monthlyCredits = Number(storeConfig.monthly_credits || STAGE_PLUS_MONTHLY_CREDITS);
  const entryCredits = Number(storeConfig.tournament_entry_credits || TOURNAMENT_ENTRY_CREDITS);
  const tournamentLimit = Number(storeConfig.community_tournament_limit || COMMUNITY_TOURNAMENT_LIMIT);
  const perks = Array.isArray(storeConfig.perks) && storeConfig.perks.length ? storeConfig.perks : item.perks;

  return (
    <div className={cn("bg-card border rounded-2xl p-5 sm:p-6 space-y-5 relative overflow-hidden transition-all", rarity.bg)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-cyan-300 to-success" />
      <div className="absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-20 bg-primary" />
      <div className="relative flex items-center gap-3">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-primary/15 border border-primary/30">
          {badgeImg ? <img src={badgeImg} alt={item.name} className="w-full h-full object-cover" /> : <Crown className={cn("w-6 h-6", rarity.color)} />}
        </div>
        <div className="min-w-0">
          <h3 className={cn("text-xl sm:text-2xl font-bold", rarity.color)}>{storeConfig.name || item.name}</h3>
          {displayPrice && (
            <div>
              <p className={cn("text-sm font-bold", rarity.color)}>€{displayPrice.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/{billing === 'yearly' ? 'year' : 'month'}</span></p>
              {monthlyEquiv && <p className="text-[10px] text-muted-foreground">≈ €{monthlyEquiv}/month</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{storeConfig.description || item.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-background/60 border border-border p-3">
          <p className="font-black text-warning">{monthlyCredits}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly credits</p>
        </div>
        <div className="rounded-xl bg-background/60 border border-border p-3">
          <p className="font-black text-primary">{entryCredits}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entry cost</p>
        </div>
        <div className="rounded-xl bg-background/60 border border-border p-3">
          <p className="font-black text-success">{tournamentLimit}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active events</p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {perks.map(perk => (
          <li key={perk} className="flex items-center gap-2 text-sm text-foreground">
            <Check className={cn("w-4 h-4 shrink-0", rarity.color)} />
            {perk}
          </li>
        ))}
      </ul>
      {isCurrentTier ? (
        <div className={cn("flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-xl border", rarity.color, rarity.bg)}>
          <Check className="w-4 h-4" /> Current Plan
        </div>
      ) : hasActiveSub ? (
        <div className="text-xs text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2">
          Available after {new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      ) : (
        <Button onClick={onBuy} disabled={purchasing} className={cn("w-full font-bold border", rarity.bg, rarity.color)}>
          {purchasing
            ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <>Subscribe — €{displayPrice?.toFixed(2)}/{billing === 'yearly' ? 'yr' : 'mo'}</>}
        </Button>
      )}
    </div>
  );
}
