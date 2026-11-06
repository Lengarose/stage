export default function EditionParticipationConditions({conditions}) {
  if(!conditions)return null;
  if(conditions.state!=='published' || typeof conditions.rules_text!=='string')return <p role="status" className="border-y border-border py-3 text-sm">The captured participation conditions for this edition are unavailable or need review. Contact Admin; current settings have not been substituted for historical terms.</p>;
  return <section aria-label="Captured edition participation conditions" className="space-y-3 border-y border-border py-4 text-sm">
    <h3 className="font-semibold">Published participation conditions for this edition</h3>
    <p className="text-muted-foreground">These are the conditions recorded for this edition. Opening them does not register your club or change your accepted terms.</p>
    <p className="whitespace-pre-wrap break-words">{conditions.rules_text}</p>
    <p className="break-words text-xs text-muted-foreground">Participation policy: {conditions.policy_version}{conditions.result_policy_version?` · Result policy: ${conditions.result_policy_version}`:''}{conditions.cup_policy_version?` · Cup policy: ${conditions.cup_policy_version}`:''}</p>
  </section>;
}
