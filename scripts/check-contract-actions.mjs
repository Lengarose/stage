import fs from "node:fs";

const files = [
  "src/components/contracts/ContractsTab.jsx",
  "src/components/inbox/InboxContractOffer.jsx",
];

const forbidden = [
  "stageClient.entities.PlayerContract.create",
  "stageClient.entities.PlayerContract.update",
  "stageClient.entities.InboxMessage.create",
];

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const needle of forbidden) {
    if (source.includes(needle)) failures.push(`${file} still contains ${needle}`);
  }
}

const server = fs.readFileSync("server/src/server/controllers/functionsController.js", "utf8");
for (const action of ["offer", "counter", "reject", "mark_pending_window", "renewal_offer", "cancel_offer"]) {
  if (!server.includes(`action === '${action}'`)) {
    failures.push(`contractManagement is missing action '${action}'`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Contract actions are routed through backend functions.");
