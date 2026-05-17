import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Vote } from 'lucide-react';

export default function CountryElectionPanel({ election, ownerCandidates, isOwner, onVote, disabled }) {
  const [candidateId, setCandidateId] = useState('');

  if (!election) {
    return <p className="text-sm text-muted-foreground">No election is open for your country yet.</p>;
  }

  if (!isOwner) {
    return <p className="text-sm text-muted-foreground">Only club owners from this country can vote for the national team owner.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{election.country_name || election.country_code} National Team Owner Vote</p>
        <p className="text-xs text-muted-foreground">Choose between the top 5 club owners from this country.</p>
      </div>
      <select className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
        <option value="">Select owner candidate</option>
        {ownerCandidates.map((owner) => (
          <option key={owner.owner_club_id} value={owner.owner_club_id}>
            {owner.club_name} · {owner.owner_email} · {owner.club_ranking_points || 0} pts
          </option>
        ))}
      </select>
      <Button type="button" disabled={!candidateId || disabled} onClick={() => onVote(election.id, candidateId)} className="rounded gap-2">
        <Vote className="w-4 h-4" /> {disabled ? 'Submitting...' : 'Vote'}
      </Button>
    </div>
  );
}
