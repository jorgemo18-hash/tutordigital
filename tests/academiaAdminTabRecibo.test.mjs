import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reciboFixture(id) {
  return {
    id,
    mes: 7,
    anio: 2026,
    concepto: "Julio 2026",
    numero_recibo: "REC-2026-001",
    created_at: "2026-07-01T00:00:00.000Z",
    estado: "borrador",
    fecha_envio: null,
    descuento_puntual_pct: 0,
    descuento_puntual_nota: null,
    descuento_hermanos_pct: 0,
    familia: { nombre: "García", email: "familia@example.com", metodo_pago: "transferencia" },
    lineas: [{ nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 100, descuentos_recurrentes: [] }],
    total_bruto: 100,
    total_descuento: 0,
    total_neto: 100,
  };
}

function makeFakeApi({ reciboExistente = null, generarReciboId = "r-nuevo", regenerarReciboId = "r-regenerado" } = {}) {
  const llamadas = { fetchRecibo: [], generarReciboFamilia: [], regenerarRecibo: [] };
  return {
    llamadas,
    fetchRecibo: async (id) => { llamadas.fetchRecibo.push(id); return reciboExistente?.id === id ? reciboExistente : reciboFixture(id); },
    fetchTextosLegales: async () => [],
    generarReciboFamilia: async (args) => { llamadas.generarReciboFamilia.push(args); return { generados: 1, fallidos: 0, reciboId: generarReciboId }; },
    // El backend borra el recibo viejo y crea uno nuevo con id distinto —
    // ver POST /:id/regenerar en generar.routes.js, que ahora devuelve el
    // reciboId del recibo recién creado (antes solo devolvía `regenerado`).
    regenerarRecibo: async (id, confirmar) => { llamadas.regenerarRecibo.push({ id, confirmar }); return { regenerado: true, reciboId: regenerarReciboId }; },
    updateRecibo: async () => ({}),
    enviarRecibo: async () => ({}),
  };
}

export async function run({ test, assert }) {
  const { buildTabRecibo } = await import("../assets/academia/admin/js/sections/envioFamilias/tabRecibo.js");

  test("sin recibo -> muestra 'Generar recibo' (no llama a fetchRecibo al montar); al pulsarlo, llama a generarReciboFamilia y luego carga el recibo recién creado", async () => {
    const api = makeFakeApi({ generarReciboId: "r-nuevo" });
    const item = { familia_id: "f1", recibo: null };
    const wrap = buildTabRecibo(item, { mes: 7, anio: 2026, api, branding: {}, onCambio: () => {} });

    await esperar(10);
    assert.equal(api.llamadas.fetchRecibo.length, 0, "sin recibo, no debe llamar a fetchRecibo al montar");

    const generarBtn = [...wrap.querySelectorAll("button")].find((b) => b.textContent.includes("Generar recibo"));
    assert.ok(generarBtn, "debe mostrar el botón 'Generar recibo'");

    generarBtn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.generarReciboFamilia, [{ familia_id: "f1", mes: 7, anio: 2026 }]);
    assert.deepEqual(api.llamadas.fetchRecibo, ["r-nuevo"], "tras generar, debe cargar el recibo recién creado con su id");
  });

  test("con recibo existente -> carga directamente por fetchRecibo (nunca pasa por generarReciboFamilia); el botón Regenerar del editor llama a regenerarRecibo", async () => {
    const existente = reciboFixture("r-existente");
    const api = makeFakeApi({ reciboExistente: existente });
    const item = { familia_id: "f1", recibo: { id: "r-existente" } };
    const wrap = buildTabRecibo(item, { mes: 7, anio: 2026, api, branding: {}, onCambio: () => {} });

    await esperar(20);
    assert.deepEqual(api.llamadas.fetchRecibo, ["r-existente"]);
    assert.equal(api.llamadas.generarReciboFamilia.length, 0, "con recibo existente nunca debe llamar a generarReciboFamilia");

    const regenerarBtn = [...wrap.querySelectorAll("button")].find((b) => b.textContent.trim() === "Regenerar");
    assert.ok(regenerarBtn, "debe mostrar el botón 'Regenerar' del editor");

    regenerarBtn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.regenerarRecibo, [{ id: "r-existente", confirmar: false }]);
  });

  // Bug de producción: al regenerar, el backend borra el recibo viejo y crea
  // uno nuevo con id distinto (ver POST /:id/regenerar) — la vista debe
  // recargar por ese id nuevo, no por el viejo (que ya no existe y da 404
  // "recibo_not_found").
  test("tras regenerar un recibo existente, el fetchRecibo posterior usa el ID NUEVO devuelto por regenerar, no el viejo", async () => {
    const existente = reciboFixture("r-viejo");
    const api = makeFakeApi({ reciboExistente: existente, regenerarReciboId: "r-nuevo-tras-regenerar" });
    const item = { familia_id: "f1", recibo: { id: "r-viejo" } };
    const wrap = buildTabRecibo(item, { mes: 7, anio: 2026, api, branding: {}, onCambio: () => {} });

    await esperar(20);
    const regenerarBtn = [...wrap.querySelectorAll("button")].find((b) => b.textContent.trim() === "Regenerar");
    regenerarBtn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    const idsCargados = api.llamadas.fetchRecibo;
    assert.equal(idsCargados[idsCargados.length - 1], "r-nuevo-tras-regenerar", "tras regenerar debe recargar por el id nuevo, no por 'r-viejo'");
    assert.equal(idsCargados.includes("r-viejo") && idsCargados[idsCargados.length - 1] === "r-viejo", false, "nunca debe volver a pedir el id viejo tras regenerar con éxito");
  });
}
