import assert from "node:assert/strict";
import test from "node:test";
import { formatProfilePlatform } from "../profilePlatform.js";

test("profile platform labels normalize supported display aliases without rewriting data", () => {
  const player = { platform: "PlayStation" };
  assert.equal(formatProfilePlatform(player.platform), "PS5");
  assert.equal(player.platform, "PlayStation");
  for (const value of ["PS5", "ps 5", "PlayStation 5", "play-station"]) assert.equal(formatProfilePlatform(value), "PS5");
  for (const value of ["PS4", "ps 4", "PlayStation 4", "playstation_4"]) assert.equal(formatProfilePlatform(value), "PS4");
  for (const value of ["Xbox", "xbox one", "Xbox Series X", "xbox-series-s", "Xbox Series X/S"]) assert.equal(formatProfilePlatform(value), "Xbox");
  for (const value of ["PC", "pc", "Windows"]) assert.equal(formatProfilePlatform(value), "PC");
});

test("mixed platforms, unknown hardware and missing values remain truthful", () => {
  for (const value of ["Cross-Platform", "cross platform", "Crossplay"]) assert.equal(formatProfilePlatform(value), "Cross-Platform");
  for (const value of ["PS3", "Nintendo Switch", "common-gen4", "common-gen5", "PSN"]) assert.equal(formatProfilePlatform(value), value);
  assert.equal(formatProfilePlatform(null), "—");
  assert.equal(formatProfilePlatform("  ", "Platform"), "Platform");
  assert.equal(formatProfilePlatform(" Other Device "), "Other Device");
});
