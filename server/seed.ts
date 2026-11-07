import { bootstrapProductionAdmin, ensureSeeded } from './db.js';

if (process.env.NODE_ENV === 'production') {
  const result = bootstrapProductionAdmin();
  if (result.bootstrapped) {
    console.log(`Production bootstrap complete for ${process.env.BOOTSTRAP_ADMIN_EMAIL}.`);
  } else {
    console.log(`Production bootstrap skipped: ${result.reason}`);
  }
} else {
  ensureSeeded();
  console.log('SQLite seed data applied in data/pos.db (Default admin: admin@musafir.local / Musafir@2026!)');
}
