// Runs a SQL file against the connected Supabase Postgres database.
// Usage: node --env-file=/vercel/share/.env.project scripts/run-sql.mjs scripts/sql/001_schema.sql
import { readFileSync } from "node:fs";
import pg from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING,
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${file}`);
} catch (err) {
  console.error(`FAILED: ${file}`);
  console.error(err.message);
  if (err.position) {
    const pos = Number(err.position);
    console.error("Near:", sql.slice(Math.max(0, pos - 120), pos + 120));
  }
  process.exit(1);
} finally {
  await client.end();
}
