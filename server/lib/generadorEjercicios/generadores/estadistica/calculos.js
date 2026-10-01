// LAS CUENTAS DEL TEMA DE ESTADÍSTICA, sueltas para poder probarlas y para
// que los generadores no las repitan. No es un generador (no está en el
// catálogo).

export const suma = (xs) => xs.reduce((s, x) => s + x, 0);
export const ordena = (xs) => [...xs].sort((a, b) => a - b);

export function mediana(xs) {
  const o = ordena(xs);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// La del medio de la lista TAL COMO VIENE (error 5).
export function medianaSinOrdenar(xs) {
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

// La moda si es única, con cuántas veces sale; si no, null.
export function modaUnica(xs) {
  const veces = new Map();
  for (const x of xs) veces.set(x, (veces.get(x) || 0) + 1);
  const max = Math.max(...veces.values());
  const modas = [...veces].filter(([, v]) => v === max).map(([x]) => x);
  return modas.length === 1 && max >= 2 ? { moda: modas[0], veces: max } : null;
}

// Reparte n en k partes de al menos `minimo`, con una sola parte máxima.
export function reparto(azar, n, k, minimo = 2) {
  const libre = n - k * (minimo - 1);
  if (libre < k) return null;
  for (let intento = 0; intento < 50; intento += 1) {
    const cortes = new Set();
    while (cortes.size < k - 1) cortes.add(azar.entero(1, libre - 1));
    const c = [0, ...[...cortes].sort((a, b) => a - b), libre];
    const partes = c.slice(1).map((x, i) => x - c[i] + minimo - 1);
    const max = Math.max(...partes);
    if (partes.filter((p) => p === max).length === 1) return partes;
  }
  return null;
}

