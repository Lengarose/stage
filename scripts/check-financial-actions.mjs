import { readFileSync } from 'node:fs';

const transferDialog = readFileSync('src/components/contracts/TransferPaymentDialog.jsx', 'utf8');
const tournamentDetail = readFileSync('src/pages/TournamentDetail.jsx', 'utf8');

const failures = [];

if (transferDialog.includes('stageClient.entities.Club.update')) {
  failures.push('TransferPaymentDialog must not update club balances directly');
}

if (tournamentDetail.includes('stageClient.entities.STCTransaction.create')) {
  failures.push('Tournament withdrawal must not create STC transactions directly');
}

const withdrawFn = tournamentDetail.match(/async function withdrawFromTournament\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
if (withdrawFn.includes('stageClient.entities.Club.update')) {
  failures.push('Tournament withdrawal must not update club balances directly');
}

if (failures.length) {
  throw new Error(failures.join('\n'));
}

console.log('Financial actions are routed through backend functions.');
