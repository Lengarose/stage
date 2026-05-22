import fs from "node:fs";

const page = fs.readFileSync("src/pages/CompetitionDetail.jsx", "utf8");
const server = fs.readFileSync("server/src/server/controllers/functionsController.js", "utf8");

const failures = [];

const fixtureRowStart = page.indexOf("function FixtureRow");
const fixtureRowEnd = page.indexOf("\nfunction ", fixtureRowStart + 1);
const fixtureRow = page.slice(fixtureRowStart, fixtureRowEnd === -1 ? page.length : fixtureRowEnd);

for (const needle of [
  "stageClient.entities.CompetitionFixture.update",
  "processFixtureResult",
]) {
  if (fixtureRow.includes(needle)) failures.push(`CompetitionDetail FixtureRow still contains ${needle}`);
}

if (!fixtureRow.includes('stageClient.functions.invoke("competitionFixtureResult"')) {
  failures.push("CompetitionDetail FixtureRow does not call competitionFixtureResult");
}

if (!server.includes("async competitionFixtureResult")) {
  failures.push("functionsController.js is missing competitionFixtureResult");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Competition result submission is routed through backend functions.");
