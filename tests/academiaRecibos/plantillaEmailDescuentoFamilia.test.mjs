// buildReciboHtml() devuelve un string — se puede testear con asserts de
// texto plano, sin DOM. Cubre que el descuento puntual (familia) se pinta
// FUERA del <tbody> de alumnos, y que la línea agregada "Descuentos" ya no
// incluye el importe puntual (antes lo contaba dos veces: una vez dentro
// de esa agregada, otra en la nueva línea "Descuento familia").

export async function run({ test, assert }) {
  const { buildReciboHtml } = await import("../../server/lib/academiaRecibos/plantillaEmail.js");

  const recibo = {
    mes: 7,
    anio: 2026,
    concepto: "Julio 2026",
    numero_recibo: "REC-2026-001",
    created_at: "2026-07-01T00:00:00.000Z",
    estado: "borrador",
    fecha_envio: null,
    descuento_hermanos_pct: 10,
    descuento_puntual_pct: 5,
    descuento_puntual_nota: "Beca ayuntamiento",
    total_bruto: 300,
    total_descuento: 65, // 30 (hermanos) + 15 (puntual) + 20 (recurrente)
    total_neto: 235,
  };
  const familia = { nombre: "García", metodo_pago: "transferencia" };
  const lineas = [
    { nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 150, descuentos_recurrentes: [] },
    { nombre_alumno: "Luis", descripcion: "Julio 2026", precio_bruto: 150, descuentos_recurrentes: [] },
  ];

  function render() {
    return buildReciboHtml({ recibo, familia, lineas, config: {}, tenantNombre: "Academia Test", textosLopd: [], textosExencion: [] });
  }

  test("la línea del descuento puntual aparece DESPUÉS de </tbody>, no dentro de la tabla de alumnos", () => {
    const html = render();
    const finTbody = html.indexOf("</tbody>");
    const lineaFamilia = html.indexOf("Descuento familia");
    assert.ok(finTbody > 0 && lineaFamilia > 0, "ambos deben existir en el HTML");
    assert.ok(lineaFamilia > finTbody, "la línea de familia debe ir después del cierre de la tabla de alumnos");
  });

  test("la etiqueta incluye la nota del descuento puntual", () => {
    const html = render();
    assert.equal(html.includes("Descuento familia — Beca ayuntamiento"), true);
  });

  test("las tres líneas (Descuentos recurrentes / hermanos / familia) no se pisan — cada una con su propio importe, sin contar el puntual dos veces", () => {
    const html = render();
    assert.equal(html.includes("<div>Descuentos</div><div>-20.00 €</div>"), true, "recurrentes = 65 - 30 (hermanos) - 15 (puntual) = 20, no 35");
    assert.equal(html.includes("<div>Descuento hermanos 10%</div><div>-30.00 €</div>"), true);
    assert.equal(html.includes("Descuento familia — Beca ayuntamiento</div><div>-15.00 €</div>"), true);
  });

  test("con un solo alumno, el bloque Subtotal/Descuentos se omite pero el descuento puntual se sigue viendo", () => {
    const reciboSolo = { ...recibo, total_bruto: 150, total_descuento: 15, total_neto: 135, descuento_hermanos_pct: 0 };
    const html = buildReciboHtml({
      recibo: reciboSolo, familia,
      lineas: [{ nombre_alumno: "Ana", descripcion: "Julio 2026", precio_bruto: 150, descuentos_recurrentes: [] }],
      config: {}, tenantNombre: "Academia Test", textosLopd: [], textosExencion: [],
    });
    assert.equal(html.includes("Subtotal"), false);
    assert.equal(html.includes("Descuento familia"), true);
  });

  test("sin descuento puntual (pct=0), no aparece ninguna línea 'Descuento familia'", () => {
    const reciboSinPuntual = { ...recibo, descuento_puntual_pct: 0, descuento_puntual_nota: null, total_descuento: 50 };
    const html = buildReciboHtml({ recibo: reciboSinPuntual, familia, lineas, config: {}, tenantNombre: "Academia Test", textosLopd: [], textosExencion: [] });
    assert.equal(html.includes("Descuento familia"), false);
  });
}
