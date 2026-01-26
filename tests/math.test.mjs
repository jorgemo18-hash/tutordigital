export async function run({ test, assert }) {
  if (!globalThis.document) {
    globalThis.document = { getElementById: () => null };
  }

  const { asciiToLatex, looksMath, normalizeDictation, isMathOnly } = await import("../assets/student/controllers/math.js");

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

  test("isMathOnly: sentence with x^2 returns false", () => {
    const out = isMathOnly("Mañana estudiamos x^2 en clase");
    assert.equal(out, false);
  });

  test("isMathOnly: pure math returns true", () => {
    const out = isMathOnly("x^2 + 2x + 1");
    assert.equal(out, true);
  });
}
