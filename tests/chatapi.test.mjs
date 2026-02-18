export async function run({ test, assert }) {
  const { askGPT } = await import("../assets/shared/js/chatapi.js");

  test("askGPT: uses /api/v1/chat endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let calledUrl = "";
    globalThis.fetch = async (url) => {
      calledUrl = String(url || "");
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true, data: { reply: "ok" } }),
        text: async () => "",
        status: 200,
      };
    };

    try {
      await askGPT({ text: "hola" });
      assert.equal(calledUrl.includes("/api/v1/chat"), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("askGPT: timeout -> code=timeout", async () => {
    const originalFetch = globalThis.fetch;
    let lastUrl = "";
    globalThis.fetch = (url, opts = {}) =>
      new Promise((_, reject) => {
        lastUrl = String(url || "");
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

    assert.equal(lastUrl.includes("/api/v1/chat"), true);
    assert.equal(threw, true);
  });
}
