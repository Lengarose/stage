import { cn } from '@/lib/utils';
import { LIFESTYLE_TIER_STYLES, getAssetImage, formatSTC, categoryEmoji } from '@/lib/lifestyleItems';
import { ShoppingCart, CalendarClock, TrendingUp, Tag, Lock, Check, RefreshCw } from 'lucide-react';

export default function LifestyleAssetCard({ item, playerStc = 0, purchases = [], onAction }) {
  const tier = LIFESTYLE_TIER_STYLES[item.tier] || LIFESTYLE_TIER_STYLES.standard;
  const imgUrl = getAssetImage(item);

  const ownedPurchase = purchases.find(p => p.item_id === item.id && p.purchase_type === 'buy' && p.status === 'active');
  const rentalPurchase = purchases.find(p => p.item_id === item.id && p.purchase_type === 'rent' && p.status === 'active');
  const investPurchase = purchases.find(p => p.item_id === item.id && p.purchase_type === 'invest' && p.status === 'active');
  const ownedCount = purchases.filter(p => p.item_id === item.id && p.purchase_type === 'buy' && p.status === 'active').length;
  const rentalCount = purchases.filter(p => p.item_id === item.id && p.purchase_type === 'rent' && p.status === 'active').length;
  const investCount = purchases.filter(p => p.item_id === item.id && p.purchase_type === 'invest' && p.status === 'active').length;

  const isOwned = !!ownedPurchase;
  const isRenting = !!rentalPurchase;
  const isInvesting = !!investPurchase;
  const hasAny = isOwned || isRenting || isInvesting;

  const canBuy    = item.can_buy    && !(!item.allows_multiple && isOwned);
  const canRent   = item.can_rent   && item.rent_price_stc > 0 && !isRenting;
  const canInvest = item.can_invest && item.invest_price_stc > 0 && !(!item.allows_multiple && isInvesting);

  const canAffordBuy    = playerStc >= Number(item.price_stc || 0);
  const canAffordRent   = playerStc >= Number(item.rent_price_stc || 0);
  const canAffordInvest = playerStc >= Number(item.invest_price_stc || 0);

  const hasPassive = item.passive_income_stc > 0;

  return (
    <div className={cn('group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-0.5', tier.bg)}>
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={imgUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Tier badge */}
        <div className={cn('absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full backdrop-blur-sm', tier.badge)}>
          {tier.label}
        </div>

        {/* Category emoji */}
        <div className="absolute top-3 left-3 text-base">
          {item.emoji || categoryEmoji(item.category)}
        </div>

        {/* Ownership badges */}
        {isOwned && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-emerald-500/90 text-black text-[10px] font-bold px-2.5 py-1.5 rounded-full">
            <Check className="w-3 h-3" /> Owned{ownedCount > 1 ? ` x${ownedCount}` : ''}
          </div>
        )}
        {isRenting && !isOwned && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-blue-500/90 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full">
            <CalendarClock className="w-3 h-3" /> Renting{rentalCount > 1 ? ` x${rentalCount}` : ''}
          </div>
        )}
        {isInvesting && (
          <div className={cn('absolute bottom-3', (isOwned || isRenting) ? 'right-3' : 'left-3', 'flex items-center gap-1.5 bg-amber-500/90 text-black text-[10px] font-bold px-2.5 py-1.5 rounded-full')}>
            <TrendingUp className="w-3 h-3" /> Investing{investCount > 1 ? ` x${investCount}` : ''}
          </div>
        )}

        {/* Passive income badge */}
        {hasPassive && isOwned && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-green-400/90 text-black text-[10px] font-bold px-2 py-1 rounded-full">
            +{formatSTC(item.passive_income_stc)}/{item.passive_income_interval_days}d
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <h3 className="font-bold text-foreground text-base leading-tight">{item.name}</h3>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
        </div>

        {/* Price rows */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          {item.can_buy && item.price_stc > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><ShoppingCart className="w-3 h-3" /> Buy</span>
              <span className={cn('font-semibold', canAffordBuy ? 'text-emerald-400' : 'text-muted-foreground')}>
                {formatSTC(item.price_stc)} STC
              </span>
            </div>
          )}
          {item.can_rent && item.rent_price_stc > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="w-3 h-3" /> Rent/{item.rent_duration_days}d</span>
              <span className={cn('font-semibold', canAffordRent ? 'text-blue-400' : 'text-muted-foreground')}>
                {formatSTC(item.rent_price_stc)} STC
              </span>
            </div>
          )}
          {item.can_invest && item.invest_price_stc > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><TrendingUp className="w-3 h-3" /> Invest</span>
              <span className={cn('font-semibold', canAffordInvest ? 'text-amber-400' : 'text-muted-foreground')}>
                {formatSTC(item.invest_price_stc)} STC
                <span className="text-emerald-400 ml-1">+{item.invest_return_rate}%</span>
              </span>
            </div>
          )}
          {item.weekly_maintenance_stc > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><RefreshCw className="w-3 h-3" /> Upkeep/wk</span>
              <span className="font-semibold text-orange-400">{formatSTC(item.weekly_maintenance_stc)} STC</span>
            </div>
          )}
          {item.can_sell && item.sell_value_percent > 0 && isOwned && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3 h-3" /> Sell value</span>
              <span className="font-semibold text-foreground/60">
                ~{formatSTC(Math.floor(Number(ownedPurchase?.price_paid_stc || item.price_stc || 0) * item.sell_value_percent / 100))} STC
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {canBuy && (
            <ActionBtn
              label={isOwned && item.allows_multiple ? 'Buy Again' : 'Buy'}
              icon={<ShoppingCart className="w-3 h-3" />}
              color="emerald"
              disabled={!canAffordBuy}
              onClick={() => onAction?.('buy', item)}
            />
          )}
          {canRent && (
            <ActionBtn
              label="Rent"
              icon={<CalendarClock className="w-3 h-3" />}
              color="blue"
              disabled={!canAffordRent}
              onClick={() => onAction?.('rent', item)}
            />
          )}
          {canInvest && (
            <ActionBtn
              label={isInvesting && item.allows_multiple ? 'Invest Again' : 'Invest'}
              icon={<TrendingUp className="w-3 h-3" />}
              color="amber"
              disabled={!canAffordInvest}
              onClick={() => onAction?.('invest', item)}
            />
          )}
          {isOwned && item.can_sell && (
            <ActionBtn
              label="Sell"
              icon={<Tag className="w-3 h-3" />}
              color="muted"
              onClick={() => onAction?.('sell', item, ownedPurchase)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ label, icon, color, disabled, onClick }) {
  const colorMap = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
    blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25',
    amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
    muted:   'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold uppercase tracking-wide transition-all',
        disabled
          ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/10 text-muted-foreground'
          : colorMap[color] || colorMap.muted
      )}
    >
      {icon}
      {label}
      {disabled && <Lock className="w-2.5 h-2.5 opacity-60" />}
    </button>
  );
}
