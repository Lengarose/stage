import { Clock3 } from 'lucide-react';
import { formatWindowDeadline, TRANSFER_WINDOW_TIME_ZONES, viewerTimeZone } from '@/lib/transferWindowDeadline';
export default function TransferWindowDeadline({ window: transferWindow, windowOpen }) {
  if (!windowOpen || !transferWindow) return null;
  const localZone=viewerTimeZone();
  const local=formatWindowDeadline(transferWindow.end_date,localZone);
  const referenceZone=transferWindow.timezone||'Europe/Brussels';
  return <section className="tr-window-deadline" aria-label="Global transfer-window deadline">
    <div className="tr-deadline-main"><Clock3 size={20}/><div><p className="tr-kicker">TRANSFER WINDOW CLOSES</p>{local?<><strong><time dateTime={transferWindow.end_date}>{local}</time></strong><p>Your local time · {localZone}</p></>:<><strong>No closing time set</strong><p>This window stays open until Admin closes it.</p></>}</div></div>
    {local&&<><div className="tr-deadline-reference"><span>Window reference · {referenceZone}</span><strong>{formatWindowDeadline(transferWindow.end_date,referenceZone)}</strong><p>One global deadline. The window closes everywhere at the same moment.</p></div><details className="tr-deadline-zones"><summary>Other time zones</summary><dl>{TRANSFER_WINDOW_TIME_ZONES.map(([label,zone])=><div key={zone}><dt>{label}<small>{zone}</small></dt><dd>{formatWindowDeadline(transferWindow.end_date,zone)}</dd></div>)}</dl></details></>}
  </section>;
}
