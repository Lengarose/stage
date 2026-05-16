import { useState, useEffect, useCallback } from 'react';
import { stageClient } from '@/api/stageClient';
import { cn } from '@/lib/utils';
import { LIFESTYLE_CATEGORIES, resolveCategory, formatSTC, getAssetImage, LIFESTYLE_TIER_STYLES } from '@/lib/lifestyleItems';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Coins, TrendingUp, ShoppingBag, Package, CalendarClock, Zap, Tag, Check,
  Clock, ArrowUpRight,
} from 'lucide-react';
import LifestyleAssetCard from '@/components/lifestyle/LifestyleAssetCard';
import LifestyleActionModal from '@/components/lifestyle/LifestyleActionModal';
import STCWallet from '@/components/lifestyle/STCWallet';
import { useToast } from '@/components/ui/use-toast';

const VISIBLE_CATEGORIES = LIFESTYLE_CATEGORIES.filter(c => !c.hidden);

export default function Lifestyle() {
  const { toast } = useToast();

  const [player, setPlayer]         = useState(null);
  const [items, setItems]           = useState([]);
  const [purchases, setPurchases]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('store');
  const [activeCat, setActiveCat]   = useState('all');
  const [modal, setModal]           = useState(null); // { action, item, purchase }
  const [actionLoading, setActLoad] = useState(false);
  const [collectingPassive, setCP]  = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await stageClient.auth.me();
      if (!u?.email) { setLoading(false); return; }
      const [players, storeItems] = await Promise.all([
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.LifestyleItem.filter({ is_active: true }, 'sort_order', 200),
      ]);
      const pl = players[0] || null;
      setPlayer(pl);
      setItems(storeItems);
      if (pl) {
        const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: pl.id }, '-created_date', 500);
        setPurchases(owned.filter(p => p.status !== 'sold'));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function reloadPurchases() {
    if (!player) return;
    const owned = await stageClient.entities.LifestylePurchase.filter({ player_id: player.id }, '-created_date', 500).catch(() => []);
    setPurchases(owned.filter(p => p.status !== 'sold'));
  }

  function openModal(action, item, purchase = null) {
    setModal({ action, item, purchase });
  }

  async function handleConfirm(actionPayload = {}) {
    if (!modal) return;
    const { action, item, purchase } = modal;
    setActLoad(true);
    try {
      let res;
      if (action === 'buy') {
        res = await stageClient.functions.invoke('buyLifestyleItem', { item_id: item.id, ...actionPayload });
      } else if (action === 'rent') {
        res = await stageClient.functions.invoke('rentLifestyleItem', { item_id: item.id, ...actionPayload });
      } else if (action === 'invest') {
        res = await stageClient.functions.invoke('investInLifestyleItem', { item_id: item.id, ...actionPayload });
      } else if (action === 'sell') {
        res = await stageClient.functions.invoke('sellLifestyleAsset', { purchase_id: purchase.id });
      }
      const newBal = res?.data?.new_stc_balance ?? res?.data?.new_balance;
      if (newBal != null) setPlayer(prev => prev ? { ...prev, stc: newBal } : prev);
      await reloadPurchases();
      const labels = { buy: 'Purchased', rent: 'Now renting', invest: 'Investment placed', sell: 'Sold' };
      toast({ title: `${labels[action]}: ${item.name}`, description: newBal != null ? `Balance: ${formatSTC(newBal)} STC` : undefined });
      setModal(null);
    } catch (err) {
      toast({ title: 'Action failed', description: err.response?.data?.error || err.message, variant: 'destructive' });
    }
    setActLoad(false);
  }

  async function handleCollectPassive() {
    setCP(true);
    try {
      const res = await stageClient.functions.invoke('collectPassiveIncome', {});
      const collected = res?.data?.collected || 0;
      if (collected > 0) {
        toast({ title: `+${formatSTC(collected)} STC collected`, description: 'Passive income from your assets' });
        setPlayer(prev => prev ? { ...prev, stc: (Number(prev.stc) || 0) + collected } : prev);
        await reloadPurchases();
      } else {
        toast({ title: 'Nothing to collect yet', description: 'Passive income resets on its interval' });
      }
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
    setCP(false);
  }

  async function handleCollectReturn(purchase) {
    try {
      const res = await stageClient.functions.invoke('collectInvestmentReturn', { purchase_id: purchase.id });
      const { total, returns } = res?.data || {};
      toast({ title: `Investment collected!`, description: `+${formatSTC(total)} STC (${formatSTC(returns)} return)` });
      if (res?.data?.new_stc_balance != null) setPlayer(prev => prev ? { ...prev, stc: res.data.new_stc_balance } : prev);
      await reloadPurchases();
    } catch (err) {
      toast({ title: 'Failed', description: err.response?.data?.error || err.message, variant: 'destructive' });
    }
  }

  const stc = Number(player?.stc || 0);

  // Filter items by active category (support both new and legacy category IDs)
  const filteredItems = activeCat === 'all'
    ? items
    : items.filter(item => {
        const cat = item.category || 'fashion';
        return cat === activeCat || resolveCategory(cat) === activeCat;
      });

  const ownedPurchases    = purchases.filter(p => p.purchase_type === 'buy'    && p.status === 'active');
  const rentedPurchases   = purchases.filter(p => p.purchase_type === 'rent'   && p.status === 'active');
  const investedPurchases = purchases.filter(p => p.purchase_type === 'invest' && (p.status === 'active'));

  const hasPassiveItems = items.some(i => i.passive_income_stc > 0 && ownedPurchases.some(p => p.item_id === i.id));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-black text-5xl md:text-6xl uppercase tracking-tight text-foreground"
              style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center' }}>
              LIFESTYLE
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Own, rent, and invest across luxury asset categories.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="font-light text-emerald-400 text-xl tracking-tight">{stc.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">STC</span>
            </div>
            {hasPassiveItems && (
              <Button variant="outline" size="sm" onClick={handleCollectPassive} disabled={collectingPassive}
                className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs">
                {collectingPassive
                  ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <TrendingUp className="w-3.5 h-3.5" />}
                Collect Income
              </Button>
            )}
          </div>
        </div>

        {/* Portfolio stats strip */}
        {(ownedPurchases.length > 0 || rentedPurchases.length > 0 || investedPurchases.length > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <StatPill icon={<Package className="w-4 h-4 text-emerald-400" />} label="Owned" value={ownedPurchases.length} color="emerald" />
            <StatPill icon={<CalendarClock className="w-4 h-4 text-blue-400" />} label="Renting" value={rentedPurchases.length} color="blue" />
            <StatPill icon={<TrendingUp className="w-4 h-4 text-amber-400" />} label="Investing" value={investedPurchases.length} color="amber" />
          </div>
        )}

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-6">
            {[
              { id: 'store',   label: 'Browse',      icon: ShoppingBag },
              { id: 'assets',  label: `My Assets`,   icon: Package,    count: ownedPurchases.length },
              { id: 'rentals', label: 'My Rentals',  icon: CalendarClock, count: rentedPurchases.length },
              { id: 'invests', label: 'My Investments', icon: TrendingUp, count: investedPurchases.length },
              { id: 'wallet',  label: 'Wallet',      icon: Zap },
            ].map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent pb-3 pt-3 text-[11px] uppercase tracking-widest font-bold text-muted-foreground transition-colors',
                'data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent'
              )}>
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold ml-0.5">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── STORE ─────────────────────────────────────────── */}
          <TabsContent value="store" className="space-y-5">
            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
              <CatPill active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="All" emoji="✨" />
              {VISIBLE_CATEGORIES.map(cat => (
                <CatPill key={cat.id} active={activeCat === cat.id} onClick={() => setActiveCat(cat.id)} label={cat.label} emoji={cat.emoji} />
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No assets in this category yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map(item => (
                  <LifestyleAssetCard
                    key={item.id}
                    item={item}
                    playerStc={stc}
                    purchases={purchases}
                    onAction={(action, itm, purch) => openModal(action, itm, purch)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── MY ASSETS ─────────────────────────────────────── */}
          <TabsContent value="assets">
            {ownedPurchases.length === 0 ? (
              <EmptyState icon={Package} label="You don't own any assets yet" cta="Browse the store" onCta={() => setActiveTab('store')} />
            ) : (
              <div className="space-y-4">
                <SectionHeader title="Owned Assets" count={ownedPurchases.length} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedPurchases.map(purch => {
                    const item = items.find(i => i.id === purch.item_id);
                    if (!item) return null;
                    const tier = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.standard;
                    const img = getAssetImage(item);
                    const canCollect = item.passive_income_stc > 0;
                    const sellPrice = item.can_sell
                      ? Math.floor(Number(purch.price_paid_stc || item.price_stc || 0) * (item.sell_value_percent || 60) / 100)
                      : 0;
                    return (
                      <OwnedCard
                        key={purch.id}
                        purch={purch}
                        item={item}
                        img={img}
                        tier={tier}
                        canCollect={canCollect}
                        sellPrice={sellPrice}
                        onSell={() => openModal('sell', item, purch)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── MY RENTALS ────────────────────────────────────── */}
          <TabsContent value="rentals">
            {rentedPurchases.length === 0 ? (
              <EmptyState icon={CalendarClock} label="No active rentals" cta="Browse rentable assets" onCta={() => setActiveTab('store')} />
            ) : (
              <div className="space-y-4">
                <SectionHeader title="Active Rentals" count={rentedPurchases.length} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rentedPurchases.map(purch => {
                    const item = items.find(i => i.id === purch.item_id);
                    if (!item) return null;
                    const tier = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.standard;
                    const endDate = purch.rent_end_date ? new Date(purch.rent_end_date) : null;
                    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - Date.now()) / 86400000)) : null;
                    const expired = daysLeft === 0;
                    return (
                      <div key={purch.id} className={cn('rounded-2xl border overflow-hidden', tier.bg)}>
                        <div className="relative h-36 overflow-hidden">
                          <img src={getAssetImage(item)} alt={item.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <div className={cn('absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full', tier.badge)}>{tier.label}</div>
                          <div className={cn('absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] font-bold px-2 py-1.5 rounded-full', expired ? 'bg-destructive/80 text-white' : 'bg-blue-500/80 text-white')}>
                            <Clock className="w-3 h-3" />
                            {daysLeft !== null ? (expired ? 'Expired' : `${daysLeft}d left`) : 'Active'}
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-foreground text-sm">{item.name}</p>
                          <LocationLine purchase={purch} />
                          <p className="text-xs text-muted-foreground mt-0.5">Paid: {formatSTC(purch.price_paid_stc)} STC</p>
                          {endDate && (
                            <p className="text-xs text-muted-foreground">Expires: {endDate.toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── MY INVESTMENTS ────────────────────────────────── */}
          <TabsContent value="invests">
            {investedPurchases.length === 0 ? (
              <EmptyState icon={TrendingUp} label="No active investments" cta="Browse investable assets" onCta={() => setActiveTab('store')} />
            ) : (
              <div className="space-y-4">
                <SectionHeader title="Active Investments" count={investedPurchases.length} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {investedPurchases.map(purch => {
                    const item = items.find(i => i.id === purch.item_id);
                    if (!item) return null;
                    const tier = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.standard;
                    const endDate = purch.invest_end_date ? new Date(purch.invest_end_date) : null;
                    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - Date.now()) / 86400000)) : null;
                    const matured = daysLeft === 0;
                    const principal = Number(purch.price_paid_stc || 0);
                    const returns = Number(purch.invest_return_amount || 0);
                    return (
                      <div key={purch.id} className={cn('rounded-2xl border overflow-hidden', tier.bg)}>
                        <div className="relative h-36 overflow-hidden">
                          <img src={getAssetImage(item)} alt={item.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <div className={cn('absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full', tier.badge)}>{tier.label}</div>
                          <div className={cn('absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] font-bold px-2 py-1.5 rounded-full', matured ? 'bg-emerald-500/90 text-black' : 'bg-amber-500/80 text-black')}>
                            <Clock className="w-3 h-3" />
                            {daysLeft !== null ? (matured ? 'Ready!' : `${daysLeft}d left`) : 'Active'}
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          <p className="font-bold text-foreground text-sm">{item.name}</p>
                          <LocationLine purchase={purch} />
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Principal</span>
                              <span className="font-medium">{formatSTC(principal)} STC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Return</span>
                              <span className="font-medium text-emerald-400">+{formatSTC(returns)} STC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total payout</span>
                              <span className="font-bold text-emerald-400">{formatSTC(principal + returns)} STC</span>
                            </div>
                            {endDate && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Matures</span>
                                <span className="font-medium">{endDate.toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          {matured && (
                            <Button size="sm" className="w-full mt-1 bg-emerald-500 text-black hover:bg-emerald-600 font-bold text-xs h-8 gap-1.5"
                              onClick={() => handleCollectReturn(purch)}>
                              <ArrowUpRight className="w-3.5 h-3.5" /> Collect Return
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── WALLET ────────────────────────────────────────── */}
          <TabsContent value="wallet">
            <STCWallet player={player} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Action modal */}
      {modal && (
        <LifestyleActionModal
          open={!!modal}
          onClose={() => !actionLoading && setModal(null)}
          action={modal.action}
          item={modal.item}
          purchase={modal.purchase}
          playerStc={stc}
          loading={actionLoading}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function StatPill({ icon, label, value, color }) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    blue:    'bg-blue-500/10 border-blue-500/20',
    amber:   'bg-amber-500/10 border-amber-500/20',
  };
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border', colorMap[color] || colorMap.emerald)}>
      {icon}
      <div>
        <p className="text-lg font-light leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function CatPill({ active, onClick, label, emoji }) {
  return (
    <button onClick={onClick} className={cn(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-secondary text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
    )}>
      <span>{emoji}</span> {label}
    </button>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="font-heading font-bold text-lg uppercase tracking-tight text-foreground">{title}</h2>
      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">{count}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, label, cta, onCta }) {
  return (
    <div className="text-center py-16 space-y-3">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {cta && onCta && (
        <button onClick={onCta} className="text-xs text-primary hover:underline">{cta} →</button>
      )}
    </div>
  );
}

function OwnedCard({ purch, item, img, tier, canCollect, sellPrice, onSell }) {
  const purchasedDate = purch.created_date ? new Date(purch.created_date) : null;
  return (
    <div className={cn('rounded-2xl border overflow-hidden', tier.bg)}>
      <div className="relative h-36 overflow-hidden">
        <img src={img} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className={cn('absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full', tier.badge)}>{tier.label}</div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-500/90 text-black text-[10px] font-bold px-2 py-1.5 rounded-full">
          <Check className="w-3 h-3" /> Owned
        </div>
        {canCollect && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-amber-400/90 text-black text-[10px] font-bold px-2 py-1 rounded-full">
            +{formatSTC(item.passive_income_stc)}/{item.passive_income_interval_days}d
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="font-bold text-foreground text-sm">{item.name}</p>
        <LocationLine purchase={purch} />
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span>{formatSTC(purch.price_paid_stc || item.price_stc || 0)} STC</span>
          </div>
          {purchasedDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Acquired</span>
              <span>{purchasedDate.toLocaleDateString()}</span>
            </div>
          )}
          {item.weekly_maintenance_stc > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upkeep/wk</span>
              <span className="text-orange-400">{formatSTC(item.weekly_maintenance_stc)} STC</span>
            </div>
          )}
        </div>
        {item.can_sell && sellPrice > 0 && (
          <Button size="sm" variant="outline" className="w-full text-xs h-8 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5" onClick={onSell}>
            <Tag className="w-3 h-3" /> Sell for {formatSTC(sellPrice)} STC
          </Button>
        )}
      </div>
    </div>
  );
}

function LocationLine({ purchase }) {
  if (!purchase?.location_city && !purchase?.location_country) return null;
  return (
    <p className="text-[11px] text-muted-foreground mt-0.5">
      {purchase.location_emoji ? `${purchase.location_emoji} ` : ''}
      {purchase.location_city}{purchase.location_city && purchase.location_country ? ', ' : ''}{purchase.location_country}
    </p>
  );
}
