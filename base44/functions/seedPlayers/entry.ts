import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"];
const PLATFORMS = ["PlayStation", "Xbox", "PC"];
const COUNTRIES = ["England", "France", "Germany", "Spain", "Italy", "Netherlands", "Belgium", "Portugal", "Brazil", "Argentina"];

function generateGamertag(clubName, index) {
  return `${clubName.replace(/\s+/g, '')}${index}`.slice(0, 20);
}

function generatePlayer(clubId, clubName, clubPlatform, index) {
  const position = POSITIONS[index % POSITIONS.length];
  const countryIdx = Math.floor(index / 12) % COUNTRIES.length;
  const country = COUNTRIES[countryIdx];
  const countryCode = country.slice(0, 2).toUpperCase();
  const overall = Math.floor(Math.random() * (86 - 70 + 1) + 70); // 70-86

  return {
    gamertag: generateGamertag(clubName, index + 1),
    email: `player${clubId}_${index}@stage.local`,
    club_id: clubId,
    position,
    overall_rating: overall,
    platform: clubPlatform,
    country,
    country_code: countryCode,
    club_roles: ["member"],
    role: "member",
    status: "active",
    matches_played: Math.floor(Math.random() * 50),
    wins_count: Math.floor(Math.random() * 30),
    losses_count: Math.floor(Math.random() * 25),
    draws_count: Math.floor(Math.random() * 10),
    goals: Math.floor(Math.random() * 20),
    assists: Math.floor(Math.random() * 15),
    avg_match_rating: Math.floor(Math.random() * (7.5 - 6.0 + 1) + 6.0 * 10) / 10
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all clubs
    const clubs = await base44.entities.Club.list();
    const allPlayers = [];

    // Generate 12 players for all clubs
    for (const club of clubs) {
      for (let i = 0; i < 12; i++) {
        allPlayers.push(generatePlayer(club.id, club.name, club.platform, i));
      }
    }

    // Batch create all at once
    await base44.entities.Player.bulkCreate(allPlayers);

    return Response.json({
      message: `Created ${allPlayers.length} players for ${clubs.length} clubs`,
      clubs_count: clubs.length,
      players_per_club: 12,
      total_players: allPlayers.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});