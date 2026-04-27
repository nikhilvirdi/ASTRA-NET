/**
 * Setup TimescaleDB hypertables for all time-series models.
 * Run once after prisma db push: npx tsx src/scripts/setup_hypertables.ts
 * Compatible with TimescaleDB v1.x and v2.x
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const HYPERTABLES = [
  'KpReading', 'SolarWindReading', 'BzReading',
  'FireHotspot', 'FloodEvent', 'BhumiIntelligence',
  'TLERecord', 'ConjunctionEvent', 'KakshaIntelligence',
];

async function setupHypertables() {
  const client = await pool.connect();
  try {
    // Check TimescaleDB version
    const verRes = await client.query(`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`);
    const version = verRes.rows[0]?.extversion ?? 'unknown';
    console.log(`TimescaleDB version: ${version}`);

    // Get actual tables in DB
    const tableRes = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const existingTables = new Set(tableRes.rows.map((r: any) => r.tablename));
    console.log('Tables found:', [...existingTables].join(', '));

    for (const table of HYPERTABLES) {
      if (!existingTables.has(table)) {
        console.log(`⏭  Skipping ${table} (not in DB)`);
        continue;
      }
      try {
        // Two-argument form works on both v1 and v2
        await client.query(
          `SELECT create_hypertable('public."${table}"', 'timestamp', if_not_exists => TRUE, migrate_data => TRUE)`
        );
        console.log(`✅ Hypertable: ${table}`);
      } catch (e: any) {
        if (e.message?.includes('already a hypertable')) {
          console.log(`⏭  Already hypertable: ${table}`);
        } else {
          console.warn(`⚠️  ${table}: ${e.message}`);
        }
      }
    }

    console.log('\n🚀 Hypertable setup complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

setupHypertables().catch(console.error);
