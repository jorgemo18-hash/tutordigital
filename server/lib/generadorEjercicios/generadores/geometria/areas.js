import { reuneApartados } from "../../ejercicio.js";
import { poligonoConCotas } from "./figuras.js";

// GEOMETRÍA, OBJETIVO 4: PERÍMETROS Y ÁREAS DE POLÍGONOS (conceptos 4 y 5).
// Saber B.2: «Longitud de la circunferencia, áreas en figuras planas:
// deducción, interpretación y aplicación de fórmulas».
//
// LAS MEDIDAS SALEN EN LA FIGURA (cotas), no en el enunciado: leer la
// figura y decidir qué medida usar es parte del ejercicio. Por eso el
// triángulo y el romboide llevan también medido un LADO INCLINADO que no se
// usa: es el error 3.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 confundir perímetro y área;
//   2 olvidar dividir entre 2 (triángulo, rombo, trapecio);
//   3 usar el lado inclinado como altura.

const R = (n) => Math.round(n * 1000) / 1000;
// Mitades: el área de un triángulo o un rombo puede acabar en ,5.
const escribe = (n) => String(R(n)).replace(".", ",");

// ── "Perímetro y área del rectángulo y el cuadrado" (dificultad 1) ──────
export function perimetroYArea(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const cuadrado = azar.suerte(0.3);
    const b = azar.entero(3, 12);
    const h = cuadrado ? b : azar.entero(2, 9);
    if (!cuadrado && h === b) return null;
    const v = [[0, 0], [b, 0], [b, h], [0, h]];
    const P = 2 * (b + h);
    const A = b * h;
    return {
      latex: "Perímetro = ___ cm, área = ___ cm²",
      latexResuelto: `Perímetro = ${P} cm, área = ${A} cm²`,
      texto: `${cuadrado ? "Cuadrado" : "Rectángulo"} ${b} × ${h} → P = ___, A = ___`,
      solucion: [P, A],
      cambiados: [A, P],
      figura: poligonoConCotas(v, cuadrado ? [[0, `${b} cm`]] : [[0, `${b} cm`], [1, `${h} cm`]]),
      razon: `Perímetro: la suma de los lados, ${b} + ${h} + ${b} + ${h} = ${P} cm. Área: base por altura, ${b} · ${h} = ${A} cm².`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "perimetro_y_area",
    arquetipo: "Calcula el perímetro y el área de un rectángulo o un cuadrado",
    enunciado: "Calcula el perímetro y el área:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// ── "Área del triángulo" (dificultad 2) ─────────────────────────────────
// De 3 a 4, con la altura dibujada (discontinua, con su ángulo recto) y un
// lado inclinado también medido, que sobra.
export function areaTriangulo(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const b = azar.entero(4, 12);
    const h = azar.entero(3, 9);
    const pie = azar.entero(1, b - 1);
    // El lado inclinado de la izquierda, redondeado a entero para rotularlo
    // (es un dato que no se usa: no tiene que ser exacto, pero sí mayor
    // que la altura, como en la realidad).
    const lado = Math.round(Math.hypot(pie, h));
    if (lado <= h) return null;
    const v = [[0, 0], [b, 0], [pie, h]];
    const A = (b * h) / 2;
    return {
      latex: "Área = ___ cm²",
      latexResuelto: `Área = ${escribe(A)} cm²`,
      texto: `Triángulo b = ${b}, h = ${h}, lado ${lado} → A = ___`,
      solucion: escribe(A),
      sinMitad: escribe(b * h),
      conElLado: escribe((b * lado) / 2),
      figura: poligonoConCotas(v, [[0, `${b} cm`], [2, `${lado} cm`]], [
        { segmento: [[pie, 0], [pie, h]], discontinuo: true },
        { angulo: { vertice: [pie, 0], desde: [b, 0], hasta: [pie, h], recto: true } },
        { etiqueta: { en: [pie, h / 2], texto: `${h} cm`, ancla: "start" } },
      ]),
      razon: `Base por altura entre dos: ${b} · ${h} : 2 = ${escribe(A)} cm². La altura es la discontinua (${h} cm), no el lado inclinado.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "area_triangulo",
    arquetipo: "Calcula el área del triángulo con su altura",
    enunciado: "Calcula el área (la línea discontinua es la altura):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados,
  };
}

// ── "Áreas de romboides, rombos y trapecios" (dificultad 2) ─────────────
export function areaCuadrilateros(azar, { cuantos = 3 } = {}) {
  const FORMAS = ["romboide", "rombo", "trapecio"];
  const plan = [...azar.mezcla(FORMAS), ...azar.mezcla(FORMAS)];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const forma = plan[i % plan.length];
    i += 1;
    if (forma === "romboide") {
      const b = azar.entero(5, 12); const h = azar.entero(3, 7); const d = azar.entero(2, 4);
      const lado = Math.round(Math.hypot(d, h));
      const v = [[0, 0], [b, 0], [b + d, h], [d, h]];
      return {
        forma, latex: "Área = ___ cm²", latexResuelto: `Área = ${b * h} cm²`,
        texto: `Romboide b = ${b}, h = ${h}, lado ${lado} → A = ___`, solucion: String(b * h),
        conElLado: String(b * lado), sinMitad: null,
        figura: poligonoConCotas(v, [[0, `${b} cm`], [3, `${lado} cm`]], [
          { segmento: [[d, 0], [d, h]], discontinuo: true },
          { angulo: { vertice: [d, 0], desde: [b, 0], hasta: [d, h], recto: true } },
          { etiqueta: { en: [d, h / 2], texto: `${h} cm`, ancla: "start" } },
        ]),
        razon: `Como un rectángulo: base por altura, ${b} · ${h} = ${b * h} cm². La altura es la discontinua, no el lado inclinado.`,
      };
    }
    if (forma === "rombo") {
      const D = 2 * azar.entero(3, 7); const dd = 2 * azar.entero(2, 5);
      if (D === dd) return null;
      const v = [[0, dd / 2], [D / 2, 0], [D, dd / 2], [D / 2, dd]];
      return {
        forma, latex: "Área = ___ cm²", latexResuelto: `Área = ${(D * dd) / 2} cm²`,
        texto: `Rombo D = ${D}, d = ${dd} → A = ___`, solucion: String((D * dd) / 2),
        sinMitad: String(D * dd), conElLado: null,
        figura: { tipo: "geometria", descripcion: "Un rombo con sus diagonales", elementos: [
          { poligono: [v[1], v[2], v[3], v[0]] },
          { segmento: [v[0], v[2]], discontinuo: true }, { segmento: [v[1], v[3]], discontinuo: true },
          // Las diagonales, con cotas por fuera: rotuladas encima de las
          // líneas discontinuas se tachaban.
          { cota: { de: [0, 0], a: [D, 0], texto: `${D} cm`, lado: -1 } }, { cota: { de: [D, 0], a: [D, dd], texto: `${dd} cm`, lado: -1 } },
        ] },
        razon: `Diagonal mayor por diagonal menor entre dos: ${D} · ${dd} : 2 = ${(D * dd) / 2} cm².`,
      };
    }
    const B = azar.entero(7, 14); const b = azar.entero(3, B - 2); const h = azar.entero(3, 7);
    const x = azar.entero(1, B - b - 1 || 1);
    if (x + b >= B) return null;
    const v = [[0, 0], [B, 0], [x + b, h], [x, h]];
    const A = ((B + b) * h) / 2;
    return {
      forma, latex: "Área = ___ cm²", latexResuelto: `Área = ${escribe(A)} cm²`,
      texto: `Trapecio B = ${B}, b = ${b}, h = ${h} → A = ___`, solucion: escribe(A),
      sinMitad: escribe((B + b) * h), conElLado: null,
      figura: poligonoConCotas(v, [[0, `${B} cm`], [2, `${b} cm`]], [
        { segmento: [[x, 0], [x, h]], discontinuo: true },
        { angulo: { vertice: [x, 0], desde: [B, 0], hasta: [x, h], recto: true } },
        { etiqueta: { en: [x, h / 2], texto: `${h} cm`, ancla: "start" } },
      ]),
      razon: `(Base mayor + base menor) por altura entre dos: (${B} + ${b}) · ${h} : 2 = ${escribe(A)} cm².`,
    };
  }, { cuantos, clave: (a) => a.forma + a.texto });

  return {
    clave: "area_cuadrilateros",
    arquetipo: "Calcula el área de romboides, rombos y trapecios",
    enunciado: "Calcula el área:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados,
  };
}
