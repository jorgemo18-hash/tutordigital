// Reconciliación real contra la BD — requiere SUPABASE_DB_URL (mismo
// patrón que tests/rls/, separado de npm test por defecto). Falla con
// exit code 1 y un listado claro si hay migraciones en el repo sin
// aplicar (y sin explicar en known-drift.json) o filas en
// schema_migrations sin archivo correspondiente (y sin explicar).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { parseRepoFiles, matchMigrations } from "./reconcileMigrations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "..", "supabase", "migrations");

function requireDbUrl() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "Falta SUPABASE_DB_URL — ver tests/rls/harness.mjs o scripts/README-backup-db.md " +
        "para cómo conseguirla (dashboard de Supabase -> Connect -> Session pooler)."
    );
  }
  return url;
}

async function main() {
  const filenames = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const repoByNnn = parseRepoFiles(filenames);

  const allowlist = JSON.parse(readFileSync(join(MIGRATIONS_DIR, "known-drift.json"), "utf8"));

  const client = new pg.Client({ connectionString: requireDbUrl() });
  await client.connect();
  let dbEntries;
  try {
    const { rows } = await client.query(
      "select version, name from supabase_migrations.schema_migrations order by version"
    );
    dbEntries = rows;
  } finally {
    await client.end();
  }

  const { unexplainedRepoOnly, unexplainedDbOnly, malformedAllowlistEntries } = matchMigrations({
    repoByNnn,
    dbEntries,
    allowlist,
  });

  if (!unexplainedRepoOnly.length && !unexplainedDbOnly.length && !malformedAllowlistEntries.length) {
    console.log(`✓ Migraciones reconciliadas: ${Object.keys(repoByNnn).length} archivos, ${dbEntries.length} filas en schema_migrations, sin desajustes nuevos.`);
    return;
  }

  if (unexplainedRepoOnly.length) {
    console.error("\n✗ Migraciones en el repo SIN aplicar y SIN explicar en known-drift.json:");
    for (const f of unexplainedRepoOnly) console.error(`  - ${f}`);
  }
  if (unexplainedDbOnly.length) {
    console.error("\n✗ Filas en schema_migrations SIN archivo del repo y SIN explicar en known-drift.json:");
    for (const e of unexplainedDbOnly) console.error(`  - ${e}`);
  }
  if (malformedAllowlistEntries.length) {
    console.error(
      "\n✗ Entradas de known-drift.json sin 'reason' o sin 'destino' (no cuentan como explicación válida):"
    );
    for (const e of malformedAllowlistEntries) console.error(`  - ${e}`);
  }
  console.error(
    "\nSi es un caso nuevo genuino, investígalo (¿se aplicó con otro nombre? ¿nunca se aplicó? " +
      "¿es un archivo nuevo pendiente de aplicar?) y añade una entrada a " +
      "supabase/migrations/known-drift.json con 'reason' (qué es) y 'destino' (en qué tarea se " +
      "resuelve, o por qué es tolerable de forma permanente) — no lo silencies sin más."
  );
  process.exitCode = 1;
}

await main();
