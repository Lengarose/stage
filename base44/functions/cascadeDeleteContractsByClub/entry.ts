import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const clubId = event.entity_id;

    const contracts = await base44.asServiceRole.entities.PlayerContract.filter({ team_id: clubId });
    for (const contract of contracts) {
      await base44.asServiceRole.entities.PlayerContract.delete(contract.id);
    }

    return Response.json({ deleted: contracts.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});