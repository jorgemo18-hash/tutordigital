export async function run({ test, assert }) {
  if (!globalThis.document) {
    globalThis.document = { getElementById: () => null };
  }

  const { asciiToLatex, looksMath, normalizeDictation } = await import("../assets/lib/math.js");

  test("asciiToLatex: sqrt with space", () => {
    const out = asciiToLatex("sqrt (x+1)");
    assert.equal(out, "\\sqrt{x+1}");
  });

  test("looksMath: plain sentence returns false", () => {
    const out = looksMath("Voy por la calle con mis amigos");
    assert.equal(out, false);
  });

  test("normalizeDictation: keeps non-math phrases", () => {
    const out = normalizeDictation("Colón conquistó América en 1492");
    assert.equal(out, "Colón conquistó América en 1492");
  });
}
