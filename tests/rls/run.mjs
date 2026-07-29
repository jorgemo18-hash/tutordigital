// Runner de la suite RLS — separado de tests/run.mjs a propósito: necesita
// SUPABASE_DB_URL (conexión real a Postgres) y no debe formar parte del
// `npm test` por defecto, que es offline. Ver tests/rls/harness.mjs.
import { strict as assert } from "node:assert";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function loadTests() {
  const modules = ["./academiaFichajes.rls.test.mjs"];
  for (const mod of modules) {
    const m = await import(new URL(mod, import.meta.url));
    if (typeof m.run === "function") {
      await m.run({ test, assert });
    }
  }
}

if (!process.env.SUPABASE_DB_URL) {
  console.error(
    "✗ Falta SUPABASE_DB_URL. Ver tests/rls/harness.mjs o scripts/README-backup-db.md " +
      "para cómo conseguirla (dashboard de Supabase -> Connect -> Session pooler)."
  );
  process.exit(1);
}

let failures = 0;
await loadTests();

const filter = String(process.env.TEST || "").trim().toLowerCase();
const selected = filter
  ? tests.filter((t) => t.name.toLowerCase().includes(filter))
  : tests;

if (filter && selected.length === 0) {
  console.error(`No hay tests RLS que coincidan con TEST="${process.env.TEST}"`);
  process.exit(1);
}

for (const t of selected) {
  try {
    await t.fn();
    console.log(`✓ ${t.name}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${t.name}`);
    console.error(err);
  }
}

console.log(`\nResumen RLS: ${selected.length} tests, ${failures} fallos`);

if (failures) {
  process.exitCode = 1;
}
