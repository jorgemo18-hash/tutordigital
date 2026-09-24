import { frac, mcd, simplifica, textoTalCual } from "../generadores/fracciones/fraccion.js";

// LAS RESPUESTAS-TRAMPA DEL TEMA FRACCIONES (migración 137). Mismo contrato
// que las demás (trampasDelApartado.js); los números son los de ESTE tema.
//
// Cuando el alumno con un error llega a una fracción, se apunta TAL CUAL la
// escribiría sin simplificar ("2/5", "6/8"): es lo que aparecerá en su
// papel, y simplificarla aquí haría que no coincidiera.
export const ERRORES_FRACCIONES = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000401", categoria: "procedimiento", corto: "Suma numeradores y denominadores" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000402", categoria: "procedimiento", corto: "Denominador común sin cambiar los numeradores" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000403", categoria: "procedimiento", corto: "No simplifica el resultado" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000404", categoria: "procedimiento", corto: "Suma el entero al numerador" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000405", categoria: "procedimiento", corto: "Multiplica en cruz" },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000406", categoria: "procedimiento", corto: "Divide sin invertir" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000407", categoria: "procedimiento", corto: "Invierte la primera al dividir" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000408", categoria: "conceptual", corto: "Más denominador, más fracción" },
  { numero: 9, id: "c2000000-0000-4000-8000-000000000409", categoria: "procedimiento", corto: "Fracción de una cantidad al revés" },
  { numero: 10, id: "c2000000-0000-4000-8000-000000000410", categoria: "conceptual", corto: "Equivalentes sumando" },
  { numero: 11, id: "c2000000-0000-4000-8000-000000000411", categoria: "procedimiento", corto: "Simplifica solo una vez" },
  { numero: 12, id: "c2000000-0000-4000-8000-000000000412", categoria: "jerarquia", corto: "Opera sin jerarquía" },
  { numero: 13, id: "c2000000-0000-4000-8000-000000000413", categoria: "interpretacion", corto: "Da lo gastado en vez de lo que queda" },
];

const MENOS = (x, y) => x - y;
const MAS = (x, y) => x + y;
const operacion = (op) => (op === "-" ? MENOS : MAS);

// La fracción sin simplificar, si simplificar la cambia (si no, el error 3
// no deja rastro y no se apunta).
function sinSimplificar(bruto) {
  const s = simplifica(bruto);
  return s.n === bruto.n && s.d === bruto.d ? null : textoTalCual(bruto);
}

// Error 11: dividir una sola vez, por el primo más pequeño que tienen en común.
function simplificadaUnaVez({ n, d }) {
  for (let p = 2; p <= Math.min(n, d); p += 1) {
    if (n % p === 0 && d % p === 0) {
      const una = frac(n / p, d / p);
      return mcd(una.n, una.d) === 1 ? null : textoTalCual(una);
    }
  }
  return null;
}

function sumaConError1({ a, b, op }) {
  const n = operacion(op)(a.n, b.n);
  const d = a.d + b.d;
  return n > 0 ? `${n}/${d}` : null;
}

function sumaConError2({ a, b, op }) {
  if (a.d === b.d) return null;
  const m = (a.d * b.d) / mcd(a.d, b.d);
  const n = operacion(op)(a.n, b.n);
  return n > 0 ? `${n}/${m}` : null;
}

export const TRAMPAS_FRACCIONES = {
  suma_mismo_denominador: (a) => [
    { error: 1, respuesta: sumaConError1(a) },
    { error: 3, respuesta: sinSimplificar(a.bruto) },
  ],
  suma_distinto_denominador: (a) => [
    { error: 1, respuesta: sumaConError1(a) },
    { error: 2, respuesta: sumaConError2(a) },
    { error: 3, respuesta: sinSimplificar(a.bruto) },
  ],
  entero_y_fraccion: (a) => [{ error: 4, respuesta: `${operacion(a.op)(a.entero, a.f.n)}/${a.f.d}` }],
  multiplica_fracciones: (a) => [
    { error: 5, respuesta: `${a.a.n * a.b.d}/${a.a.d * a.b.n}` },
    { error: 3, respuesta: sinSimplificar(frac(a.a.n * a.b.n, a.a.d * a.b.d)) },
  ],
  divide_fracciones: (a) => [
    { error: 6, respuesta: `${a.a.n * a.b.n}/${a.a.d * a.b.d}` },
    { error: 7, respuesta: `${a.a.d * a.b.n}/${a.a.n * a.b.d}` },
    { error: 3, respuesta: sinSimplificar(frac(a.a.n * a.b.d, a.a.d * a.b.n)) },
  ],
  fraccion_de_fraccion: (a) => [{ error: 3, respuesta: sinSimplificar(frac(a.a.n * a.b.n, a.a.d * a.b.d)) }],
  // Con el mismo numerador, el del error 8 elige la de mayor denominador.
  compara_fracciones: (a) => {
    if (a.tipoDePareja !== "mismo_numerador") return [];
    const [x, y] = a.pareja;
    const signo = { "-1": "<", 0: "=", 1: ">" }[Math.sign(x.d - y.d)];
    return [{ error: 8, respuesta: signo }];
  },
  fraccion_de_cantidad: (a) => {
    const alReves = (a.cantidad / a.fraccion.n) * a.fraccion.d;
    return [{ error: 9, respuesta: Number.isInteger(alReves) ? alReves : null }];
  },
  equivalente_que_falta: (a) => [{ error: 10, respuesta: a.conSuma > 0 ? a.conSuma : null }],
  son_equivalentes: () => [{ error: 10, respuesta: "sí" }],
  simplifica_fraccion: (a) => [{ error: 11, respuesta: simplificadaUnaVez(a.grande) }],
  combinada_fracciones: (a) => [{ error: 12, respuesta: a.sinJerarquia }],
  problemas_lo_que_queda: (a) => [{ error: 13, respuesta: a.otra }],
};
