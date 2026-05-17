import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Vote } from 'lucide-react';

export default function CountryElectionPanel({ election, players, myPlayer, onVote, disabled }) {
  const [candidateId, setCandidateId] = useState('');
  const candidates = useMemo(
    () => players.filter((player) => player.id !== myPlayer?.id),
    [players, myPlayer?.id]
  );

  if (!election) {
    return <p className="text-sm text-muted-foreground">No election is open for your country yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{election.country_name || election.country_code} Representative Vote</p>
        <p className="text-xs text-muted-foreground">Choose one player. You cannot vote for yourself.</p>
      </div>
      <select className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
        <option value="">Select candidate</option>
        {candidates.map((player) => (
          <option key={player.id} value={player.id}>
            {player.gamertag || player.email} · {player.position || 'Any'} · OVR {player.overall_rating || 0}
          </option>
        ))}
      </select>
      <Button type="button" disabled={!candidateId || disabled} onClick={() => onVote(election.id, candidateId)} className="rounded gap-2">
        <Vote className="w-4 h-4" /> {disabled ? 'Submitting...' : 'Vote'}
      </Button>
    </div>
  );
}
