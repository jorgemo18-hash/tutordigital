import assert from "node:assert/strict";

// EL CUADRANTE SEMANAL EN PDF.
//
// POR QUÉ UN PDF Y NO Cmd+P (Jorge, 16/09/2026, después de tres intentos de
// que la impresión del navegador cupiera en un folio: *"no lo estamos
// consiguiendo, vamos a pensar por qué"*).
//
// Imprimiendo la página, el folio no es nuestro. Safari ignora `@page` —ni el
// tamaño ni los márgenes—, los pone la impresora, y la escala del diálogo
// cambia la geometría DESPUÉS de que la página haya medido. Elegir el tamaño
// de letra desde el navegador es un cálculo a ciegas sobre un papel que no se
// ve: salieron 4, luego 3, luego 2 folios según el ajuste. Aquí el reparto
// está escrito en puntos y la orientación viaja dentro del archivo.
//
// El mismo razonamiento estaba ya escrito en generarHojaFamilias.js. El
// criterio, para la próxima: si el documento TIENE que caer en el folio, se
// dibuja; si da igual que ocupe dos páginas, vale Cmd+P.
export async function run({ test }) {
  const { buildCuadrantePdfBuffer, textoFecha } =
    await import("../../server/lib/academiaCuadrante/generarCuadrante.js");
  const { construirPayloadCuadrante, diasDeConfig, tituloDelCuadrante, COLUMNAS_CONFIG } =
    await import("../../server/lib/academiaCuadrante/payloadCuadrante.js");

  const CONFIG = {
    franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60,
    dias_laborables: [1, 2, 3, 4, 5], max_alumnos_por_franja: 6,
  };
  const franja = (dia, ini, fin, nombre, extra = {}) => ({
    dia_semana: dia, hora_inicio: ini, hora_fin: fin, alumno: { nombre, curso: "3º ESO" }, ...extra,
  });
  // Un cuadrante como el de Lyceo: cinco días, cinco franjas, casillas de
  // hasta siete alumnos y varios "desde" de septiembre.
  const FRANJAS = [];
  const POR_HORA = { "15:30": 3, "16:30": 4, "17:30": 7, "18:30": 6, "19:30": 1 };
  const NOMBRES = "Alejandra,Antonio,Daniel,Enara,Ixeya,Noah,Rakel,Alex,Daniela,Jorge".split(",");
  for (const [hora, cuantos] of Object.entries(POR_HORA)) {
    const fin = `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:30`;
    for (let dia = 1; dia <= 5; dia += 1) {
      for (let i = 0; i < cuantos; i += 1) {
        FRANJAS.push(franja(dia, hora, fin, `${NOMBRES[i % NOMBRES.length]} Apellido${i}`,
          i === 0 ? { fecha_inicio: "2026-10-01" } : {}));
      }
    }
  }

  const payload = (extra = {}) => construirPayloadCuadrante({
    franjas: FRANJAS, config: CONFIG, centro: "Lyceo academia",
    titulo: "Horario semanal", hoyISO: "2026-09-16", ...extra,
  });

  // ── El PDF sale, y sale donde tiene que salir ────────────────────────

  test("es un PDF de verdad, A4 y horizontal", async () => {
    const buffer = await buildCuadrantePdfBuffer(payload());
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    // A4 horizontal en puntos: 841.89 x 595.28. La orientación va DENTRO del
    // archivo, que es justo lo que Cmd+P no podía garantizar.
    const texto = buffer.toString("latin1");
    assert.match(texto, /\/MediaBox \[0 0 841\.89 595\.28\]/);
  });

  // LO QUE NO SE CONSEGUÍA CON EL NAVEGADOR: que quepa, siempre.
  test("un cuadrante como el de Lyceo cabe en UN folio", async () => {
    const buffer = await buildCuadrantePdfBuffer(payload());
    assert.equal((buffer.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length, 1);
  });

  test("los nombres y las horas están dentro del archivo", async () => {
    const datos = payload();
    assert.equal(datos.filas.length, 5);
    assert.deepEqual(datos.columnas.map((c) => c.name), ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
    assert.equal(datos.filas[0].hora, "15:30–16:30");
    assert.equal(datos.filas[0].celdas[0].dentro[0].nombre, "Alejandra");
    assert.ok(datos.filas[0].celdas[0].dentro[0].curso, "el curso tiene que llegar al papel");
  });

  // Un centro con doce franjas y seis días no cabe ni con la letra más
  // pequeña. NO se recorta: continúa en la página siguiente repitiendo la
  // cabecera, que es lo que la versión de navegador no podía hacer porque una
  // caja con scroll no se puede partir.
  test("un centro enorme pasa a la página siguiente en vez de perder filas", async () => {
    const enorme = construirPayloadCuadrante({
      franjas: FRANJAS,
      config: { ...CONFIG, franja_inicio: "08:00", franja_fin: "21:00", dias_laborables: [1, 2, 3, 4, 5, 6] },
      centro: "Centro grande", hoyISO: "2026-09-16",
    });
    assert.ok(enorme.filas.length >= 12, `esperaba muchas franjas, hay ${enorme.filas.length}`);
    const buffer = await buildCuadrantePdfBuffer(enorme);
    assert.ok((buffer.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length >= 1);
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  });

  test("un centro sin franjas configuradas no revienta: lo dice", async () => {
    const vacio = construirPayloadCuadrante({ franjas: [], config: {}, centro: "X" });
    const buffer = await buildCuadrantePdfBuffer(vacio);
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  });

  test("la fecha del pie va en español y sin depender de Intl", () => {
    // Intl falla en silencio bajo Node con small-icu (se cae a en-US), el
    // mismo motivo por el que el dinero se formatea a mano.
    assert.equal(textoFecha(new Date(2026, 8, 16)), "Impreso el 16 de septiembre de 2026");
  });

  // ── El payload ───────────────────────────────────────────────────────

  // El precedente es caro y real: a la hoja de familias le faltaban dos
  // columnas en el select y la rejilla salía impecable y VACÍA, sin un solo
  // error, porque `undefined` se lee como "no hay tope".
  test("REGRESIÓN: el select pide todo lo que lee el payload", async () => {
    const fs = await import("node:fs");
    const RAIZ = new URL("../../", import.meta.url).pathname;
    const fuente = fs.readFileSync(`${RAIZ}server/lib/academiaCuadrante/payloadCuadrante.js`, "utf8");
    const usadas = [...fuente.matchAll(/config\??\.([a-z_]+)/g)].map((m) => m[1]);
    // `bloquesDeConfig` lee las cuatro de apertura y la duración; el resto se
    // lee aquí directamente.
    const necesarias = new Set([...usadas, "franja_inicio", "franja_fin", "franja_inicio_2", "franja_fin_2", "franja_duracion"]);
    for (const columna of necesarias) {
      assert.ok(COLUMNAS_CONFIG.includes(columna), `falta ${columna} en el select`);
    }
  });

  test("sin días configurados se asume lunes a viernes, no un cuadrante sin columnas", () => {
    assert.deepEqual(diasDeConfig({}), [1, 2, 3, 4, 5]);
    assert.deepEqual(diasDeConfig({ dias_laborables: [] }), [1, 2, 3, 4, 5]);
    assert.deepEqual(diasDeConfig({ dias_laborables: [5, 1, 3] }), [1, 3, 5]);
  });

  // El título sale del rol y del ámbito, NUNCA de la URL: un papel que genera
  // el servidor no lleva texto que mande el cliente.
  test("el título lo decide el servidor, no el cliente", () => {
    assert.equal(tituloDelCuadrante({ role: "teacher" }), "Horario semanal · mis clases");
    assert.equal(tituloDelCuadrante({ role: "admin", ambitoProfesor: true }), "Horario semanal · mis clases");
    assert.equal(tituloDelCuadrante({ role: "admin" }), "Horario del centro");
  });

  test("el modo sin nombres no deja ni un nombre en el archivo", async () => {
    const datos = payload({ sinNombres: true });
    const celdas = datos.filas.flatMap((f) => f.celdas);
    assert.deepEqual(celdas.flatMap((c) => c.dentro), [], "ni un alumno en el modo sin nombres");
    assert.deepEqual(celdas.flatMap((c) => c.sueltas), []);
    const juntas = celdas.map((c) => c.texto).join(" ");
    assert.equal(/Alejandra|Antonio|Rakel/.test(juntas), false, juntas);
    assert.match(juntas, /plaza|Completo/);
  });

  // ── La ruta ──────────────────────────────────────────────────────────

  test("la ruta existe, exige sesión y no es 404", async () => {
    const { createApp } = await import("../../server/app.js");
    const app = await createApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/academia/documentos/cuadrante" });
    await app.close();
    assert.notEqual(res.statusCode, 404, "la ruta no está registrada en app.js");
    assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth, recibió ${res.statusCode}`);
  });

  // La regla de seguridad no se reimplementa aquí: se reusa la misma función
  // que la pantalla (`fetchFranjasVisibles`), donde vive el aislamiento entre
  // profesores. Una segunda consulta sería una segunda oportunidad de
  // equivocarse con datos de menores.
  test("REGRESIÓN: el PDF lee el horario con la MISMA función que la pantalla", async () => {
    const fs = await import("node:fs");
    const RAIZ = new URL("../../", import.meta.url).pathname;
    const ruta = fs.readFileSync(`${RAIZ}server/routes/v1/academia-documentos/cuadrante.routes.js`, "utf8");
    assert.match(ruta, /fetchFranjasVisibles/);
    assert.equal(
      /from\("academia_horario"\)/.test(ruta), false,
      "la ruta del PDF no debe consultar el horario por su cuenta"
    );
    assert.match(ruta, /roles: \["admin", "teacher"\]/);
  });
}
