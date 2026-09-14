import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { env } from "../src/config/env.js";

async function main() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = path.resolve(import.meta.dirname, "..", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows: applied } = await pool.query<{ filename: string }>(
    "select filename from schema_migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.error(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
