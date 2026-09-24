import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;
const RAIZ = new URL("../../", import.meta.url).pathname;

// EL HISTORIAL DE LOS RECIBOS (migración 134). El 24/09/2026 un Regenerar
// borró las marcas de pago de septiembre y no había dónde mirarlas. Datos
// inventados.
export async function run({ test, assert }) {
  const { estadoRecuperable, recuperarEstadoDelRecibo } = await import("../../server/lib/academiaRecibos/historial.js");
  const { textoDelEvento, textoRecuperable, buildCambiosDelRecibo } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/historial/cambiosDelRecibo.js"
  );
  const { createApp } = await import("../../server/app.js");

  // Lo que dejaría el trigger con: crear, enviar, pagar, regenerar.
  const EVENTOS = [
    { id: 1, recibo_id: "viejo", accion: "creado", despues: { estado: "borrador", total_neto: 80 }, created_at: "2026-09-12T10:00:00Z" },
    { id: 2, recibo_id: "viejo", accion: "envio", antes: { estado: "borrador" }, despues: { estado: "enviado", fecha_envio: "2026-09-13T09:00:00Z" }, created_at: "2026-09-13T09:00:00Z" },
    { id: 3, recibo_id: "viejo", accion: "pago", antes: { estado: "enviado" }, despues: { estado: "pagado", fecha_pago: "2026-09-20" }, created_at: "2026-09-20T18:00:00Z" },
    { id: 4, recibo_id: "viejo", accion: "borrado", antes: { estado: "pagado", fecha_pago: "2026-09-20", fecha_envio: "2026-09-13T09:00:00Z" }, created_at: "2026-09-24T15:58:00Z" },
    { id: 5, recibo_id: "nuevo", accion: "creado", despues: { estado: "borrador", total_neto: 80 }, created_at: "2026-09-24T15:58:01Z" },
  ];

  test("REGRESIÓN: tras regenerar, se puede recuperar el pago con su fecha y el envío", () => {
    assert.deepEqual(estadoRecuperable(EVENTOS, { id: "nuevo", estado: "borrador" }), {
      estado: "pagado", fecha_pago: "2026-09-20", fecha_envio: "2026-09-13T09:00:00Z", borrado_el: "2026-09-24T15:58:00Z",
    });
  });

  test("no hay nada que recuperar si el nuevo ya no está sin enviar, o si el borrado era un borrador", () => {
    assert.equal(estadoRecuperable(EVENTOS, { id: "nuevo", estado: "pagado" }), null);
    const soloBorrador = EVENTOS.map((e) => (e.accion === "borrado" ? { ...e, antes: { estado: "borrador" } } : e));
    assert.equal(estadoRecuperable(soloBorrador, { id: "nuevo", estado: "borrador" }), null);
    assert.equal(estadoRecuperable([], { id: "x", estado: "borrador" }), null);
  });

  test("recuperar escribe en el recibo lo que dice el historial, no lo que mande nadie", async () => {
    const escrito = [];
    const admin = {
      from(tabla) {
        const q = {
          select() { return q; }, eq() { return q; }, order() { return q; },
          update(v) { escrito.push(v); return q; },
          maybeSingle: async () => ({ data: { id: "nuevo", familia_id: "f", mes: 9, anio: 2026, estado: "borrador" }, error: null }),
          then(r) { return r(tabla === "academia_recibos_historial" ? { data: EVENTOS, error: null } : { error: null }); },
        };
        return q;
      },
    };
    const r = await recuperarEstadoDelRecibo(admin, { tenantId: "t", reciboId: "nuevo" });
    assert.equal(r.ok, true);
    assert.deepEqual(escrito, [{ estado: "pagado", fecha_pago: "2026-09-20", fecha_envio: "2026-09-13T09:00:00Z" }]);
  });

  test("cada evento se lee en castellano", () => {
    assert.match(textoDelEvento(EVENTOS[2]), /Marcado como pagado \(20\/9\)/);
    assert.match(textoDelEvento(EVENTOS[3]), /Borrado al rehacerlo · estaba pagado el 20\/9$/);
    assert.match(textoDelEvento({ accion: "cambio", antes: { total_neto: 80, descuento_puntual_pct: 25 }, despues: { total_neto: 40, descuento_puntual_pct: 50 } }), /importe 80,00 € → 40,00 €, descuento 25 % → 50 %/);
    assert.match(textoRecuperable({ estado: "pagado", fecha_pago: "2026-09-20" }), /se perdió que estaba pagado el 20\/9/);
  });

  test("la pantalla enseña el aviso y el botón, y al pulsarlo recupera y se recarga", async () => {
    let llamadas = 0;
    let recuperado = null;
    const fetchHistorial = async () => (llamadas++ === 0
      ? { eventos: EVENTOS, recuperable: { estado: "pagado", fecha_pago: "2026-09-20" } }
      : { eventos: EVENTOS, recuperable: null });
    const el = buildCambiosDelRecibo({ familiaId: "f", mes: 9, anio: 2026, reciboId: "nuevo",
      fetchHistorial, recuperar: async (id) => { recuperado = id; } });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(el.querySelectorAll(".ef-cambios-lista li").length, 5);
    const btn = el.querySelector(".ef-cambios-recuperar button");
    assert.ok(btn);
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(recuperado, "nuevo");
    assert.equal(el.querySelector(".ef-cambios-recuperar"), null, "tras recuperar, el aviso desaparece");
  });

  test("la migración: trigger en creación, cambio y borrado; historial solo admite añadir", () => {
    const sql = fs.readFileSync(`${RAIZ}supabase/migrations/134_historial_de_recibos.sql`, "utf8");
    assert.match(sql, /after insert or update or delete on public\.academia_recibos/);
    assert.match(sql, /before delete on public\.academia_recibos_historial/);
    assert.match(sql, /before update on public\.academia_recibos_historial/);
    assert.match(sql, /enable row level security/);
  });

  for (const [method, url] of [["GET", "/api/v1/academia/recibos/historial?familia_id=00000000-0000-0000-0000-000000000000&mes=9&anio=2026"], ["POST", "/api/v1/academia/recibos/00000000-0000-0000-0000-000000000000/recuperar-estado"]]) {
    test(`wiring: ${method} ${url.split("?")[0]} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method, url });
      await app.close();
      assert.ok([400, 401, 403].includes(res.statusCode), `recibió ${res.statusCode}`);
    });
  }
}
