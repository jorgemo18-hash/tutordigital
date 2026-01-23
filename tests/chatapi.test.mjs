export async function run({ test, assert }) {
  const { askGPT } = await import("../assets/features/chat/chatapi.js");

  test("askGPT: timeout -> code=timeout", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, opts = {}) =>
      new Promise((_, reject) => {
        if (!opts.signal || typeof opts.signal.addEventListener !== "function") {
          reject(new Error("MissingAbortSignal"));
          return;
        }
        opts.signal.addEventListener("abort", () => {
          const err = new Error("AbortError");
          err.name = "AbortError";
          reject(err);
        });
      });

    let threw = false;
    try {
      await askGPT({ text: "hola", timeoutMs: 5 });
    } catch (e) {
      threw = e && e.code === "timeout";
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(threw, true);
  });
}
