// Test funcional para heicConverter.js — verifica que:
//  - mimes que no necesitan conversión pasan intactos
//  - DNG_MIMES / CONVERTIBLE_MIMES incluyen los mimes DNG esperados
//  - un buffer DNG inválido (mock) lanza el mensaje de error amigable,
//    no el error interno de libvips

export async function run({ test, assert }) {
  const {
    HEIC_MIMES,
    DNG_MIMES,
    CONVERTIBLE_MIMES,
    convertirHeicBuffer,
    convertirHeicBase64,
  } = await import("../server/lib/academiaStorage/heicConverter.js");

  // ── conjuntos de mimes ────────────────────────────────────────────────────

  test("DNG_MIMES contiene image/x-adobe-dng e image/dng", () => {
    assert.ok(DNG_MIMES.has("image/x-adobe-dng"), "falta image/x-adobe-dng");
    assert.ok(DNG_MIMES.has("image/dng"),          "falta image/dng");
  });

  test("CONVERTIBLE_MIMES contiene HEIC, HEIF y ambos DNG", () => {
    for (const mime of ["image/heic", "image/heif", "image/x-adobe-dng", "image/dng"]) {
      assert.ok(CONVERTIBLE_MIMES.has(mime), `falta ${mime} en CONVERTIBLE_MIMES`);
    }
  });

  test("HEIC_MIMES no incluye DNG (conjuntos separados)", () => {
    assert.ok(!HEIC_MIMES.has("image/x-adobe-dng"));
    assert.ok(!HEIC_MIMES.has("image/dng"));
  });

  // ── pass-through para mimes no convertibles ───────────────────────────────

  test("convertirHeicBuffer no toca buffers image/jpeg", async () => {
    const original = Buffer.from("fake jpeg");
    const { buffer, mime } = await convertirHeicBuffer(original, "image/jpeg");
    assert.strictEqual(buffer, original, "buffer modificado sin necesidad");
    assert.strictEqual(mime, "image/jpeg");
  });

  test("convertirHeicBase64 no toca base64 image/png", async () => {
    const original = Buffer.from("fake png").toString("base64");
    const { base64, mime } = await convertirHeicBase64(original, "image/png");
    assert.strictEqual(base64, original);
    assert.strictEqual(mime, "image/png");
  });

  // ── DNG con buffer falso → error amigable ─────────────────────────────────

  test("convertirHeicBuffer con DNG falso lanza mensaje amigable", async () => {
    const fakeBuffer = Buffer.from("not a real dng file");
    let thrown = null;
    try {
      await convertirHeicBuffer(fakeBuffer, "image/x-adobe-dng");
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof Error, "debería lanzar un Error");
    assert.ok(
      thrown.message.includes("DNG") && thrown.message.includes("JPG"),
      `mensaje inesperado: "${thrown.message}"`
    );
  });

  test("convertirHeicBase64 con DNG falso (image/dng) lanza mensaje amigable", async () => {
    const fakeBase64 = Buffer.from("not a real dng file").toString("base64");
    let thrown = null;
    try {
      await convertirHeicBase64(fakeBase64, "image/dng");
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown instanceof Error, "debería lanzar un Error");
    assert.ok(
      thrown.message.includes("DNG"),
      `mensaje inesperado: "${thrown.message}"`
    );
  });
}
