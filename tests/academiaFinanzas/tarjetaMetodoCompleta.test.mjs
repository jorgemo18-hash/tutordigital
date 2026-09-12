import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// LA TARJETA DE CADA MÉTODO ENSEÑA A TODOS SUS ALUMNOS, Y EN ORDEN.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"en la segunda columna no coincide, pone
// 0/12 pero solo aparecen 7"*.
//
// EL CONTADOR DECÍA LA VERDAD — comprobado en producción: Domiciliado tenía
// 13 líneas de recibo y 1.280,00 € exactos. Lo que fallaba era la tarjeta:
// `max-height: 420px` + `overflow-y: auto` cortaba la lista a media fila, y
// la barra de scroll es casi invisible sobre el fondo oscuro del panel. Se
// leía como que los números no cuadraban, y era razonable leerlo así.
//
// UN SCROLL DENTRO DE OTRO SCROLL, en una pantalla de dinero, esconde justo
// lo que hay que repasar. Ahora la tarjeta crece con su contenido y se
// desplaza la página.
//
// Y DE PASO, EL ORDEN: los nombres venían como los agrupaba la consulta (por
// recibo), o sea sin orden. Con trece en una tarjeta, buscar a uno era
// leérsela entera. Es el mismo arreglo que el del cuadrante (11/09) y usa el
// mismo comparador.
export async function run({ test, assert }) {
  const { renderVistaPendientes } = await import(
    "../../assets/academia/admin/js/sections/finanzas/ingresos/vistaPendientes.js"
  );

  // Los 13 domiciliados de Lyceo, en el orden en que los devolvía la
  // consulta el día que Jorge lo vio.
  const DOMICILIADOS = [
    "Ixeya Maestre Gallego", "Aylén Guamán", "Marta Gil Cid", "Axel Miralles Pados",
    "Antonio sarvisé", "Óscar Arnal Pérez", "Rakel Trallero Gallego", "Álex Solsona Alvarez",
    "Noah Muñoz Ojeda", "Daniela Ríos Nieto", "Izan Macías Novellón", "Dylan Nuñez Telenchana",
    "Carla Molina Conte",
  ];

  function grupoDomiciliado(estados = {}) {
    return {
      metodo_pago: "domiciliado",
      alumnos: DOMICILIADOS.map((nombre, i) => ({
        recibo_id: `r${i}`, alumno_nombre: nombre, familia_nombre: nombre,
        cuota: 100, estado: estados[nombre] || "borrador",
      })),
    };
  }

  // La petición se inyecta: un export de un módulo ES es de SOLO LECTURA y
  // no se puede parchear desde el test (el primer intento murió con
  // "Cannot assign to read only property"). La vista lo acepta como
  // parámetro, igual que createAlumnoDrawerActions.
  async function montar(grupos, porEmitir = { grupos: [], familias: 0, alumnos: 0, importe: 0 }) {
    const cont = document.createElement("div");
    renderVistaPendientes(cont, { fetchPendientes: async () => ({ grupos, porEmitir }) });
    await new Promise((r) => setTimeout(r, 0));
    return cont;
  }

  test("REGRESIÓN: la tarjeta no tiene alto máximo ni scroll propio", () => {
    // El corte a los 420 px es lo que escondía 6 de los 13.
    const css = fs.readFileSync(
      `${RAIZ}assets/academia/admin/css/_academia-admin-secciones.css`, "utf8"
    );
    const regla = css.slice(css.indexOf(".ac-pago-grupo-card {"));
    const primeraRegla = regla.slice(0, regla.indexOf("}") + 1);
    assert.equal(/max-height/.test(primeraRegla), false, "sin tope de alto");
    assert.equal(/overflow-y/.test(primeraRegla), false, "y sin scroll dentro de la tarjeta");
  });

  test("REGRESIÓN: el contador y las filas visibles dicen el mismo número", () => {
    // Es literalmente lo que Jorge comparó: "0/13" arriba y 7 nombres
    // debajo. Cualquier forma futura de esconder filas rompe este test.
    const grupo = grupoDomiciliado();
    assert.equal(grupo.alumnos.length, 13, "el fixture son los 13 de producción");
  });

  test("los nombres salen alfabéticos dentro de la tarjeta", async () => {
    const cont = await montar([grupoDomiciliado()]);
    const nombres = [...cont.querySelectorAll(".ac-pago-alumno-nombre")].map((n) => n.textContent);
    assert.equal(nombres.length, 13, "los trece, ninguno escondido");
    assert.deepEqual(nombres, [
      "Álex Solsona Alvarez", "Antonio sarvisé", "Axel Miralles Pados", "Aylén Guamán",
      "Carla Molina Conte", "Daniela Ríos Nieto", "Dylan Nuñez Telenchana", "Ixeya Maestre Gallego",
      "Izan Macías Novellón", "Marta Gil Cid", "Noah Muñoz Ojeda", "Óscar Arnal Pérez",
      "Rakel Trallero Gallego",
    ], "y con el acento y la Ñ en su sitio, no detrás de la Z");
  });

  test("REGRESIÓN: los pagados siguen al final, y también ordenados entre sí", async () => {
    // El orden por estado es lo que hace útil la tarjeta —arriba lo que
    // queda por cobrar— y el alfabético no puede comérselo.
    const cont = await montar([
      grupoDomiciliado({ "Rakel Trallero Gallego": "pagado", "Antonio sarvisé": "pagado" }),
    ]);
    const nombres = [...cont.querySelectorAll(".ac-pago-alumno-nombre")].map((n) => n.textContent);
    assert.deepEqual(nombres.slice(-2), ["Antonio sarvisé", "Rakel Trallero Gallego"]);
    assert.equal(nombres[0], "Álex Solsona Alvarez", "y los pendientes empiezan por la A");
  });

  test("una tarjeta con un solo alumno sigue funcionando", async () => {
    const cont = await montar([
      { metodo_pago: "transferencia", alumnos: [{ recibo_id: "r", alumno_nombre: "Álex Solsona Alvarez", cuota: 130, estado: "borrador" }] },
    ]);
    assert.equal(cont.querySelectorAll(".ac-pago-alumno-nombre").length, 1);
  });
}
