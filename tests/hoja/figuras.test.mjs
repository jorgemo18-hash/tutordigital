import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// LAS FIGURAS DIBUJADAS POR CÓDIGO (assets/shared/hoja/js/figuras/).
//
// happy-dom no maqueta: lo que se ve se comprobó imprimiendo. Aquí se prueba
// lo que no depende de la vista: que el dibujo respeta las PROPORCIONES y la
// ESCALA del dato (un rectángulo de 7 × 4 no sale cuadrado; un ángulo de 40°
// a escala real mide 40°), que las barras miden lo que valen, y que un dato
// malo no produce un dibujo roto sino ninguno.
export async function run({ test, assert }) {
  const { buildFigura, TIPOS_DE_FIGURA } = await import("../../assets/shared/hoja/js/figuras/index.js");
  const { transformacion, CAJA } = await import("../../assets/shared/hoja/js/figuras/geometria.js");
  const { buildActividad } = await import("../../assets/shared/hoja/js/actividades.js");
  const doc = window.document;
  const num = (n, a) => Number(n.getAttribute(a));
  const puntos = (poly) => poly.getAttribute("points").split(" ").map((p) => p.split(",").map(Number));

  test("figuras/el registro conoce los cinco tipos y un tipo desconocido no dibuja nada", () => {
    assert.deepEqual([...TIPOS_DE_FIGURA].sort(), ["barras", "ejes", "geometria", "recta", "sectores"]);
    assert.equal(buildFigura({ tipo: "hexagrama" }, doc), null);
    assert.equal(buildFigura(null, doc), null);
  });

  test("geometría/un rectángulo de 7 × 4 conserva la proporción y cabe en la caja", () => {
    const svg = buildFigura({ tipo: "geometria", elementos: [{ poligono: [[0, 0], [7, 0], [7, 4], [0, 4]] }] }, doc);
    const [p0, p1, p2] = puntos(svg.querySelector("polygon"));
    const ancho = Math.abs(p1[0] - p0[0]);
    const alto = Math.abs(p2[1] - p1[1]);
    assert.ok(Math.abs(ancho / alto - 7 / 4) < 0.01, `${ancho} × ${alto}`);
    const vb = svg.getAttribute("viewBox").split(" ").map(Number);
    assert.ok(vb[2] <= CAJA.ancho + 0.01 && vb[3] <= CAJA.alto + 0.01);
  });

  test("geometría/el alto de la figura no depende de su forma (la paginación lo necesita)", () => {
    const alto = (v) => Number(buildFigura({ tipo: "geometria", elementos: [{ poligono: v }] }, doc).getAttribute("viewBox").split(" ")[3]);
    assert.equal(alto([[0, 0], [10, 0], [5, 9]]), alto([[0, 0], [10, 0], [5, 1]]));
    const real = (g) => Number(buildFigura({ tipo: "geometria", escala: "real", altoMinimo: 28, elementos: [{ segmento: [[0, 0], [28, 0]] }, { segmento: [[0, 0], [28 * Math.cos(g), 28 * Math.sin(g)]] }] }, doc).getAttribute("viewBox").split(" ")[3]);
    assert.equal(real(0.3), real(1.2));
  });

  test("geometría/el eje y del dato va hacia ARRIBA: el vértice (0, 4) queda más alto que el (0, 0)", () => {
    const { f } = transformacion({ elementos: [{ poligono: [[0, 0], [7, 0], [0, 4]] }] });
    assert.ok(f([0, 4])[1] < f([0, 0])[1]);
  });

  test("geometría/con escala real, 1 unidad es 1 mm: un ángulo de 40° mide 40° en el papel", () => {
    const r = (g) => (g * Math.PI) / 180;
    const fig = { tipo: "geometria", escala: "real", elementos: [{ segmento: [[0, 0], [30, 0]] }, { segmento: [[0, 0], [30 * Math.cos(r(40)), 30 * Math.sin(r(40))]] }] };
    const [a, b] = [...buildFigura(fig, doc).querySelectorAll("line")];
    const largo = Math.hypot(num(a, "x2") - num(a, "x1"), num(a, "y2") - num(a, "y1"));
    assert.ok(Math.abs(largo - 30) < 0.02, `el lado mide ${largo} mm`);
    const ang = Math.atan2(num(b, "y1") - num(b, "y2"), num(b, "x2") - num(b, "x1")) * (180 / Math.PI);
    assert.ok(Math.abs(ang - 40) < 0.1, `mide ${ang}°`);
  });

  test("geometría/un elemento con datos malos anula la figura entera", () => {
    assert.equal(buildFigura({ tipo: "geometria", elementos: [{ poligono: [[0, 0], [1, 0]] }] }, doc), null);
    assert.equal(buildFigura({ tipo: "geometria", elementos: [{ poligono: [[0, 0], [1, 0], [0, 1]] }, { cota: { de: [0, 0], a: [1, "x"], texto: "1" } }] }, doc), null);
    assert.equal(buildFigura({ tipo: "geometria", elementos: [] }, doc), null);
    assert.equal(buildFigura({ tipo: "geometria", elementos: [{ circulo: { centro: [0, 0], radio: -2 } }] }, doc), null);
  });

  test("geometría/la cota lleva su texto y el ángulo recto el cuadradito", () => {
    const svg = buildFigura({ tipo: "geometria", elementos: [
      { poligono: [[0, 0], [8, 0], [3, 5]] },
      { cota: { de: [0, 0], a: [8, 0], texto: "8 cm", lado: -1 } },
      { angulo: { vertice: [3, 0], desde: [8, 0], hasta: [3, 5], recto: true } },
    ] }, doc);
    assert.equal(svg.querySelector(".hj-geo-cota text").textContent, "8 cm");
    assert.ok(svg.querySelector(".hj-geo-angulo polyline"));
  });

  test("ejes/una marca de cuadrícula cada paso, a 5 mm (el cuadro del cuaderno)", () => {
    const svg = buildFigura({ tipo: "ejes", x: [-5, 5], y: [-4, 4], puntos: [{ x: 2, y: 3, etiqueta: "A" }] }, doc);
    const verticales = [...svg.querySelectorAll(".hj-ejes-cuadricula")].filter((l) => l.getAttribute("x1") === l.getAttribute("x2"));
    assert.equal(verticales.length, 11);
    const xs = verticales.map((l) => num(l, "x1")).sort((a, b) => a - b);
    assert.ok(xs.slice(1).every((x, i) => Math.abs(x - xs[i] - 5) < 0.02));
    // El punto (2, 3): 2 cuadros a la derecha del eje y, 3 por encima del x.
    const p = svg.querySelector(".hj-ejes-punto");
    const ejeX = [...svg.querySelectorAll(".hj-ejes-eje")][0];
    const ejeY = [...svg.querySelectorAll(".hj-ejes-eje")][1];
    assert.ok(Math.abs(num(p, "cx") - num(ejeY, "x1") - 10) < 0.02);
    assert.ok(Math.abs(num(ejeX, "y1") - num(p, "cy") - 15) < 0.02);
  });

  test("ejes/'vacia' dibuja la cuadrícula sin los puntos (para que los sitúe el alumno)", () => {
    const svg = buildFigura({ tipo: "ejes", x: [-3, 3], y: [-3, 3], vacia: true, puntos: [{ x: 1, y: 1 }] }, doc);
    assert.equal(svg.querySelectorAll(".hj-ejes-punto").length, 0);
  });

  test("ejes/un rango que no encaja con el paso o demasiados pasos no dibujan nada", () => {
    assert.equal(buildFigura({ tipo: "ejes", x: [0, 5], y: [0, 7], pasoY: 2 }, doc), null);
    assert.equal(buildFigura({ tipo: "ejes", x: [0, 50], y: [0, 5] }, doc), null);
  });

  test("barras/la altura de cada barra es proporcional a su valor", () => {
    const svg = buildFigura({ tipo: "barras", categorias: ["A", "B", "C"], valores: [8, 4, 6], paso: 2 }, doc);
    const h = [...svg.querySelectorAll(".hj-barras-barra")].map((r) => num(r, "height"));
    assert.ok(Math.abs(h[0] / h[1] - 2) < 0.01 && Math.abs(h[2] / h[1] - 1.5) < 0.01, h.join(", "));
  });

  test("barras/los nombres largos ensanchan las barras en vez de pisarse", () => {
    const corto = buildFigura({ tipo: "barras", categorias: ["A", "B"], valores: [1, 2] }, doc);
    const largo = buildFigura({ tipo: "barras", categorias: ["Baloncesto", "Natación"], valores: [1, 2] }, doc);
    const ancho = (s) => Number(s.getAttribute("viewBox").split(" ")[2]);
    assert.ok(ancho(largo) > ancho(corto) + 10);
  });

  test("sectores/un radio por parte y cada una con su nombre (fuera, que en fotocopia no hay colores)", () => {
    const svg = buildFigura({ tipo: "sectores", partes: [{ etiqueta: "A", valor: 1 }, { etiqueta: "B", valor: 3 }] }, doc);
    assert.equal(svg.querySelectorAll(".hj-sectores-radio").length, 2);
    assert.deepEqual([...svg.querySelectorAll("text")].map((t) => t.textContent), ["A", "B"]);
    assert.equal(buildFigura({ tipo: "sectores", partes: [{ etiqueta: "A", valor: 0 }, { etiqueta: "B", valor: 3 }] }, doc), null);
  });

  test("la actividad pinta cualquier figura del registro debajo del apartado", () => {
    const act = buildActividad({ enunciado: "Calcula", apartados: [{ texto: "Área = ___", figura: { tipo: "geometria", elementos: [{ poligono: [[0, 0], [2, 0], [0, 2]] }] } }] }, 1, doc);
    assert.ok(act.querySelector(".hj-apartado--figura svg.hj-geo"));
  });
}
