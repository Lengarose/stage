import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.PressQuestion.list(null, 1);
    if (existing.length > 0) {
      return Response.json({ skipped: true, message: 'Already seeded' });
    }

    const questions = [
      { question: "How do you rate your team's performance today?", answer_a: "Outstanding — we gave 100%", answer_b: "Decent, but we can improve", answer_c: "Disappointing overall", answer_d: "The result doesn't reflect the game", category: "performance" },
      { question: "What was the key moment of the match?", answer_a: "Our first goal changed everything", answer_b: "A great defensive block saved us", answer_c: "The red card shifted the momentum", answer_d: "The penalty decision was crucial", category: "match" },
      { question: "How do you assess your opponent?", answer_a: "Very tough and well-organized", answer_b: "We expected more from them", answer_c: "They surprised us with their tactics", answer_d: "Respect to them — fair game", category: "opponent" },
      { question: "What's the message to your fans?", answer_a: "We play for you — thank you!", answer_b: "We'll work harder next time", answer_c: "Keep believing in us", answer_d: "Your support makes the difference", category: "fans" },
      { question: "How are you preparing for the next match?", answer_a: "Full focus on recovery and analysis", answer_b: "We'll fix the tactical issues we saw", answer_c: "Confidence is high after this result", answer_d: "One game at a time — that's our motto", category: "preparation" },
      { question: "How would you describe the dressing room atmosphere?", answer_a: "Buzzing — everyone is pumped!", answer_b: "Calm and focused", answer_c: "Disappointed but determined", answer_d: "United — we face it together", category: "team" },
      { question: "What role did your tactics play today?", answer_a: "The game plan worked perfectly", answer_b: "We had to adjust at half-time", answer_c: "The opponent forced us to change", answer_d: "We stuck to our identity throughout", category: "tactics" },
      { question: "Who was your standout player today?", answer_a: "The whole team deserves credit", answer_b: "Our goalkeeper kept us in it", answer_c: "The midfield controlled the tempo", answer_d: "Our striker made the difference", category: "players" },
      { question: "How important is this result for your campaign?", answer_a: "Massive — this is a turning point", answer_b: "Good points, but there's more to play for", answer_c: "We must stay focused and not get carried away", answer_d: "Every game is a final for us", category: "season" },
      { question: "What's your message to the opposition?", answer_a: "Well played — see you next time", answer_b: "We'll be ready when we meet again", answer_c: "No words — the pitch said it all", answer_d: "Respect always, rivalry on the field", category: "opponent" },
    ];

    await base44.asServiceRole.entities.PressQuestion.bulkCreate(questions);
    return Response.json({ success: true, seeded: questions.length });
  } catch (error) {
    console.error('Seed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});