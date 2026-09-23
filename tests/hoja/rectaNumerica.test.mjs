import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// EL DIBUJO DE LA RECTA (assets/shared/hoja/js/rectaNumerica.js).
//
// happy-dom no maqueta, así que lo que se ve se comprobó imprimiendo; aquí se
// prueba lo que no depende de la vista: cuántas marcas, dónde, qué se rotula
// y que un dato malo no produce un dibujo roto.
export async function run({ test, assert }) {
  const { buildRecta, marcasDe, escribeValor, MAX_MARCAS } = await import(
    "../../assets/shared/hoja/js/rectaNumerica.js"
  );
  const { buildActividad } = await import("../../assets/shared/hoja/js/actividades.js");
  const doc = window.document;
  const base = { tipo: "recta", desde: -10, hasta: 10, paso: 1, rotulos: [0, 1], puntos: [] };

  test("una recta de -10 a 10 de 1 en 1 tiene 21 marcas, a la misma distancia", () => {
    const svg = buildRecta(base, doc);
    const marcas = [...svg.querySelectorAll(".hj-recta-marca")].map((l) => Number(l.getAttribute("x1")));
    assert.equal(marcas.length, 21);
    const saltos = marcas.slice(1).map((x, i) => x - marcas[i]);
    assert.ok(saltos.every((d) => Math.abs(d - saltos[0]) < 0.02), "marcas desiguales");
  });

  test("EL 0 LLEVA LA MARCA MÁS LARGA", () => {
    const svg = buildRecta(base, doc);
    const alto = (l) => Number(l.getAttribute("y2")) - Number(l.getAttribute("y1"));
    const lineas = [...svg.querySelectorAll(".hj-recta-marca")];
    const delCero = lineas[10];
    assert.ok(lineas.every((l) => l === delCero || alto(l) < alto(delCero)));
  });

  test("solo se rotulan los números pedidos, con signo menos tipográfico", () => {
    const svg = buildRecta({ ...base, rotulos: [0, -5] }, doc);
    const rotulos = [...svg.querySelectorAll(".hj-recta-rotulo")].map((t) => t.textContent);
    assert.deepEqual(rotulos, ["0", "−5"]);
    assert.equal(escribeValor(-12), "−12");
  });

  test("los puntos llevan su letra; sin letra, su número", () => {
    const svg = buildRecta({ ...base, puntos: [{ valor: -3, etiqueta: "A" }, { valor: 4 }] }, doc);
    const etiquetas = [...svg.querySelectorAll(".hj-recta-etiqueta")].map((t) => t.textContent);
    assert.deepEqual(etiquetas, ["A", "4"]);
    assert.equal(svg.querySelectorAll(".hj-recta-punto").length, 2);
  });

  test("UN PUNTO QUE NO CAE EN UNA MARCA NO SE DIBUJA", () => {
    const svg = buildRecta({ ...base, paso: 2, puntos: [{ valor: 3 }, { valor: 4 }, { valor: 40 }] }, doc);
    assert.equal(svg.querySelectorAll(".hj-recta-punto").length, 1);
  });

  test("UN DATO MALO NO DA UN DIBUJO ROTO: no da dibujo", () => {
    assert.equal(buildRecta({ ...base, paso: 0 }, doc), null);
    assert.equal(buildRecta({ ...base, desde: 5, hasta: -5 }, doc), null);
    assert.equal(buildRecta({ ...base, hasta: "diez" }, doc), null);
    assert.equal(buildRecta({ ...base, desde: 0, hasta: MAX_MARCAS }, doc), null);
    assert.ok(marcasDe({ ...base, desde: 0, hasta: MAX_MARCAS - 1 }));
  });

  test("LA ETIQUETA ES TEXTO, NUNCA HTML", () => {
    const svg = buildRecta({ ...base, puntos: [{ valor: 2, etiqueta: "<b>x</b>" }] }, doc);
    assert.equal(svg.querySelector(".hj-recta-etiqueta").textContent, "<b>x</b>");
    assert.equal(svg.querySelector("b"), null);
  });

  test("un apartado con recta la pinta debajo del texto; el ejemplo, antes de la explicación", () => {
    const act = buildActividad({
      enunciado: "Representa:",
      apartados: [
        { texto: "$-3$", resuelto: true, explicacion: "Cada marca es 1.", figura: { ...base, puntos: [{ valor: -3 }] } },
        { texto: "$2$", figura: base },
        "sin figura",
      ],
    }, 1, doc);
    const [ejemplo, normal, sinFigura] = act.querySelectorAll(".hj-apartado");
    const hijos = [...ejemplo.querySelector(".hj-apartado-cuerpo").children].map((n) => n.getAttribute("class"));
    assert.deepEqual(hijos, ["hj-apartado-marca", "hj-recta", "hj-apartado-razon"]);
    assert.ok(normal.classList.contains("hj-apartado--figura"));
    assert.ok(normal.querySelector(".hj-recta"));
    assert.equal(sinFigura.querySelector(".hj-recta"), null);
  });
}
