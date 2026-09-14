// EL CÓDIGO DE LA HOJA.
//
// Parece un detalle de imprenta y es LA PIEZA QUE UNE EL PAPEL CON LOS DATOS:
// cuando el profesor corrige una hoja en papel, teclea el código y ya sabemos
// qué ejercicio ocupaba cada hueco, de qué concepto era y con qué dificultad.
// Sin código hay que volver a teclear los enunciados, o sea: no se registra
// nada y no hay nada que medir.
//
// FORMA: H-AAMMDD-NN  →  "H-260914-03" (la tercera hoja del 14/09/2026).
//
// - Corto, porque hay que teclearlo o leerlo en voz alta.
// - Con la fecha dentro, porque así una hoja perdida en una mochila se sitúa
//   en el tiempo sin consultar nada.
// - El contador es por día, no global: un contador global obliga a coordinar
//   quién ha emitido la última hoja, y esto lo tiene que poder generar
//   cualquiera sin hablar con nadie.
//
// El número definitivo lo pondrá la base de datos cuando la hoja se guarde;
// esta función solo le da forma, y es la única que conoce el formato.

const PREFIJO = "H";

function dosDigitos(n) {
  return String(n).padStart(2, "0");
}

export function codigoDeHoja({ fecha = new Date(), secuencia = 1 } = {}) {
  const aa = dosDigitos(fecha.getFullYear() % 100);
  const mm = dosDigitos(fecha.getMonth() + 1);
  const dd = dosDigitos(fecha.getDate());
  return `${PREFIJO}-${aa}${mm}${dd}-${dosDigitos(secuencia)}`;
}

// Para el camino de vuelta: el profesor teclea el código y hay que saber de qué
// día es antes de buscar en la base de datos.
export function partesDelCodigo(codigo = "") {
  const m = /^H-(\d{2})(\d{2})(\d{2})-(\d{2,})$/.exec(String(codigo).trim().toUpperCase());
  if (!m) return null;
  return {
    anio: 2000 + Number(m[1]),
    mes: Number(m[2]),
    dia: Number(m[3]),
    secuencia: Number(m[4]),
  };
}
