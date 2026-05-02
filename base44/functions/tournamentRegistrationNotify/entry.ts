/**
 * tournamentRegistrationNotify
 *
 * Called when a club registers for a tournament.
 * Sends in-app notifications to all players in the club.
 *
 * Also callable by the scheduled automation for reminders:
 *   action = "remind" — checks all upcoming tournaments and sends reminders
 *   action = "register" — immediate notification on registration
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, tournament_id, club_id } = body;

  if (action === 'register') {
    // Immediate: notify all club players about registration
    if (!tournament_id || !club_id) {
      return Response.json({ error: 'tournament_id and club_id required' }, { status: 400 });
    }

    const [tourArr, clubPlayers] = await Promise.all([
      base44.asServiceRole.entities.Tournament.filter({ id: tournament_id }),
      base44.asServiceRole.entities.Player.filter({ club_id }),
    ]);

    const tournament = tourArr?.[0];
    if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 });

    const startLabel = tournament.start_date
      ? new Date(tournament.start_date).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      : 'TBD';

    for (const player of clubPlayers) {
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: player.email,
        type: 'tournament_start',
        title: `Your club registered for ${tournament.name}`,
        body: `Your club has signed up for ${tournament.name}.\n📅 Start: ${startLabel}\nPlatform: ${tournament.platform || '—'}\nMake sure you're ready!`,
        link: `/tournaments/${tournament_id}`,
        related_id: tournament_id,
        read: false,
      });
    }

    return Response.json({ success: true, notified: clubPlayers.length });
  }

  if (action === 'remind') {
    // Scheduled: send reminders 7 days and 1 day before tournament start
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in1day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Fetch all active/registration tournaments
    const allTournaments = await base44.asServiceRole.entities.Tournament.list('-start_date', 200);
    let remindCount = 0;

    for (const t of allTournaments) {
      if (!t.start_date || !t.registered_clubs?.length) continue;
      if (t.status === 'completed' || t.status === 'cancelled') continue;

      const startDate = new Date(t.start_date);

      // Is it roughly 7 days away (within 1-hour window)?
      const diff7 = Math.abs(startDate - in7days);
      const diff1 = Math.abs(startDate - in1day);
      const oneHour = 60 * 60 * 1000;

      let reminderType = null;
      if (diff7 <= oneHour) reminderType = '7_days';
      else if (diff1 <= oneHour) reminderType = '1_day';

      if (!reminderType) continue;

      const startLabel = startDate.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const timeLabel = reminderType === '7_days' ? '1 week' : '1 day';

      for (const clubId of t.registered_clubs) {
        const clubPlayers = await base44.asServiceRole.entities.Player.filter({ club_id: clubId });
        for (const player of clubPlayers) {
          await base44.asServiceRole.entities.Notification.create({
            recipient_email: player.email,
            type: 'tournament_start',
            title: `${t.name} starts in ${timeLabel}!`,
            body: `Reminder: ${t.name} kicks off in ${timeLabel}.\n📅 ${startLabel}\nMake sure your squad is ready!`,
            link: `/tournaments/${t.id}`,
            related_id: t.id,
            read: false,
          });
          remindCount++;
        }
      }
    }

    return Response.json({ success: true, remindCount });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
});