export default function ActionFeedStatus({feed,label,onRetry}) {
  if(feed?.status==='ready')return null;
  const failed=feed?.status==='error';
  return <div role={failed?'alert':'status'} className="space-y-2 border border-white/15 p-3 text-sm">
    <p>{failed?`${label} could not be loaded. The number of open items is unknown.`:`Checking ${label.toLowerCase()}…`}</p>
    {failed && onRetry && <button type="button" className="min-h-11 font-semibold" onClick={onRetry}>Retry action feeds →</button>}
  </div>;
}
