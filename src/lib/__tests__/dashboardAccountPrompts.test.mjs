import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function readText(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("dashboard does not advertise account creation or profile upgrade actions", () => {
  const source = readText("src/pages/Dashboard.jsx");

  assert.doesNotMatch(source, /dashboardViewProfile/);
  assert.doesNotMatch(source, /dashboardSetupTitle/);
  assert.doesNotMatch(source, /dashboardSetupDesc/);
  assert.doesNotMatch(source, /dashboardSetupCta/);
  assert.doesNotMatch(source, /to="\/profile"/);
});

test("global header does not duplicate role upgrade prompts from settings", () => {
  const source = readText("src/components/Layout.jsx");

  assert.doesNotMatch(source, /\+ Create club/);
  assert.doesNotMatch(source, /myPlayer\s*&&\s*!myClubId[\s\S]{0,320}to="\/clubs"/);
});

test("identity dropdowns contain Logout while Home owns profile navigation",()=>{
 const source=readText("src/components/Layout.jsx");
 const desktop=source.slice(source.indexOf("function HeaderIdentityMenu"),source.indexOf("function getMobilePrimary"));
 const mobile=source.slice(source.indexOf("function MobileHeaderIdentity"),source.indexOf("function AdminMobileTopBar"));
 for(const menu of [desktop,mobile]){assert.match(menu,/<IdentityLogoutItem \/>/);assert.doesNotMatch(menu,/<Link to=/);}
 assert.match(source,/path: "\/profile"/);assert.match(source,/nav.myClub/);
});
