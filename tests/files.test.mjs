export async function run({ test, assert }) {
  const { detectFileKind, isAcceptedFile, FILE_KINDS } = await import("../assets/lib/files.js");

  test("detectFileKind: pdf by mime", () => {
    const f = { name: "doc.pdf", type: "application/pdf" };
    const info = detectFileKind(f);
    assert.equal(info.kind, FILE_KINDS.PDF);
    assert.equal(info.isPDF, true);
    assert.equal(isAcceptedFile(f), true);
  });

  test("detectFileKind: image by ext", () => {
    const f = { name: "foto.JPG", type: "" };
    const info = detectFileKind(f);
    assert.equal(info.kind, FILE_KINDS.IMAGE);
    assert.equal(info.isImage, true);
    assert.equal(isAcceptedFile(f), true);
  });

  test("detectFileKind: unknown", () => {
    const f = { name: "data.xyz", type: "" };
    const info = detectFileKind(f);
    assert.equal(info.kind, FILE_KINDS.UNKNOWN);
    assert.equal(isAcceptedFile(f), false);
  });
}
