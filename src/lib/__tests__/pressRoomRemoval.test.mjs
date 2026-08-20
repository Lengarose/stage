import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("press room entities and routes are not exposed while normal news remains", () => {
  const stageClient = read("src/api/stageClient.js");
  const routes = read("server/src/server/routes/registerStageRoutes.js");
  const migrations = read("server/src/server/migrations/startupMigrations.js");
  const newsPage = read("src/pages/News.jsx");
  const newsWidget = read("src/components/NewsWidget.jsx");
  const newspaperSection = read("src/components/news/NewspaperSection.jsx");
  const social = read("src/pages/Social.jsx");

  assert.match(stageClient, /'NewsItem'/);
  assert.doesNotMatch(stageClient, /PressConference|PressQuestion|PressArticle/);

  assert.match(routes, /news-items/);
  assert.doesNotMatch(routes, /press-conferences|press-questions|press-articles/);
  assert.match(migrations, /dropTable\('press_articles'\)/);
  assert.match(migrations, /dropTable\('press_questions'\)/);
  assert.match(migrations, /dropTable\('press_conferences'\)/);

  assert.match(newsPage, /club_news/);
  assert.match(newsPage, /player_news/);
  assert.match(newsPage, /tournament/);
  assert.match(newsPage, /competitions/);
  assert.doesNotMatch(newsPage, /press_conference/);

  assert.doesNotMatch(newsWidget, /PressArticle|press_conference|Press Room/);
  assert.doesNotMatch(newspaperSection, /PressArticle/);
  assert.doesNotMatch(social, /PressArticle|_type: "press"|PressPostCard/);
});

test("press room buttons and admin section are removed from app surfaces", () => {
  const app = read("src/App.jsx");
  const layout = read("src/components/Layout.jsx");
  const admin = read("src/pages/Admin.jsx");
  const tournaments = read("src/components/admin/sections/TournamentsTab.jsx");
  const gameDay = read("src/components/gameday/GameDayDetail.jsx");
  const tournamentDetail = read("src/pages/TournamentDetail.jsx");

  assert.doesNotMatch(app, /AdminPressConferencesPage|press-conferences/);
  assert.doesNotMatch(layout, /press-conferences|pressConferences/);
  assert.doesNotMatch(admin, /PressConferencesTab|seedPressQuestions|PressQuestion|PressConference/);
  assert.doesNotMatch(tournaments, /seedPressQuestions|pressConferences/);
  assert.doesNotMatch(gameDay, /GameDayPressRoom|press_room|matchFlow\.pressRoom/);
  assert.doesNotMatch(tournamentDetail, /TournamentWinnerPressRoomDialog|winnerPressRoom|PressConference/);
});
