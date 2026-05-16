import EmptyState from "@/components/admin/shared/EmptyState";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, RefreshCw, Plus, Pencil, X, Upload, Check } from "lucide-react";

export default function LifestylesTab({
  reseedLifestyle,
  saving,
  openAddAsset,
  lifestyleItems,
  toggleLifestyleAsset,
  openEditAsset,
  deleteLifestyleAsset,
  lifestyleDialog,
  setLifestyleDialog,
  lifestyleForm,
  setLifestyleForm,
  setLifestyleImageFile,
  lifestyleSaving,
  saveLifestyleAsset,
}) {
  const totalAssets = lifestyleItems.length;
  const rentableAssets = lifestyleItems.filter(item => item.can_rent && Number(item.rent_price_stc || 0) > 0).length;
  const investableAssets = lifestyleItems.filter(item => item.can_invest && Number(item.invest_price_stc || 0) > 0).length;
  const propertyAssets = lifestyleItems.filter(item => item.category === 'houses' || item.category === 'real_estate').length;

  return (
    <>
<div className="space-y-4">
  {/* Header row */}
  <div className="flex items-center justify-between gap-3 flex-wrap">
    <h3 className="font-heading text-lg uppercase tracking-tight text-foreground">Lifestyle Assets</h3>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={reseedLifestyle} disabled={saving}
        className="border-border text-muted-foreground hover:text-foreground text-xs h-8 gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> Reseed Defaults
      </Button>
      <Button size="sm" onClick={openAddAsset}
        className="bg-primary text-primary-foreground text-xs h-8 gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Asset
      </Button>
    </div>
  </div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {[
      ['Assets', totalAssets],
      ['Properties', propertyAssets],
      ['Rentable', rentableAssets],
      ['Investable', investableAssets],
    ].map(([label, value]) => (
      <div key={label} className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
        <p className="text-lg font-semibold text-foreground leading-none">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
      </div>
    ))}
  </div>

  {/* Asset list */}
  {lifestyleItems.length === 0 ? (
    <EmptyState icon={Building2} text="No lifestyle assets found. Add one or reseed defaults." />
  ) : (
    <div className="space-y-2">
      {lifestyleItems.map(item => (
        <div key={item.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          {/* Image thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-secondary">
            {item.image_url
              ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-xl">{item.category === 'houses' ? '🏠' : item.category === 'cars' ? '🚗' : item.category === 'watches' ? '⌚' : item.category === 'fashion' ? '👔' : item.category === 'vip_experiences' ? '🌟' : '💼'}</div>}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{item.category}</span>
              {item.subcategory && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{item.subcategory.replaceAll('_', ' ')}</span>}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{item.tier}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
              {item.price_stc > 0 && <span>Buy: {Number(item.price_stc).toLocaleString()}</span>}
              {item.can_rent && item.rent_price_stc > 0 && <span>Rent: {Number(item.rent_price_stc).toLocaleString()}</span>}
              {item.can_invest && item.invest_price_stc > 0 && <span>Invest: {Number(item.invest_return_rate)}% in {item.invest_duration_days}d</span>}
              {item.passive_income_stc > 0 && <span>Income: {Number(item.passive_income_stc).toLocaleString()} / {item.passive_income_interval_days}d</span>}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => toggleLifestyleAsset(item)}
              className={cn("text-[10px] px-2 py-1 rounded border uppercase font-bold transition-colors",
                item.is_active ? "text-success border-success/30 bg-success/10 hover:bg-success/20" : "text-muted-foreground border-border bg-secondary hover:text-foreground")}>
              {item.is_active ? 'Active' : 'Inactive'}
            </button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1.5" onClick={() => openEditAsset(item)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => deleteLifestyleAsset(item)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

{/* Add/Edit Asset Dialog */}
<Dialog open={!!lifestyleDialog} onOpenChange={v => !v && setLifestyleDialog(null)}>
  <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="font-heading uppercase tracking-tight">
        {lifestyleDialog === 'add' ? 'Add New Asset' : `Edit: ${lifestyleForm.name}`}
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Asset Name *</label>
          <Input value={lifestyleForm.name || ''} onChange={e => setLifestyleForm(p => ({ ...p, name: e.target.value }))}
            className="bg-secondary border-border mt-1" placeholder="e.g. Luxury Villa" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Category</label>
          <select value={lifestyleForm.category || 'houses'}
            onChange={e => setLifestyleForm(p => ({ ...p, category: e.target.value }))}
            className="w-full mt-1 h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-2">
            {[
              ['houses','Houses & Apartments'],['cars','Cars'],['watches','Watches'],
              ['fashion','Fashion'],['vip_experiences','VIP Experiences'],['personal_services','Personal Services'],
            ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Subcategory</label>
          <Input value={lifestyleForm.subcategory || ''} onChange={e => setLifestyleForm(p => ({ ...p, subcategory: e.target.value }))}
            className="bg-secondary border-border mt-1 text-sm" placeholder="e.g. boot_deal" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Emoji</label>
          <Input value={lifestyleForm.emoji || ''} onChange={e => setLifestyleForm(p => ({ ...p, emoji: e.target.value }))}
            className="bg-secondary border-border mt-1 text-sm" placeholder="e.g. 🏙️" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Tier</label>
          <select value={lifestyleForm.tier || 'standard'}
            onChange={e => setLifestyleForm(p => ({ ...p, tier: e.target.value }))}
            className="w-full mt-1 h-9 rounded-md border border-border bg-secondary text-foreground text-sm px-2">
            {['standard','mid','premium','luxury','elite','legendary'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Description</label>
          <Textarea value={lifestyleForm.description || ''} onChange={e => setLifestyleForm(p => ({ ...p, description: e.target.value }))}
            className="bg-secondary border-border mt-1 text-sm" rows={2} placeholder="Short description" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Available Cities</label>
          <Textarea
            value={typeof lifestyleForm.available_cities === 'string' ? lifestyleForm.available_cities : JSON.stringify(lifestyleForm.available_cities || [], null, 2)}
            onChange={e => setLifestyleForm(p => ({ ...p, available_cities: e.target.value }))}
            className="bg-secondary border-border mt-1 text-xs font-mono"
            rows={3}
            placeholder='[{"city":"London","country":"United Kingdom","emoji":"🇬🇧"}]'
          />
          <p className="text-[10px] text-muted-foreground mt-1">Used by buy/rent/invest flows for houses and location-based assets.</p>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Image</label>
          <div className="flex gap-2 mt-1">
            <Input value={lifestyleForm.image_url || ''} onChange={e => setLifestyleForm(p => ({ ...p, image_url: e.target.value }))}
              className="bg-secondary border-border text-xs" placeholder="https://..." />
            <label className="shrink-0 cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files[0]; if (!f) return;
                setLifestyleImageFile(f);
                setLifestyleForm(prev => ({ ...prev, _imgPreview: URL.createObjectURL(f) }));
              }} />
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-secondary text-xs text-muted-foreground hover:text-foreground cursor-pointer h-9">
                <Upload className="w-3 h-3" /> Upload
              </div>
            </label>
          </div>
          {(lifestyleForm._imgPreview || lifestyleForm.image_url) && (
            <img src={lifestyleForm._imgPreview || lifestyleForm.image_url} alt="preview"
              className="mt-2 h-24 rounded-lg object-cover border border-border" />
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Sort Order</label>
          <Input type="number" value={lifestyleForm.sort_order ?? 0} onChange={e => setLifestyleForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
            className="bg-secondary border-border mt-1" />
        </div>
      </div>

      {/* Pricing section */}
      <div className="border border-border rounded-lg p-3 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground">Pricing & Options</p>
        {/* Buy */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="can_buy" checked={!!lifestyleForm.can_buy}
            onChange={e => setLifestyleForm(p => ({ ...p, can_buy: e.target.checked }))} className="rounded" />
          <label htmlFor="can_buy" className="text-xs text-foreground">Can Buy</label>
          {lifestyleForm.can_buy && (
            <Input type="number" value={lifestyleForm.price_stc ?? 0}
              onChange={e => setLifestyleForm(p => ({ ...p, price_stc: Number(e.target.value) }))}
              className="bg-secondary border-border text-xs h-7 ml-auto w-40" placeholder="Buy price STC" />
          )}
        </div>
        {/* Sell */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="can_sell" checked={!!lifestyleForm.can_sell}
            onChange={e => setLifestyleForm(p => ({ ...p, can_sell: e.target.checked }))} className="rounded" />
          <label htmlFor="can_sell" className="text-xs text-foreground">Can Sell</label>
          {lifestyleForm.can_sell && (
            <div className="ml-auto flex items-center gap-1.5">
              <Input type="number" value={lifestyleForm.sell_value_percent ?? 60}
                onChange={e => setLifestyleForm(p => ({ ...p, sell_value_percent: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-20" placeholder="%" />
              <span className="text-xs text-muted-foreground">% of buy</span>
            </div>
          )}
        </div>
        {/* Rent */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="can_rent" checked={!!lifestyleForm.can_rent}
            onChange={e => setLifestyleForm(p => ({ ...p, can_rent: e.target.checked }))} className="rounded" />
          <label htmlFor="can_rent" className="text-xs text-foreground">Can Rent</label>
          {lifestyleForm.can_rent && (
            <div className="ml-auto flex items-center gap-1.5">
              <Input type="number" value={lifestyleForm.rent_price_stc ?? 0}
                onChange={e => setLifestyleForm(p => ({ ...p, rent_price_stc: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-32" placeholder="Rent STC" />
              <Input type="number" value={lifestyleForm.rent_duration_days ?? 30}
                onChange={e => setLifestyleForm(p => ({ ...p, rent_duration_days: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-20" placeholder="days" />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
        </div>
        {/* Invest */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="can_invest" checked={!!lifestyleForm.can_invest}
            onChange={e => setLifestyleForm(p => ({ ...p, can_invest: e.target.checked }))} className="rounded" />
          <label htmlFor="can_invest" className="text-xs text-foreground">Can Invest</label>
          {lifestyleForm.can_invest && (
            <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
              <Input type="number" value={lifestyleForm.invest_price_stc ?? 0}
                onChange={e => setLifestyleForm(p => ({ ...p, invest_price_stc: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-28" placeholder="Invest STC" />
              <Input type="number" value={lifestyleForm.invest_return_rate ?? 0}
                onChange={e => setLifestyleForm(p => ({ ...p, invest_return_rate: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-20" placeholder="Rate %" />
              <span className="text-xs text-muted-foreground">%</span>
              <Input type="number" value={lifestyleForm.invest_duration_days ?? 30}
                onChange={e => setLifestyleForm(p => ({ ...p, invest_duration_days: Number(e.target.value) }))}
                className="bg-secondary border-border text-xs h-7 w-16" placeholder="days" />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
        </div>
        {/* Passive income */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-foreground shrink-0">Passive Income</label>
          <Input type="number" value={lifestyleForm.passive_income_stc ?? 0}
            onChange={e => setLifestyleForm(p => ({ ...p, passive_income_stc: Number(e.target.value) }))}
            className="bg-secondary border-border text-xs h-7 w-32" placeholder="STC amount" />
          <span className="text-xs text-muted-foreground">every</span>
          <Input type="number" value={lifestyleForm.passive_income_interval_days ?? 7}
            onChange={e => setLifestyleForm(p => ({ ...p, passive_income_interval_days: Number(e.target.value) }))}
            className="bg-secondary border-border text-xs h-7 w-20" placeholder="days" />
          <span className="text-xs text-muted-foreground">days</span>
        </div>
        {/* Upkeep */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-foreground shrink-0">Weekly Upkeep</label>
          <Input type="number" value={lifestyleForm.weekly_maintenance_stc ?? 0}
            onChange={e => setLifestyleForm(p => ({ ...p, weekly_maintenance_stc: Number(e.target.value) }))}
            className="bg-secondary border-border text-xs h-7 ml-auto w-32" placeholder="STC/week" />
        </div>
        {/* Allows multiple */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="allows_multiple" checked={!!lifestyleForm.allows_multiple}
            onChange={e => setLifestyleForm(p => ({ ...p, allows_multiple: e.target.checked }))} className="rounded" />
          <label htmlFor="allows_multiple" className="text-xs text-foreground">Allow multiple purchases per player</label>
        </div>
        {/* Is active */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="ls_is_active" checked={!!lifestyleForm.is_active}
            onChange={e => setLifestyleForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
          <label htmlFor="ls_is_active" className="text-xs text-foreground">Active (visible in store)</label>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 border-border text-muted-foreground"
          onClick={() => setLifestyleDialog(null)} disabled={lifestyleSaving}>Cancel</Button>
        <Button className="flex-1 bg-primary text-primary-foreground font-bold gap-2"
          onClick={saveLifestyleAsset} disabled={lifestyleSaving || !lifestyleForm.name}>
          {lifestyleSaving
            ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Check className="w-4 h-4" />}
          {lifestyleDialog === 'add' ? 'Create Asset' : 'Save Changes'}
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </>
  );
}
