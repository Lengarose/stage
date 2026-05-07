import { useState, useEffect, useCallback } from "react";
import { stageClient } from "@/api/stageClient";
import { LIFESTYLE_CATEGORIES, LIFESTYLE_TIER_STYLES } from "@/lib/lifestyleItems";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, TrendingUp, ShoppingBag, Package, Zap, Home, Car } from "lucide-react";
import LifestyleStoreGrid from "@/components/lifestyle/LifestyleStoreGrid";
import MyAssetsTab from "@/components/lifestyle/MyAssetsTab";
import STCWallet from "@/components/lifestyle/STCWallet";
import ChooseResidenceBanner from "@/components/lifestyle/ChooseResidenceBanner";

export default function Lifestyle() {
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("store");
  const [activeCategory, setActiveCategory] = useState("all");
  const [notification, setNotification] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [collecting, setCollecting] = useState(false);

  const load = useCallback(async () => {
    const u = await stageClient.auth.me();
    setUser(u);
    const [players, storeItems] = await Promise.all([
      stageClient.entities.Player.filter({ email: u.email }),
      stageClient.entities.LifestyleItem.filter({ is_active: true }, "sort_order", 100),
    ]);
    const pl = players[0];
    setPlayer(pl || null);
    setItems(storeItems);
    if (pl) {
      const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: pl.id }, "-created_date", 200);
      setPurchases(owned);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showNotif(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }

  // onBuy now accepts (item, locationData) where locationData may include purchase_intent
  async function handleBuy(item, locationData = {}) {
    if (!player) return;
    setPurchasing(item.id);
    try {
      const res = await stageClient.functions.invoke("buyLifestyleItem", {
        item_id: item.id,
        location_city: locationData.location_city || "",
        location_country: locationData.location_country || "",
        location_emoji: locationData.location_emoji || "",
        purchase_intent: locationData.purchase_intent || "invest",
      });
      setPlayer(prev => ({ ...prev, stc: res.data.new_stc_balance }));
      // Re-fetch purchases to get full object with new fields
      const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: player.id }, "-created_date", 200);
      setPurchases(owned);
      showNotif(`${item.name}${locationData.location_city ? ` in ${locationData.location_city}` : ""} purchased!`, "success");
    } catch (err) {
      showNotif(err.response?.data?.error || err.message || "Purchase failed", "error");
    }
    setPurchasing(null);
  }

  async function handleRent(item) {
    if (!player) return;
    setPurchasing(item.id);
    try {
      const res = await stageClient.functions.invoke("rentLifestyleItem", { item_id: item.id });
      setPlayer(prev => ({ ...prev, stc: res.data.new_stc_balance }));
      const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: player.id }, "-created_date", 200);
      setPurchases(owned);
      showNotif(`Now renting ${item.name} — ${item.rent_price_stc?.toLocaleString()} STC/month`, "success");
    } catch (err) {
      showNotif(err.message || "Rent failed", "error");
    }
    setPurchasing(null);
  }

  async function handleCollect() {
    setCollecting(true);
    try {
      const res = await stageClient.functions.invoke("collectPassiveIncome", {});
      if (res.data.collected > 0) {
        showNotif(`+${res.data.collected.toLocaleString()} STC collected from your properties!`, "success");
        await load();
      } else {
        showNotif("Nothing to collect yet. Check back later.", "info");
      }
    } catch (err) {
      showNotif("Failed to collect income", "error");
    }
    setCollecting(false);
  }

  function handleUpgraded(purchaseId, data) {
    setPurchases(prev => prev.map(p =>
      p.id === purchaseId
        ? {
            ...p,
            upgrade_level: data.upgrade_level,
            current_value_stc: data.new_value || (p.current_value_stc || p.price_paid_stc || 0) + (data.cost || 0),
            weekly_maintenance_stc: data.new_maintenance || p.weekly_maintenance_stc,
          }
        : p
    ));
    setPlayer(prev => prev ? { ...prev, stc: data.new_stc_balance } : prev);
  }

  const filteredItems = activeCategory === "all" ? items : items.filter(i => i.category === activeCategory);
  const stc = player?.stc || 0;
  const hasPassiveItems = purchases.some(p => items.find(i => i.id === p.item_id)?.passive_income_stc > 0);
  const hasResidence = purchases.some(p => p.is_residence === true);

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}>
              LIFESTYLE
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Own multiple assets. Upgrade them. Build your empire.</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success/10 border border-success/20">
              <Coins className="w-4 h-4 text-success" />
              <span className="font-light text-success text-xl tracking-tight">{stc.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">STC</span>
            </div>
            {hasPassiveItems && (
              <Button variant="outline" size="sm" onClick={handleCollect} disabled={collecting} className="gap-2 border-warning/30 text-warning hover:bg-warning/10">
                {collecting
                  ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <TrendingUp className="w-3.5 h-3.5" />}
                Collect Income
              </Button>
            )}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={cn("fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium border",
            notification.type === "success" ? "bg-success/20 border-success/30 text-success"
            : notification.type === "info" ? "bg-primary/20 border-primary/30 text-primary"
            : "bg-destructive/20 border-destructive/30 text-destructive"
          )}>
            {notification.msg}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-6">
            {[
              { id: "store",      label: "Store",       icon: ShoppingBag },
              { id: "assets",     label: "My Assets",   icon: Home },
              { id: "wallet",     label: "STC Wallet",  icon: Zap },
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent pb-3 pt-3 text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors",
                "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
              )}>
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "assets" && purchases.length > 0 && (
                  <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold ml-1">
                    {purchases.length}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Store */}
          <TabsContent value="store">
            {/* Residence prompt — only shown when no real_estate purchases */}
            {!hasResidence && (
              <div className="mb-5">
                <ChooseResidenceBanner onGoToStore={() => setActiveCategory("real_estate")} />
              </div>
            )}

            <div className="flex gap-2 flex-wrap mb-6">
              <button
                onClick={() => setActiveCategory("all")}
                className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  activeCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                All
              </button>
              {LIFESTYLE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    activeCategory === cat.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No items in this category yet.</p>
              </div>
            ) : (
              <LifestyleStoreGrid
                items={filteredItems}
                stc={stc}
                purchases={purchases}
                purchasing={purchasing}
                hasResidence={hasResidence}
                onBuy={handleBuy}
                onRent={handleRent}
              />
            )}
          </TabsContent>

          {/* My Assets */}
          <TabsContent value="assets">
            <MyAssetsTab
              purchases={purchases}
              items={items}
              playerStc={stc}
              onUpgraded={handleUpgraded}
              onCancelRent={(purchaseId) => setPurchases(prev => prev.filter(p => p.id !== purchaseId))}
              onResidenceChanged={async () => {
                if (player) {
                  const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: player.id }, "-created_date", 200);
                  setPurchases(owned);
                }
              }}
            />
          </TabsContent>

          {/* Wallet */}
          <TabsContent value="wallet">
            <STCWallet player={player} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}