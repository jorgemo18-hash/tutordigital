export async function run({ test, assert }) {
  const { validateChatBody } = await import("../api/chat.js");

  test("validateChatBody: text only ok", () => {
    const r = validateChatBody({ text: "hola", mode: "DEBERES" });
    assert.equal(r.ok, true);
    assert.equal(r.data.text, "hola");
  });

  test("validateChatBody: invalid mode", () => {
    const r = validateChatBody({ text: "hola", mode: "LO_QUE_SEA" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid_mode");
    assert.equal(r.status, 400);
  });

  test("validateChatBody: empty payload rejected", () => {
    const r = validateChatBody({});
    assert.equal(r.ok, false);
    assert.equal(r.code, "missing_text_or_file");
    assert.equal(r.status, 400);
  });

  test("validateChatBody: pdf base64 ok", () => {
    const r = validateChatBody({
      fileDataUrl: "data:application/pdf;base64,QUJD",
      fileName: "x.pdf",
      fileMime: "application/pdf",
    });
    assert.equal(r.ok, true);
  });

  test("validateChatBody: invalid base64", () => {
    const r = validateChatBody({
      fileDataUrl: "data:application/pdf;base64,@@@",
      fileName: "x.pdf",
      fileMime: "application/pdf",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid_base64");
    assert.equal(r.status, 400);
  });

  test("validateChatBody: unsupported mime", () => {
    const r = validateChatBody({
      fileDataUrl: "data:application/vnd.ms-excel;base64,QUJD",
      fileName: "x.xlsx",
      fileMime: "application/vnd.ms-excel",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "unsupported_mime");
    assert.equal(r.status, 415);
  });

  test("validateChatBody: payload too large", () => {
    const bytes = 12 * 1024 * 1024 + 1;
    const base64Len = Math.ceil(bytes / 3) * 4;
    const big = "A".repeat(base64Len);
    const r = validateChatBody({
      fileDataUrl: `data:application/pdf;base64,${big}`,
      fileName: "x.pdf",
      fileMime: "application/pdf",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "payload_too_large");
    assert.equal(r.status, 413);
  });

  test("validateChatBody: image invalid", () => {
    const r = validateChatBody({
      imageDataUrl: "data:image/png;base64,@@@",
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, "invalid_image");
    assert.equal(r.status, 400);
  });
}
