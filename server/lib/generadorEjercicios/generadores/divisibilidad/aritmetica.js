// LA ARITMÉTICA DE LA DIVISIBILIDAD: divisores, primos, factores, m.c.d. y
// m.c.m. Exacta y sin opinión, como expresion.js para los enteros.
//
// Es lo que hace que las soluciones del tema no dependan de nadie: el
// generador elige los números y ESTE archivo dice cuál es la respuesta. La
// misma función que resuelve el ejercicio escribe después la explicación del
// ejemplo, así que la explicación no puede contradecir a la solución.
//
// Solo naturales positivos (el tema es de 1.º ESO y no toca negativos). Un
// número que no lo sea es un bug del generador y revienta.

function natural(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`se esperaba un natural positivo, llegó ${n}`);
  return n;
}

// Todos los divisores, de menor a mayor.
export function divisores(n) {
  natural(n);
  const bajos = [];
  const altos = [];
  for (let d = 1; d * d <= n; d += 1) {
    if (n % d === 0) {
      bajos.push(d);
      if (d * d !== n) altos.unshift(n / d);
    }
  }
  return [...bajos, ...altos];
}

// Las parejas de divisores (1·36, 2·18…): es como se buscan a mano y como
// se explica en el ejemplo.
export function parejasDeDivisores(n) {
  natural(n);
  const parejas = [];
  for (let d = 1; d * d <= n; d += 1) if (n % d === 0) parejas.push([d, n / d]);
  return parejas;
}

// El 1 no es primo ni compuesto: devuelve false, y quien necesite
// distinguirlo lo mira aparte.
export function esPrimo(n) {
  natural(n);
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
  return true;
}

export function primosEntre(a, b) {
  const lista = [];
  for (let n = Math.max(2, a + 1); n < b; n += 1) if (esPrimo(n)) lista.push(n);
  return lista;
}

// El divisor más pequeño distinto de 1: el que se escribe para demostrar
// que un número es compuesto.
export function menorDivisorPropio(n) {
  natural(n);
  for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return d;
  return null;
}

// Factores primos como [[base, exponente], …], de menor a mayor.
export function factoriza(n) {
  natural(n);
  const factores = [];
  let resto = n;
  for (let p = 2; p * p <= resto; p += 1) {
    let e = 0;
    while (resto % p === 0) { resto /= p; e += 1; }
    if (e) factores.push([p, e]);
  }
  if (resto > 1) factores.push([resto, 1]);
  return factores;
}

export function desdeFactores(factores) {
  return factores.reduce((acc, [p, e]) => acc * p ** e, 1);
}

// Cuántos factores primos, contando repetidos (360 = 2·2·2·3·3·5 → 6).
export function cuantosFactores(n) {
  return factoriza(n).reduce((s, [, e]) => s + e, 0);
}

// Las divisiones sucesivas, como se hacen en la columna: 360 : 2 = 180…
export function divisionesSucesivas(n) {
  const pasos = [];
  let resto = natural(n);
  for (const [p, e] of factoriza(n)) {
    for (let i = 0; i < e; i += 1) {
      pasos.push({ dividendo: resto, primo: p, cociente: resto / p });
      resto /= p;
    }
  }
  return pasos;
}

export function mcd(a, b) {
  natural(a); natural(b);
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x;
}

export function mcm(a, b) {
  return (a / mcd(a, b)) * b;
}

export const mcdDeVarios = (lista) => lista.reduce((g, n) => mcd(g, n));
export const mcmDeVarios = (lista) => lista.reduce((m, n) => mcm(m, n));

// Los factores comunes con su MENOR exponente (el m.c.d.) o todos con su
// MAYOR exponente (el m.c.m.), como se enseña en 1.º: con la
// descomposición delante. Devuelven la lista de factores, no el número, para
// poder escribir la explicación con ellos.
export function factoresDelMcd(lista) {
  const descompuestos = lista.map((n) => new Map(factoriza(n)));
  const [primero, ...resto] = descompuestos;
  return [...primero.entries()]
    .filter(([p]) => resto.every((m) => m.has(p)))
    .map(([p, e]) => [p, Math.min(e, ...resto.map((m) => m.get(p)))]);
}

export function factoresDelMcm(lista) {
  const exponentes = new Map();
  for (const n of lista) {
    for (const [p, e] of factoriza(n)) exponentes.set(p, Math.max(e, exponentes.get(p) || 0));
  }
  return [...exponentes.entries()].sort((x, y) => x[0] - y[0]);
}

// ── Cómo se escriben los factores ────────────────────────────────────────

// LaTeX: 2^{3} \cdot 3^{2} \cdot 5. El exponente 1 no se escribe.
export function factoresLatex(factores) {
  if (!factores.length) return "1";
  return factores.map(([p, e]) => (e === 1 ? String(p) : `${p}^{${e}}`)).join(" \\cdot ");
}

// Texto plano con superíndices: 2³ · 3² · 5. Es lo que va en la
// explicación del ejemplo, que la hoja escribe como texto.
const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const superindice = (e) => String(e).split("").map((c) => SUPER[c]).join("");

export function factoresTexto(factores) {
  if (!factores.length) return "1";
  return factores.map(([p, e]) => (e === 1 ? String(p) : `${p}${superindice(e)}`)).join(" · ");
}

export const sumaDeCifras = (n) => String(n).split("").reduce((s, c) => s + Number(c), 0);
