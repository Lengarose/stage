import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
const guides = {
  group_stage: { name: 'Group stage', structure: 'Groups of four → top two in each group → knockout rounds → final.', example: '16 clubs: four groups of four, three group matchdays, quarterfinal legs 1–2, semifinal legs 1–2, then the final and third-place playoff. Each club plays once per group matchday; the groups play at the same time.', note: 'Each group matchday is another game in the same phase. Switching to a quarterfinal or semifinal starts a new phase. Quarterfinals and semifinals normally have home and away legs. A final is one match. Uneven brackets may include byes; a third-place playoff needs two semifinal losers.' },
  knockout: { name: 'Knockout', structure: 'Opening round → winners advance → semifinals → final.', example: '16 clubs: Round of 16, quarterfinal, semifinal, final and third-place playoff. Each tie is one match.', note: 'One row covers all matches in that round, not one individual fixture. The two semifinal losers play the third-place playoff.' },
  league: { name: 'League', structure: 'Every participant plays every opponent at home and away → final table.', example: 'Four clubs: six matchdays. Twenty clubs: 38 matchdays. Each club normally plays one match per matchday.', note: 'There is no knockout final or third-place playoff. A matchday is a set of fixtures played at the same time.' },
  swiss_ucl: { name: 'Swiss UCL', structure: '36 participants → eight league-phase matchdays → playoffs → Round of 16 → quarterfinals → semifinals → final.', example: 'Top eight advance directly to the Round of 16. Positions 9–24 play qualification playoffs. Playoffs and knockout ties have two legs; the final is one match.', note: 'There is no third-place playoff. This format requires 36 participants.' },
};
export default function TournamentScheduleGuide({ format = 'group_stage' }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(format);
  const guide = guides[selected] || guides.group_stage;
  return <>
    <button type="button" className="min-h-11 text-sm font-bold text-white hover:text-cyan-200" onClick={() => { setSelected(format); setOpen(true); }}>How to plan this tournament</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-none border-white/20 bg-[#080f1c] text-white">
      <DialogHeader><DialogTitle className="font-heading text-2xl">Tournament scheduling guide</DialogTitle></DialogHeader>
      <label className="text-sm">Tournament format<select className="mt-2 block w-full border border-white/20 bg-[#080f1c] p-3" value={selected} onChange={e => setSelected(e.target.value)}>{Object.entries(guides).map(([key, g]) => <option key={key} value={key}>{g.name}</option>)}</select></label>
      <p className="font-bold text-cyan-100">{guide.structure}</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/80">
        <li><strong>Check the generated rounds.</strong> {guide.example}</li>
        <li><strong>Choose how matches are scheduled.</strong> Fixed times give every match in that row the same kickoff. Playing windows let opponents agree a kickoff inside the published window.</li>
        <li><strong>Choose dates and starts.</strong> Enter dates in your device timezone, shown beside the inputs. The competition timezone labels the event; changing it does not reinterpret your input. Group/league blocks last 40 minutes, knockout blocks 60 minutes. For fixed times, the end is calculated automatically. For windows, choose an end that leaves at least one complete block.</li>
        <li><strong>Leave time between rounds.</strong> Example: group matchday 1 starts Saturday at 20:00 and ends 20:40; matchday 2 can start at 20:50. Schedule later rounds on another evening if needed. Allow time for results and qualification to be confirmed.</li>
        <li><strong>Publish before registration.</strong> Participants read and accept these times and the rules before entering. The schedule is not the draw: opponents are assigned when fixtures are drawn or qualifiers are confirmed.</li>
        <li><strong>Handle changes openly.</strong> Once participants have entered, use the fixture-time change request. The original kickoff stays until both affected participants accept. Unresolved results or extra deciding matches require organiser/Admin resolution; they are not silently fitted into another round.</li>
      </ol>
      <p className="border-t border-white/15 pt-3 text-sm text-white/60">{guide.note}</p>
    </DialogContent></Dialog>
  </>;
}
