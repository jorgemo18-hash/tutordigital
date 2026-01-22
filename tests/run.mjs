import { strict as assert } from "node:assert";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function loadTests() {
  const modules = [
    "./files.test.mjs",
    "./math.test.mjs",
  ];
  for (const mod of modules) {
    const m = await import(mod);
    if (typeof m.run === "function") {
      await m.run({ test, assert });
    }
  }
}

let failures = 0;
await loadTests();

for (const t of tests) {
  try {
    await t.fn();
    console.log(`✓ ${t.name}`);
  } catch (err) {
    failures += 1;
    console.error(`✗ ${t.name}`);
    console.error(err);
  }
}

if (failures) {
  process.exitCode = 1;
}
