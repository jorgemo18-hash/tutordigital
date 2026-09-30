import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// "TOCA ENVIAR" (Jorge, 30/09/2026): desde el día configurado, una franja
// arriba del panel hasta que el envío del mes está hecho; solo "Revisar".
// Ver assets/academia/admin/js/avisoEnvio/avisoEnvio.js.
export async function run({ test, assert }) {
  const { envioAMirar, familiasPendientes, crearAvisoEnvio } = await import("../../assets/academia/admin/js/avisoEnvio/avisoEnvio.js");
  const { diaDeEnvio } = await import("../../assets/academia/admin/js/sections/ajustes/tabs/facturacionTab.js");
  const dia = (d) => new Date(2026, 9, d); // octubre de 2026

  test("desde el día configurado toca el envío de este mes; antes, el del mes anterior si quedó sin hacer", () => {
    assert.deepEqual(envioAMirar(dia(5), 5), { mes: 10, anio: 2026, esDeEsteMes: true });
    assert.deepEqual(envioAMirar(dia(7), 5), { mes: 10, anio: 2026, esDeEsteMes: true });
    assert.deepEqual(envioAMirar(dia(3), 5), { mes: 9, anio: 2026, esDeEsteMes: false });
    assert.deepEqual(envioAMirar(new Date(2027, 0, 2), 5), { mes: 12, anio: 2026, esDeEsteMes: false });
    assert.equal(envioAMirar(dia(5), null), null, "sin día configurado, sin aviso");
  });

  const familia = (extra) => ({ familia_id: "f", familia_email: "a@x.es", alumnos_activos: [{ id: "a" }], recibo: { id: "r", fecha_envio: "2026-10-05" }, alumnos_informe: [], ...extra });

  test("pendiente: sin recibo creado, recibo sin enviar o informe con clases sin enviar; sin email no cuenta", () => {
    assert.equal(familiasPendientes([familia()]).length, 0, "todo enviado");
    assert.equal(familiasPendientes([familia({ recibo: null })]).length, 1, "recibo por crear");
    assert.equal(familiasPendientes([familia({ recibo: { id: "r", fecha_envio: null } })]).length, 1);
    assert.equal(familiasPendientes([familia({ alumnos_informe: [{ id: "a", tiene_sesiones: true, informe_enviado_at: null }] })]).length, 1);
    assert.equal(familiasPendientes([familia({ alumnos_informe: [{ id: "a", tiene_sesiones: false, informe_enviado_at: null }] })]).length, 0, "sin clases no hay informe");
    assert.equal(familiasPendientes([familia({ recibo: null, familia_email: "" })]).length, 0, "sin email: tiene su propio aviso y no puede dejar la franja puesta para siempre");
  });

  test("la franja dice qué toca y cuántas faltan, y Revisar lleva al mes del envío", async () => {
    const contenedor = document.createElement("div");
    const abiertos = [];
    const pedidos = [];
    const aviso = crearAvisoEnvio({
      contenedor, diaEnvio: 5, hoyFn: () => dia(6),
      fetchRecibosFn: async (p) => { pedidos.push(p); return { recibos: [familia({ recibo: null }), familia()], periodoInforme: { mes: 9, anio: 2026 } }; },
      onRevisar: (p) => abiertos.push(p),
    });
    await aviso.actualizar();
    assert.deepEqual(pedidos, [{ mes: 10, anio: 2026 }]);
    assert.equal(contenedor.querySelector(".ac-aviso-envio span").textContent, "Toca el envío a familias — recibo de octubre · informe de septiembre · 1 familia pendiente");
    contenedor.querySelector("button").click();
    assert.deepEqual(abiertos, [{ mes: 10, anio: 2026 }]);
  });

  test("con todo enviado la franja se va; sin día configurado no pide nada", async () => {
    const contenedor = document.createElement("div");
    const aviso = crearAvisoEnvio({ contenedor, diaEnvio: 5, hoyFn: () => dia(6), fetchRecibosFn: async () => ({ recibos: [familia()] }), onRevisar: () => {} });
    await aviso.actualizar();
    assert.equal(contenedor.innerHTML, "");
    let pedidas = 0;
    await crearAvisoEnvio({ contenedor, diaEnvio: null, fetchRecibosFn: async () => { pedidas += 1; return { recibos: [] }; }, onRevisar: () => {} }).actualizar();
    assert.equal(pedidas, 0);
  });

  test("el día que se guarda: 1 a 28, y vacío o raro = sin aviso", () => {
    assert.equal(diaDeEnvio("5"), 5);
    assert.equal(diaDeEnvio(""), null);
    assert.equal(diaDeEnvio("31"), null);
    assert.equal(diaDeEnvio("0"), null);
    assert.equal(diaDeEnvio("abc"), null);
  });
}
