import { useState } from "react";
import { stageClient } from "@/api/stageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ticket, RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminStadiumPanel() {
  const [open, setOpen]         = useState(false);
  const [levels, setLevels]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);
  const [clubId, setClubId]     = useState('');
  const [clubName, setClubName] = useState('');
  const [clubLevel, setClubLevel] = useState('');
  const [clubCap, setClubCap]   = useState('');
  const [corrClub, setCorrClub] = useState('');
  const [corrMatch, setCorrMatch] = useState('');
  const [corrAmt, setCorrAmt]   = useState('');
  const [corrNote, setCorrNote] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await stageClient.functions.invoke('stadiumManagement', { action: 'get_config' });
      setLevels(res?.data?.levels || []);
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed to load' }); }
    setLoading(false);
  }

  async function saveLevel(i) {
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'set_level_config',
        level_index: i,
        ...levels[i],
      });
      setMsg({ type: 'success', text: `Level ${i + 1} saved ✓` });
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  function updateLevel(i, key, value) {
    setLevels(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  }

  async function editClubStadium() {
    if (!clubId) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'edit_club_stadium',
        club_id: clubId,
        stadium_name: clubName || undefined,
        stadium_level: clubLevel !== '' ? Number(clubLevel) : undefined,
        stadium_capacity: clubCap !== '' ? Number(clubCap) : undefined,
      });
      setMsg({ type: 'success', text: 'Club stadium updated ✓' });
      setClubId(''); setClubName(''); setClubLevel(''); setClubCap('');
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  async function applyRevenueCorrection() {
    if (!corrClub || !corrAmt) return;
    setSaving(true);
    try {
      await stageClient.functions.invoke('stadiumManagement', {
        action: 'correct_revenue',
        club_id: corrClub,
        match_id: corrMatch || undefined,
        amount: Number(corrAmt),
        note: corrNote || undefined,
      });
      setMsg({ type: 'success', text: 'Revenue correction applied ✓' });
      setCorrClub(''); setCorrMatch(''); setCorrAmt(''); setCorrNote('');
    } catch (err) { setMsg({ type: 'error', text: err?.message || 'Failed' }); }
    setSaving(false);
  }

  const LEVEL_FIELDS = [
    { key: 'name',              label: 'Name',                type: 'text' },
    { key: 'capacity',          label: 'Capacity',            type: 'number' },
    { key: 'ticket_price_stc',  label: 'Ticket Price (STC)',  type: 'number' },
    { key: 'upgrade_cost_stc',  label: 'Upgrade Cost (STC)',  type: 'number' },
  ];

  return (
    <div className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => { setOpen(o => !o); if (!open && !levels) load(); }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-xs font-bold text-foreground flex items-center gap-2">
          <Ticket className="w-3.5 h-3.5 text-success" /> Stadium Economy — Config &amp; Overrides
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-6">
          {msg && (
            <p className={cn("text-xs font-medium", msg.type === 'success' ? 'text-success' : 'text-destructive')}>{msg.text}</p>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Stadium Level Config</p>
              <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="text-xs gap-1 h-7">
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Reload
              </Button>
            </div>
            {loading && !levels ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : levels?.length ? (
              <div className="space-y-4">
                {levels.map((lvl, i) => (
                  <div key={i} className="bg-secondary/40 border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">Level {i + 1}</p>
                      <Button size="sm" onClick={() => saveLevel(i)} disabled={saving}
                        className="text-[10px] h-6 px-2 bg-success/20 text-success border border-success/30 hover:bg-success/30">
                        Save Level {i + 1}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {LEVEL_FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{f.label}</label>
                          <input
                            type={f.type}
                            value={lvl[f.key] ?? ''}
                            onChange={e => updateLevel(i, f.key, e.target.value)}
                            className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No config loaded.</p>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Edit Club Stadium</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Club ID *" value={clubId} onChange={e => setClubId(e.target.value)} className="text-xs" />
              <Input placeholder="Stadium Name" value={clubName} onChange={e => setClubName(e.target.value)} className="text-xs" />
              <Input placeholder="Level (0–3)" type="number" value={clubLevel} onChange={e => setClubLevel(e.target.value)} className="text-xs" />
              <Input placeholder="Capacity override" type="number" value={clubCap} onChange={e => setClubCap(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" onClick={editClubStadium} disabled={saving || !clubId}
              className="mt-2 text-xs bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30">
              {saving ? 'Saving…' : 'Apply Stadium Override'}
            </Button>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Correct Ticket Revenue</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Club ID *" value={corrClub} onChange={e => setCorrClub(e.target.value)} className="text-xs" />
              <Input placeholder="Match ID (optional)" value={corrMatch} onChange={e => setCorrMatch(e.target.value)} className="text-xs" />
              <Input placeholder="Amount STC (negative to deduct) *" type="number" value={corrAmt} onChange={e => setCorrAmt(e.target.value)} className="text-xs" />
              <Input placeholder="Note (optional)" value={corrNote} onChange={e => setCorrNote(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" onClick={applyRevenueCorrection} disabled={saving || !corrClub || !corrAmt}
              className="mt-2 text-xs bg-success/20 text-success border border-success/30 hover:bg-success/30">
              {saving ? 'Applying…' : 'Apply Revenue Correction'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
