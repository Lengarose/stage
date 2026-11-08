import { Link } from 'react-router-dom';

export default function RegionalCompetitionNav({ cups = false }) {
  return <nav aria-label="Regional competitions" className="competition-text-tabs mb-7 flex flex-wrap gap-x-8 gap-y-2 border-b border-border py-4">
    <Link to="/leagues" aria-current={!cups ? 'page' : undefined} className={`min-h-11 py-3 ${!cups ? 'font-bold text-primary' : 'font-medium'}`}>Leagues</Link>
    <Link to="/leagues?view=cups" aria-current={cups ? 'page' : undefined} className={`min-h-11 py-3 ${cups ? 'font-bold text-primary' : 'font-medium'}`}>Regional Cups</Link>
  </nav>;
}
