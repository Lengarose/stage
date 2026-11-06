import {officialResultNotice} from '@/lib/officialResultNotice';

export default function OfficialResultPolicyNotice({game,policy}) {
  const notice=officialResultNotice(game,policy);
  if(!notice)return null;
  if(notice.unsupported)return <p role="status" className="border border-border p-3 text-sm">The captured result conditions could not be verified. Review the edition rules or contact Admin.</p>;
  return <aside aria-label="Published official result conditions" className="space-y-2 border border-border p-3 text-sm">
    <p className="font-semibold">Official regional result conditions</p>
    <p>{notice.allowEitherInitial?'The home club normally reports after full time. Either club may submit the first result if no proposal exists.':'The home club submits the initial result under this edition’s captured conditions.'}</p>
    <p>The opponent has 24 hours to respond to a proposal or correction. No response requires Admin review; silence never approves a result.</p>
    {notice.waiting && (notice.deadline?<p>Response deadline (your local time): <time dateTime={notice.deadline}>{new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(notice.deadline))}</time>. Refresh the match to check its current status.</p>:<p role="status">The response deadline is unavailable. Refresh the match or contact Admin; no deadline extension is implied.</p>)}
    {notice.review && <p>This result is awaiting Admin review.</p>}
    {notice.disputed && <p>This result is disputed. Follow the existing dispute-evidence procedure.</p>}
    <p className="text-xs text-muted-foreground">Captured result policy: {notice.version}</p>
  </aside>;
}
