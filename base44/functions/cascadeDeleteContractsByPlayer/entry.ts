import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const playerId = event.entity_id;

    // Delete contracts where player is the user or the offeror
    const [asUser, asOfferer] = await Promise.all([
      base44.asServiceRole.entities.PlayerContract.filter({ user_id: playerId }),
      base44.asServiceRole.entities.PlayerContract.filter({ offered_by: playerId }),
    ]);

    const all = [...asUser, ...asOfferer];
    const unique = [...new Map(all.map(c => [c.id, c])).values()];
    for (const contract of unique) {
      await base44.asServiceRole.entities.PlayerContract.delete(contract.id);
    }

    return Response.json({ deleted: unique.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});