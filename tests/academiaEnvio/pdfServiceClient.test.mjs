// pdfServiceClient.js no tenía ni un solo test pese a ser el punto único de
// fallo de recibos, informes, normas y hoja de inscripción. Estos casos
// fijan las tres reglas de reintento y el timeout por intento.
//
// `fetch` se sustituye por un doble global; ahora/dormir se inyectan para
// que el presupuesto se agote sin esperar en tiempo real.
function respuestaOk(bytes = "PDF") {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode(bytes).buffer,
  };
}

function respuestaError(status, body = "") {
  return { ok: false, status, text: async () => body };
}

// Devuelve las respuestas en orden; la última se repite si hacen falta más.
function fakeFetch(respuestas) {
  const llamadas = [];
  const fn = async (url, opciones) => {
    llamadas.push({ url, signal: opciones?.signal });
    const siguiente = respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)];
    if (typeof siguiente === "function") return siguiente();
    return siguiente;
  };
  fn.llamadas = llamadas;
  return fn;
}

function errorDeRed() {
  return () => Promise.reject(new TypeError("fetch failed"));
}

function abortado() {
  return () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    return Promise.reject(err);
  };
}

export async function run({ test, assert }) {
  const { fetchPdfBuffer } = await import("../../server/lib/academiaEnvio/pdfServiceClient.js");

  // Reloj y espera falsos: el tiempo avanza solo cuando "dormimos".
  function relojFalso() {
    let t = 0;
    return {
      ahora: () => t,
      dormir: async (ms) => { t += ms; },
      avanzar: (ms) => { t += ms; },
    };
  }

  const opts = (reloj, extra = {}) => ({ ahora: reloj.ahora, dormir: reloj.dormir, ...extra });

  test("éxito al primer intento: un solo fetch, devuelve el buffer", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaOk("HOLA")]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      assert.equal(res.ok, true);
      assert.equal(res.buffer.toString(), "HOLA");
      assert.equal(globalThis.fetch.llamadas.length, 1);
    } finally { globalThis.fetch = original; }
  });

  test("REGRESIÓN: un 400 no se reintenta — es determinista", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(400, '{"error":"payload inválido"}')]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      assert.equal(res.ok, false);
      assert.equal(res.pdfServiceStatus, 400);
      assert.equal(res.motivo, "payload inválido", "usa el error del servicio si viene en JSON");
      assert.equal(globalThis.fetch.llamadas.length, 1, "no debe reintentar un 4xx no reintentable");
    } finally { globalThis.fetch = original; }
  });

  test("un 429 SÍ se reintenta — es lo que devuelve Render dormido", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(429, "Too Many Requests"), respuestaOk()]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      assert.equal(res.ok, true);
      assert.equal(globalThis.fetch.llamadas.length, 2);
    } finally { globalThis.fetch = original; }
  });

  test("un 502 se reintenta y acaba saliendo bien", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(502, "<html>bad gateway</html>"), respuestaOk()]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/informe", {}, opts(reloj));
      assert.equal(res.ok, true);
      assert.equal(globalThis.fetch.llamadas.length, 2);
    } finally { globalThis.fetch = original; }
  });

  test("un fallo de red se reintenta; si persiste devuelve pdf_service_unreachable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([errorDeRed()]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      assert.equal(res.ok, false);
      assert.equal(res.code, "pdf_service_unreachable");
      assert.ok(globalThis.fetch.llamadas.length > 1, "debe haber reintentado");
    } finally { globalThis.fetch = original; }
  });

  test("REGRESIÓN: se pasa AbortSignal — sin él una petición colgada bloqueaba ~25 min", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaOk()]);
    try {
      const reloj = relojFalso();
      await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      const señal = globalThis.fetch.llamadas[0].signal;
      assert.ok(señal, "cada intento debe llevar signal");
      assert.equal(typeof señal.aborted, "boolean");
    } finally { globalThis.fetch = original; }
  });

  test("timeout del intento -> code pdf_service_timeout, distinto de unreachable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([abortado()]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj));
      assert.equal(res.ok, false);
      assert.equal(res.code, "pdf_service_timeout");
    } finally { globalThis.fetch = original; }
  });

  test("no empieza un intento que no cabe en el presupuesto total", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(503, "")]);
    try {
      const reloj = relojFalso();
      // espera 2s + timeout 10s = 12s de compromiso; con 11s de presupuesto
      // no cabe, así que ni se intenta.
      await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj, {
        timeoutPorIntentoMs: 10000,
        presupuestoTotalMs: 11000,
        esperasMs: [2000, 5000, 10000],
      }));
      assert.equal(globalThis.fetch.llamadas.length, 1, "el presupuesto debe cortar antes del reintento");
    } finally { globalThis.fetch = original; }
  });

  test("el presupuesto permite el reintento que sí cabe, y corta en el siguiente", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(503, "")]);
    try {
      const reloj = relojFalso();
      // Cabe el 1º (0+2+10=12 <= 20) pero no el 2º (2+5+10=17... y tras
      // dormir 2s el reloj va por 2, así que 2+5+10=17 <= 20 también cabría;
      // con 16s de presupuesto el segundo reintento queda fuera).
      await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj, {
        timeoutPorIntentoMs: 10000,
        presupuestoTotalMs: 16000,
        esperasMs: [2000, 5000, 10000],
      }));
      assert.equal(globalThis.fetch.llamadas.length, 2, "debe caber exactamente un reintento");
    } finally { globalThis.fetch = original; }
  });

  test("cuerpo no-JSON de un 502 de Render se conserva crudo para Sentry", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = fakeFetch([respuestaError(502, "<html>Application failed to respond</html>")]);
    try {
      const reloj = relojFalso();
      const res = await fetchPdfBuffer("http://pdf", "/recibo", {}, opts(reloj, { esperasMs: [] }));
      assert.equal(res.pdfServiceBody, "<html>Application failed to respond</html>");
      assert.equal(res.motivo, "El servicio de PDF devolvió un error.");
    } finally { globalThis.fetch = original; }
  });
}
