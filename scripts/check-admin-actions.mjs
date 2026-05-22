import fs from "node:fs";

const admin = fs.readFileSync("src/pages/Admin.jsx", "utf8");
const server = fs.readFileSync("server/src/server/controllers/functionsController.js", "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`async function ${name}`);
  if (start === -1) return "";
  const next = source.indexOf("\n  async function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const forbidden = [
  {
    label: "resolveForfeit direct Match.update",
    found: functionBody(admin, "resolveForfeit").includes("stageClient.entities.Match.update"),
  },
  {
    label: "kickFromClub direct Player.update",
    found: functionBody(admin, "kickFromClub").includes("stageClient.entities.Player.update"),
  },
  {
    label: "deleteClub direct Club.delete",
    found: functionBody(admin, "deleteClub").includes("stageClient.entities.Club.delete"),
  },
  {
    label: "cancelTournament direct Tournament.update",
    found: functionBody(admin, "cancelTournament").includes("stageClient.entities.Tournament.update"),
  },
  {
    label: "removeClubFromCompetition local fallback",
    found: /removeClubFromCompetitionLocally|isFunctionMissingError/.test(admin),
  },
];

const missingHandlers = [
  "async adminMatchActions",
  "async adminMembershipActions",
  "async clubAdminActions",
];

const failures = [
  ...forbidden
    .filter(({ found }) => found)
    .map(({ label }) => `Admin.jsx still contains ${label}`),
  ...missingHandlers
    .filter((needle) => !server.includes(needle))
    .map((needle) => `functionsController.js is missing ${needle}`),
];

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Admin high-risk actions are routed through backend functions.");
