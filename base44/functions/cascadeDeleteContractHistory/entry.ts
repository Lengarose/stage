import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event } = await req.json();
    const contractId = event.entity_id;

    const records = await base44.asServiceRole.entities.PlayerContractHistory.filter({ contract_id: contractId });
    for (const r of records) {
      await base44.asServiceRole.entities.PlayerContractHistory.delete(r.id);
    }

    return Response.json({ deleted: records.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});