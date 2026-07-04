import { strict as assert } from "node:assert";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function loadTests() {
  const modules = [
    "./origins.test.mjs",
    "./files.test.mjs",
    "./math.test.mjs",
    "./backend.test.mjs",
    "./chatapi.test.mjs",
    "./api-v1.test.mjs",
    "./groups-pagination.test.mjs",
    "./api-v1-auth.test.mjs",
    "./server-me-fastify.test.mjs",
    "./server-chat-fastify.test.mjs",
    "./server-tickets-fastify.test.mjs",
    "./route-guards.test.mjs",
    "./tenant-membership-guard.test.mjs",
    "./tenant-guard-routes-wiring.test.mjs",
    "./server-notebook-summary.test.mjs",
    "./admin-teacher-invite.test.mjs",
    "./admin-groups-ensure.test.mjs",
    "./admin-teachers-routes-wiring.test.mjs",
    "./teacher-invite-redeem.test.mjs",
    "./teacher-me.test.mjs",
    "./heic-converter.test.mjs",
    "./alumnosList.test.mjs",
  ];
  for (const mod of modules) {
    const m = await import(new URL(mod, import.meta.url));
    if (typeof m.run === "function") {
      await m.run({ test, assert });
    }
  }
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) en: ${label}`)), ms)
    ),
  ]);
}

let failures = 0;
await loadTests();

const filter = String(process.env.TEST || "").trim().toLowerCase();
const timeoutMs = Number(process.env.TIMEOUT_MS || 0);

const selected = filter
  ? tests.filter((t) => t.name.toLowerCase().includes(filter))
  : tests;

if (filter && selected.length === 0) {
  console.error(`No hay tests que coincidan con TEST="${process.env.TEST}"`);
  process.exit(1);
}

for (const t of selected) {
  try {
    await withTimeout(Promise.resolve().then(t.fn), timeoutMs, t.name);
    console.log(`✓ ${t.name}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${t.name}`);
    console.error(err);
  }
}

console.log(`\nResumen: ${selected.length} tests, ${failures} fallos`);

if (failures) {
  process.exitCode = 1;
}
