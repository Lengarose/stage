import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Vote } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function CountryElectionPanel({ election, ownerCandidates, isOwner, onVote, disabled }) {
  const { t } = useTranslation();
  const [candidateId, setCandidateId] = useState('');

  if (!election) {
    return <p className="text-sm text-muted-foreground">{t('commonPages.noElectionOpen')}</p>;
  }

  if (!isOwner) {
    return <p className="text-sm text-muted-foreground">{t('commonPages.ownersOnlyVote')}</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-foreground">{t('commonPages.nationalOwnerVote', { country: election.country_name || election.country_code })}</p>
        <p className="text-xs text-muted-foreground">{t('commonPages.chooseTopOwners')}</p>
      </div>
      <select className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
        <option value="">{t('commonPages.selectOwnerCandidate')}</option>
        {ownerCandidates.map((owner) => (
          <option key={owner.owner_club_id} value={owner.owner_club_id}>
            {owner.club_name} · {owner.owner_email} · {owner.club_ranking_points || 0} pts
          </option>
        ))}
      </select>
      <Button type="button" disabled={!candidateId || disabled} onClick={() => onVote(election.id, candidateId)} className="rounded gap-2">
        <Vote className="w-4 h-4" /> {disabled ? t('commonPages.submitting') : t('commonPages.vote')}
      </Button>
    </div>
  );
}
