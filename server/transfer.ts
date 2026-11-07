/**
 * Legacy Render PostgreSQL -> Neon PostgreSQL transfer CLI.
 *
 *   npm run db:migrate                       # schema only (target) – unchanged behaviour
 *   npm run db:transfer                      # read-only dry run + verification + report
 *   npm run db:transfer -- --commit          # real transfer (needs LEGACY_TRANSFER_COMMIT=true)
 *
 * The legacy source in DATABASE_URL is only ever read. See README ("Legacy Render ->
 * Neon transfer") and docs/legacy-transfer-runbook.md before committing.
 */
import 'dotenv/config';
import { runLegacyTransfer } from './transfer/engine.js';
import { TransferGuardError } from './transfer/options.js';

const isCommitRequested = process.argv.slice(2).some(arg => arg.toLowerCase() === '--commit');

try {
  const report = await runLegacyTransfer(process.argv.slice(2), process.env);
  if (report.result === 'clean') {
    console.log('\nDry run complete: 0 rows written, source untouched. Awaiting explicit approval before --commit.');
    process.exit(0);
  }
  if (report.result === 'committed') {
    console.log('\nMigration committed to Neon.');
    process.exit(0);
  }
  console.error('\nTransfer finished with result: ' + report.result);
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TransferGuardError) {
    console.error('\nTransfer stopped (' + error.code + '): ' + message);
  } else {
    console.error('\nTransfer failed: ' + message);
  }
  console.error(
    isCommitRequested
      ? 'No partial transfer was kept: the Neon transaction was rolled back.'
      : 'Nothing was written; the legacy database was only read.'
  );
  process.exit(1);
}
