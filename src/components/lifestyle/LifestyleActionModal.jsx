import { cn } from '@/lib/utils';
import { getAssetImage, formatSTC, LIFESTYLE_TIER_STYLES } from '@/lib/lifestyleItems';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart, CalendarClock, TrendingUp, Tag, ArrowRight, Coins, AlertTriangle } from 'lucide-react';

const ACTION_META = {
  buy:    { label: 'Buy Asset',          icon: ShoppingCart, color: 'emerald', priceKey: 'price_stc' },
  rent:   { label: 'Rent Asset',         icon: CalendarClock, color: 'blue',   priceKey: 'rent_price_stc' },
  invest: { label: 'Invest in Asset',    icon: TrendingUp,    color: 'amber',  priceKey: 'invest_price_stc' },
  sell:   { label: 'Sell Asset',         icon: Tag,           color: 'rose',   priceKey: null },
};

export default function LifestyleActionModal({ open, onClose, action, item, purchase, playerStc, loading, onConfirm }) {
  if (!item || !action) return null;

  const meta = ACTION_META[action];
  if (!meta) return null;

  const Icon = meta.icon;
  const tier = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.standard;

  let price = 0;
  let balanceAfter = playerStc;
  let details = [];

  if (action === 'buy') {
    price = Number(item.price_stc || 0);
    balanceAfter = playerStc - price;
    details = [
      { label: 'Buy price', value: `${formatSTC(price)} STC`, highlight: true },
      item.weekly_maintenance_stc > 0 && { label: 'Weekly upkeep', value: `${formatSTC(item.weekly_maintenance_stc)} STC/wk`, warn: true },
      item.passive_income_stc > 0 && { label: 'Passive income', value: `+${formatSTC(item.passive_income_stc)} STC / ${item.passive_income_interval_days}d`, good: true },
      item.can_sell && { label: 'Resale value', value: `~${formatSTC(Math.floor(price * (item.sell_value_percent || 60) / 100))} STC (${item.sell_value_percent}%)` },
    ].filter(Boolean);
  }

  if (action === 'rent') {
    price = Number(item.rent_price_stc || 0);
    balanceAfter = playerStc - price;
    details = [
      { label: 'Rent price', value: `${formatSTC(price)} STC`, highlight: true },
      { label: 'Duration', value: `${item.rent_duration_days} days` },
    ].filter(Boolean);
  }

  if (action === 'invest') {
    price = Number(item.invest_price_stc || item.price_stc || 0);
    const returnAmt = Math.floor(price * Number(item.invest_return_rate || 0) / 100);
    balanceAfter = playerStc - price;
    details = [
      { label: 'Investment',   value: `${formatSTC(price)} STC`, highlight: true },
      { label: 'Return rate',  value: `${item.invest_return_rate}%`, good: true },
      { label: 'You receive',  value: `${formatSTC(price + returnAmt)} STC`, good: true },
      { label: 'Matures in',   value: `${item.invest_duration_days} days` },
    ].filter(Boolean);
  }

  if (action === 'sell') {
    const paidPrice = Number(purchase?.price_paid_stc || item.price_stc || 0);
    price = -Math.floor(paidPrice * (item.sell_value_percent || 60) / 100); // negative = we receive
    balanceAfter = playerStc + Math.abs(price);
    details = [
      { label: 'Original price', value: `${formatSTC(paidPrice)} STC` },
      { label: 'Sell at',        value: `${item.sell_value_percent}% of buy price` },
      { label: 'You receive',    value: `${formatSTC(Math.abs(price))} STC`, good: true },
    ].filter(Boolean);
  }

  const canAfford = action === 'sell' || playerStc >= price;
  const colorMap = {
    emerald: { btn: 'bg-emerald-500 hover:bg-emerald-600 text-black', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    blue:    { btn: 'bg-blue-500 hover:bg-blue-600 text-white',       badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    amber:   { btn: 'bg-amber-500 hover:bg-amber-600 text-black',     badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    rose:    { btn: 'bg-rose-500 hover:bg-rose-600 text-white',       badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  };
  const c = colorMap[meta.color];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-card border border-border p-0 overflow-hidden rounded-2xl">
        {/* Asset image strip */}
        <div className="relative h-32 overflow-hidden">
          <img src={getAssetImage(item)} alt={item.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className={cn('absolute top-3 left-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full', tier.badge)}>
            {tier.label}
          </div>
          <div className="absolute bottom-3 left-4">
            <p className="font-bold text-white text-lg leading-tight">{item.name}</p>
          </div>
          <div className={cn('absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-bold', c.badge)}>
            <Icon className="w-3 h-3" />
            {meta.label}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Details table */}
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.label}</span>
                <span className={cn(
                  'font-semibold',
                  d.highlight ? 'text-foreground text-base' :
                  d.good ? 'text-emerald-400' :
                  d.warn ? 'text-orange-400' :
                  'text-foreground/70'
                )}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>

          {/* Balance summary */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <Coins className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{formatSTC(playerStc)} STC</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className={cn('font-bold', balanceAfter < 0 ? 'text-destructive' : canAfford ? 'text-emerald-400' : 'text-destructive')}>
              {formatSTC(balanceAfter)} STC
            </span>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Insufficient STC balance
            </div>
          )}

          {action === 'sell' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              This action cannot be undone
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-border text-muted-foreground" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className={cn('flex-1 font-bold gap-2', c.btn)}
              onClick={onConfirm}
              disabled={loading || !canAfford}
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Icon className="w-4 h-4" />}
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
