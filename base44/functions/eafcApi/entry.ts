import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { EAFCApiService } from 'npm:eafc-clubs-api@1.2.0';

const api = new EAFCApiService();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { endpoint, params } = body;
    const platform = params?.platform || 'common-gen5';
    const clubId = params?.clubId ? String(params.clubId) : undefined;

    let data;

    switch (endpoint) {
      case 'searchClub':
        data = await api.searchClub({ clubName: params.clubName, platform });
        break;

      case 'clubInfo':
        data = await api.clubInfo({ clubIds: clubId, platform });
        break;

      case 'overallStats':
        data = await api.overallStats({ clubIds: clubId, platform });
        break;

      case 'memberStats':
        data = await api.memberStats({ clubId, platform });
        break;

      case 'memberCareerStats':
        data = await api.memberCareerStats({ clubId, platform });
        break;

      case 'leagueMatches':
        data = await api.matchesStats({ clubIds: clubId, platform, matchType: 'leagueMatch', maxResultCount: '20' });
        break;

      case 'playoffMatches':
        data = await api.matchesStats({ clubIds: clubId, platform, matchType: 'playoffMatch', maxResultCount: '20' });
        break;

      default:
        return Response.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 });
    }

    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});