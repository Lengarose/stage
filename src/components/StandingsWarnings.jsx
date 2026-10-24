import { useTranslation } from '@/hooks/useTranslation';

export default function StandingsWarnings({ issues }) {
  const { t } = useTranslation();
  const codes = new Set(issues.map(i => i.code));
  if (!codes.size) return null;
  return <div role="status" className="mb-3 text-sm text-warning">
    {codes.has('results_before_start') && <p>{t('tournamentDetail.standingsBeforeStart', 'Confirmed results exist before tournament start. Review the tournament history.')}</p>}
    {codes.has('missing_profile') && <p>{t('tournamentDetail.standingsMissingProfiles', 'Some registered profiles are unavailable. Their participant rows have been preserved.')}</p>}
    {[...codes].some(code => !['results_before_start','missing_profile'].includes(code)) && <p>{t('tournamentDetail.standingsInvalidResults', 'Invalid or conflicting records were excluded. Standings require review.')}</p>}
  </div>;
}
