// Validación de IBAN: el dígito de control (mod-97, ISO 13616) y la longitud
// que le corresponde al país.
//
// POR QUÉ EXISTE. El 11/09/2026 se comprobaron los 22 IBAN guardados de
// Lyceo, todos escritos a mano: CUATRO estaban mal. Tres por longitud (uno de
// 20 caracteres, dos de 22, cuando un IBAN español tiene 24) y uno con la
// longitud correcta y un dígito equivocado. Es un 18% de las
// domiciliaciones, y ninguno de los cuatro se puede cobrar: el banco los
// rechaza.
//
// Nadie se había enterado porque copiar 24 caracteres a mano falla EN
// SILENCIO: el campo era un texto libre y cualquier cosa se guardaba. El
// IBAN lleva su propio dígito de control precisamente para que una máquina
// pueda decir "esto está mal" antes de intentar cobrar, así que no usarlo
// era tirar la única red que el formato trae de serie.
//
// VIVE EN assets/shared PORQUE LA USAN LOS DOS LADOS: el formulario del
// drawer, para avisar mientras se escribe, y los esquemas del backend,
// porque la interfaz se puede saltar (un PATCH a mano no pasa por ella).
// Mismo patrón que horarioBloques.js o preciosPublicos.js, que el servidor
// también importa desde aquí. Duplicarla sería garantizar que algún día las
// dos copias validen cosas distintas — y en un campo donde "válido" decide
// si un recibo se cobra, eso es peor que no validar.

// Longitud oficial por país. No es la lista completa de los 80 y pico
// países: están España —el caso real— y los que puede traer una familia
// extranjera de la zona SEPA. Para un país que no esté en la tabla se
// acepta cualquier longitud entre 15 y 34 y decide el mod-97, que ya
// descarta la inmensa mayoría de los errores de copia.
const LARGO_POR_PAIS = {
  ES: 24, PT: 25, FR: 27, DE: 22, IT: 27, GB: 22, NL: 18,
  BE: 16, IE: 22, AT: 20, LU: 20, CH: 21, PL: 28, RO: 24,
  BG: 22, MA: 28, AD: 24,
};

// Quita espacios, guiones y puntos, y pasa a mayúsculas. Un IBAN se escribe
// en grupos de cuatro para leerlo, y la gente lo copia con los espacios.
export function normalizarIban(valor) {
  return String(valor ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
}

// Para enseñarlo: en grupos de cuatro, como en el papel del banco.
export function formatearIban(valor) {
  return normalizarIban(valor).replace(/(.{4})/g, "$1 ").trim();
}

// El resto de dividir por 97 tiene que ser 1 (ISO 13616). Se calcula a
// trozos porque el número entero tiene 30 y pico dígitos y no cabe en un
// Number sin perder precisión — con BigInt funcionaría, pero el troceado es
// el método clásico y no depende del tamaño.
function restoMod97(digitos) {
  let resto = 0;
  for (const ch of digitos) {
    resto = (resto * 10 + Number(ch)) % 97;
  }
  return resto;
}

// Devuelve el motivo por el que NO es válido, o "" si lo es. Se devuelve el
// motivo y no un booleano porque "IBAN incorrecto" no ayuda a nadie: saber
// que faltan dos caracteres, o que los que hay no cuadran entre sí, es la
// diferencia entre corregirlo y volver a escribirlo entero.
export function motivoIbanInvalido(valor) {
  const iban = normalizarIban(valor);
  if (!iban) return "";  // vacío no es inválido: es "todavía no lo tengo"

  // Los caracteres 3 y 4 son SIEMPRE los dos dígitos de control, nunca
  // letras. Exigirlo aquí no es cosmética: sin ello, un texto cualquiera
  // ("la cuenta del santander") llegaba hasta el mod-97 y el aviso salía
  // como "el dígito de control no cuadra", que no ayuda a nadie.
  if (!/^[A-Z]{2}\d{2}[0-9A-Z]+$/.test(iban)) {
    return "Un IBAN empieza por dos letras de país y dos dígitos de control (ES91…).";
  }

  const pais = iban.slice(0, 2);
  const largoEsperado = LARGO_POR_PAIS[pais];
  if (largoEsperado && iban.length !== largoEsperado) {
    const diferencia = largoEsperado - iban.length;
    const cuantos = Math.abs(diferencia);
    const cosa = cuantos === 1 ? "carácter" : "caracteres";
    const verbo = cuantos === 1 ? (diferencia > 0 ? "Falta" : "Sobra") : (diferencia > 0 ? "Faltan" : "Sobran");
    return `${verbo} ${cuantos} ${cosa}: un IBAN de ${pais} tiene ${largoEsperado}.`;
  }
  if (!largoEsperado && (iban.length < 15 || iban.length > 34)) {
    return "La longitud no corresponde a ningún IBAN.";
  }

  // Los cuatro primeros caracteres se mueven al final, las letras se
  // sustituyen por números (A=10 … Z=35) y el resultado tiene que dar
  // resto 1 al dividirlo por 97.
  const rotado = iban.slice(4) + iban.slice(0, 4);
  const digitos = [...rotado]
    .map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch))
    .join("");
  if (restoMod97(digitos) !== 1) {
    return "El dígito de control no cuadra: hay algún carácter equivocado.";
  }

  return "";
}

export function ibanValido(valor) {
  const iban = normalizarIban(valor);
  return Boolean(iban) && motivoIbanInvalido(iban) === "";
}
