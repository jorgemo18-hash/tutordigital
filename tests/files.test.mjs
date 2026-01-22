export async function run({ test, assert }) {
  const { getFileKind, isAcceptedFile } = await import("../assets/lib/files.js");

  test("getFileKind: pdf by mime", () => {
    const f = { name: "doc.pdf", type: "application/pdf" };
    const info = getFileKind(f);
    assert.equal(info.kind, "pdf");
    assert.equal(info.isPDF, true);
    assert.equal(isAcceptedFile(f), true);
  });

  test("getFileKind: image by mime", () => {
    const f = { name: "foto.JPG", type: "image/jpeg" };
    const info = getFileKind(f);
    assert.equal(info.kind, "image");
    assert.equal(info.isImage, true);
    assert.equal(isAcceptedFile(f), true);
  });

  test("getFileKind: unknown", () => {
    const f = { name: "data.xyz", type: "" };
    const info = getFileKind(f);
    assert.equal(info.kind, "unknown");
    assert.equal(isAcceptedFile(f), false);
  });
}
