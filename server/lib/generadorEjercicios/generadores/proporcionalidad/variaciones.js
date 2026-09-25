import { reuneApartados } from "../../ejercicio.js";
import { mcd } from "../fracciones/fraccion.js";
import { euros } from "./numeros.js";

// PROPORCIONALIDAD, OBJETIVO 4: AUMENTOS Y DISMINUCIONES PORCENTUALES
// (concepto 7). Saber A.5: «… aumentos y disminuciones porcentuales, rebajas
// y subidas de precios, impuestos…».
//
// LOS PRECIOS VAN EN CÉNTIMOS (numeros.js): el 21 % de 37 € es 7,77 €, y
// así se escribe, sin redondeos.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   8 en una rebaja, contestar el DESCUENTO en vez de lo que se paga;
//   9 en una subida, sumar el porcentaje como si fueran euros
//     (80 € + 21 % → 101 €);
//  10 en "cuánto costaba antes", aplicar el porcentaje al precio de
//     después (pagué 60 € con un 25 % de rebaja → 60 + 15 = 75 €, y era 80).

// Con su número, para que concuerde el verbo ("unas zapatillas… tienen").
const ARTICULOS = [
  ["Una chaqueta", false], ["Unas zapatillas", true], ["Un videojuego", false], ["Una mochila", false],
  ["Unos auriculares", true], ["Una sudadera", false], ["Un reloj", false],
];
const verbo = (plural, singular, enPlural) => (plural ? enPlural : singular);

function porciento(centimos, p) {
  // El p % de un precio en céntimos, que tiene que salir exacto.
  const r = (centimos * p) / 100;
  return Number.isInteger(r) ? r : null;
}

// ── "Precio con rebaja" (dificultad 2) ──────────────────────────────────
export function rebajaPrecioFinal(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(ARTICULOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const [articulo, plural] = plan[i % plan.length];
    i += 1;
    const p = azar.elige([10, 20, 25, 50, 15, 30, 40, 5]);
    const precio = 100 * azar.entero(8, 120);
    const descuento = porciento(precio, p);
    if (descuento === null) return null;
    const final = precio - descuento;
    const enunciado = `${articulo} de ${euros(precio)} ${verbo(plural, "tiene", "tienen")} un ${p} % de descuento. ¿Cuánto se paga?`;
    return {
      latex: `${enunciado} ___`,
      latexResuelto: `${enunciado} ${euros(final)}.`,
      texto: `${enunciado} ___`,
      solucion: euros(final),
      articulo,
      soloDescuento: euros(descuento),
      razon: `El descuento es el ${p} % de ${euros(precio)}: ${euros(descuento)}. Se paga ${euros(precio)} − ${euros(descuento)} = ${euros(final)} `
        + `(o, directamente, el ${100 - p} % del precio).`,
    };
  }, { cuantos, clave: (a) => a.articulo });

  return {
    clave: "rebaja_precio_final",
    arquetipo: "Calcula el precio después de una rebaja",
    enunciado: "Calcula lo que se paga:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const SUBIDAS = [
  { id: "iva", crea: (azar) => ({ precio: 100 * azar.entero(10, 90), p: 21, frase: (pr) => `Un patinete cuesta ${pr} sin IVA. Con el IVA del 21 %, ¿cuánto cuesta?` }) },
  { id: "iva10", crea: (azar) => ({ precio: 100 * azar.entero(20, 90), p: 10, frase: (pr) => `La cena de un restaurante son ${pr} más un 10 % de IVA. ¿Cuánto se paga?` }) },
  { id: "alquiler", crea: (azar) => ({ precio: 5000 * azar.entero(8, 18), p: azar.elige([2, 3, 4, 5]), frase: (pr, p) => `Un alquiler de ${pr} al mes sube un ${p} %. ¿Cuánto se paga ahora?` }) },
  { id: "abono", crea: (azar) => ({ precio: 100 * azar.entero(20, 60), p: azar.elige([10, 20, 5]), frase: (pr, p) => `Un abono de transporte de ${pr} sube un ${p} %. ¿Cuánto cuesta ahora?` }) },
  { id: "entrada", crea: (azar) => ({ precio: 100 * azar.entero(20, 80), p: azar.elige([10, 20, 25, 50]), frase: (pr, p) => `La entrada de un concierto costaba ${pr} y ha subido un ${p} %. ¿Cuánto cuesta ahora?` }) },
];

// ── "Subidas e impuestos" (dificultad 2) ────────────────────────────────
export function subidaEImpuestos(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(SUBIDAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const { precio, p, frase } = ctx.crea(azar);
    const aumento = porciento(precio, p);
    if (aumento === null) return null;
    const final = precio + aumento;
    const enunciado = frase(euros(precio), p);
    return {
      latex: `${enunciado} ___`,
      latexResuelto: `${enunciado} ${euros(final)}.`,
      texto: `${enunciado} ___`,
      solucion: euros(final),
      contexto: ctx.id,
      comoEuros: euros(precio + 100 * p),
      razon: `El aumento es el ${p} % de ${euros(precio)}: ${euros(aumento)}. Ahora: ${euros(precio)} + ${euros(aumento)} = ${euros(final)}.`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "subida_e_impuestos",
    arquetipo: "Calcula el precio después de una subida o con impuestos",
    enunciado: "Calcula el precio final:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "¿Cuánto costaba antes?" (dificultad 3) ─────────────────────────────
// Lo que se paga es el (100 − p) % del precio de antes (o el (100 + p) %
// con el IVA): el 1 % sale dividiendo y el 100 % multiplicando.
export function precioAntes(azar, { cuantos = 3 } = {}) {
  // Un artículo distinto en cada apartado.
  const articulos = azar.mezcla(ARTICULOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const conIva = i % 3 === 2;
    i += 1;
    const p = conIva ? 21 : azar.elige([10, 20, 25, 50, 40, 30]);
    // En euros enteros, múltiplo de 100 / mcd(p, 100) para que el descuento
    // también lo sea (60 € con un 25 %: 15 €).
    const paso = conIva ? 100 : 100 / mcd(p, 100);
    const antes = 100 * paso * azar.entero(conIva ? 1 : Math.ceil(10 / paso), conIva ? 9 : Math.floor(150 / paso));
    const cambio = porciento(antes, p);
    if (cambio === null) return null;
    const ahora = conIva ? antes + cambio : antes - cambio;
    const queda = conIva ? 100 + p : 100 - p;
    const art = articulos[i % articulos.length];
    const enunciado = conIva
      ? `Una factura con el 21 % de IVA incluido es de ${euros(ahora)}. ¿Cuánto era sin IVA?`
      : `Con un ${p} % de rebaja, ${art[0].toLowerCase()} me ${verbo(art[1], "ha", "han")} costado ${euros(ahora)}. ¿Cuánto ${verbo(art[1], "costaba", "costaban")} antes?`;
    // Error 10: el porcentaje sobre el precio de AHORA.
    const sobreAhora = porciento(ahora, p);
    return {
      latex: `${enunciado} ___`,
      latexResuelto: `${enunciado} ${euros(antes)}.`,
      texto: `${enunciado} ___`,
      solucion: euros(antes),
      conError10: sobreAhora === null ? null : euros(conIva ? ahora - sobreAhora : ahora + sobreAhora),
      razon: `${euros(ahora)} es el ${queda} % del precio de antes. El 1 %: ${euros(ahora)} : ${queda} = ${euros(ahora / queda)}; el 100 %: ${euros(ahora / queda)} · 100 = ${euros(antes)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "precio_antes",
    arquetipo: "Calcula el precio antes de la rebaja o sin impuestos",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
