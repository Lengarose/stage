import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event } = await req.json();
    const playerId = event.entity_id;

    const records = await base44.asServiceRole.entities.PlayerContractHistory.filter({ action_by: playerId });
    for (const r of records) {
      await base44.asServiceRole.entities.PlayerContractHistory.update(r.id, { action_by: null });
    }

    return Response.json({ updated: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});