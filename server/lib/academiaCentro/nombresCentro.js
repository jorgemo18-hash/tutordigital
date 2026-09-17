// LOS DOS NOMBRES DE UN CENTRO, y cuál toca en cada sitio.
//
// Un centro puede tener dos nombres distintos:
//
//   - el FISCAL (`nombre_emisor`): la razón social, la que va junto al NIF.
//     "ACADEMIA RUIZ, S.L.". Es un dato tributario: en un recibo o una
//     factura tiene que aparecer este y no otro.
//
//   - el COMERCIAL (`nombre_comercial`): el nombre de marca, el que las
//     familias conocen. "Academia Ruiz". Es el que tiene sentido en la
//     bandeja de entrada de una madre, en un cartel o en una hoja
//     informativa — poner "S.L." ahí queda frío y, peor, irreconocible.
//
// Hasta la migración 121 esto era UNA sola columna haciendo los dos
// trabajos. Funcionaba porque el único centro real tenía el mismo nombre
// para las dos cosas. Este módulo existe para que la decisión de "aquí va
// el fiscal, aquí el comercial" se tome UNA vez y esté escrita en un sitio,
// en vez de repartida en quince `config.nombre_emisor || tenantNombre`.
//
// REGLA PARA QUIEN AÑADA UN CONSUMIDOR NUEVO:
//   ¿lo va a leer Hacienda o un banco?  ->  nombreFiscal()
//   ¿lo va a leer una familia?          ->  nombreComercial()
//
// El respaldo final es el nombre del tenant (lo que el centro escribió al
// darse de alta) y, si tampoco hay, cadena vacía. Quien necesite un texto
// por defecto lo pone él: aquí no se inventa un "TutorDigital", porque en
// la cabecera de una factura eso sería un dato falso, no un respaldo.

function primeroNoVacio(...valores) {
  for (const valor of valores) {
    const limpio = String(valor ?? "").trim();
    if (limpio) return limpio;
  }
  return "";
}

// `config`: fila de academia_config. `tenantNombre`: nombre del centro.
export function nombreFiscal(config = {}, tenantNombre = "") {
  return primeroNoVacio(config?.nombre_emisor, tenantNombre);
}

// El comercial CAE EN EL FISCAL cuando no hay uno propio, y no al revés:
// un centro que no rellena "nombre comercial" tiene que seguir viéndose
// exactamente como se veía antes de la migración 121. Esa es la razón de
// que aplicarla no cambie ni un email de los que ya salen.
export function nombreComercial(config = {}, tenantNombre = "") {
  return primeroNoVacio(config?.nombre_comercial, config?.nombre_emisor, tenantNombre);
}

// EL RÓTULO: el nombre grande de un papel que se da en mano (la hoja para
// familias). Es el comercial, y se diferencia de nombreComercial() en UNA
// cosa: cuando el centro no ha rellenado el nombre comercial, prefiere el
// nombre del tenant antes que el fiscal.
//
// Por qué existe esta rareza, que es puro legado y conviene que se lea aquí
// y no repartida por el código: antes de la migración 121 no había columna
// de nombre comercial, así que cada consumidor eligió su propio sustituto.
// El remitente de los emails cogió el fiscal ("Lyceo academia") y la hoja
// para familias cogió el del tenant ("Lyceo"), porque en un autónomo
// `nombre_emisor` es el nombre de la PERSONA y no lo que pone en la puerta.
// Las dos elecciones están hoy en producción y las dos son las que Jorge ha
// visto y dado por buenas, así que ninguna se cambia por pulcritud: lo que
// se hace es poner el campo nuevo DELANTE de las dos.
//
// En cuanto un centro rellena "nombre comercial", esta función y
// nombreComercial() devuelven lo mismo y la rareza desaparece.
export function rotuloCentro(config = {}, tenantNombre = "") {
  return primeroNoVacio(config?.nombre_comercial, tenantNombre, config?.nombre_emisor);
}
