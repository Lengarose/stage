export const defaultTournamentClubRules = () => ({ minimum_human_players: 2, goalkeeper_required: false, any_allowed: true });
export default function TournamentSquadRulesFields({ value, onChange }) {
  const rules = value || defaultTournamentClubRules();
  return <fieldset className="mb-5 space-y-3 border border-white/20 p-4 text-sm text-white"><legend>Match Squad requirements</legend>
    <label className="block">Minimum human players<select className="ml-3 border border-white/20 bg-[#0b1423] p-2" value={rules.minimum_human_players} onChange={e => onChange({ ...rules, minimum_human_players: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n === 11 ? '11 — full human team (11v11)' : n}</option>)}</select></label>
    <label className="block"><input type="checkbox" checked={rules.goalkeeper_required} onChange={e => onChange({ ...rules, goalkeeper_required: e.target.checked })} /> Human goalkeeper required</label>
    <label className="block"><input type="checkbox" checked={rules.any_allowed} onChange={e => onChange({ ...rules, any_allowed: e.target.checked })} /> ANY allowed</label>
    <p className="text-xs text-white/60">Minimum counts human players, including a human goalkeeper. Choose 2 for the least restrictive club format or 11 for 11v11. Club roster size is checked at registration; the selected Match Squad is checked before kickoff. Requirements lock when applications begin.</p>
  </fieldset>;
}
