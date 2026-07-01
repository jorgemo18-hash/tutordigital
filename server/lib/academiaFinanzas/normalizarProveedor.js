// Preposiciones/artículos que van en minúscula salvo que sean la primera
// palabra — ej. "Suministros de Oficina", no "Suministros De Oficina".
const CONECTORES = new Set(["de", "del", "la", "las", "los", "en", "y"]);

// Siglas de forma jurídica tipo "S.L.", "S.A.", "S.L.U." — un Title Case
// letra a letra las rompería ("S.L." -> "S.l."), así que se detectan y se
// dejan en mayúsculas tal cual.
const SIGLA_RE = /^[A-Za-z]{1,3}(\.[A-Za-z]{1,3})+\.?$/;

function capitalizarPalabra(palabra) {
  return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
}

// Normaliza un nombre de proveedor a Title Case: "SALVADOR SUMINISTROS DE
// OFICINA, S.L." -> "Salvador Suministros de Oficina, S.L.".
export function normalizarProveedor(nombre) {
  if (!nombre) return nombre;
  return nombre
    .trim()
    .split(/\s+/)
    .map((palabra, i) => {
      if (SIGLA_RE.test(palabra)) return palabra.toUpperCase();
      if (i > 0 && CONECTORES.has(palabra.toLowerCase())) return palabra.toLowerCase();
      return capitalizarPalabra(palabra);
    })
    .join(" ");
}
