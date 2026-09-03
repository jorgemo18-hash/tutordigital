import { bloquesDeConfig, etiquetaBloque } from "../../../assets/shared/js/horarioBloques.js";
import { normalizarPrecios, hayPrecios } from "../../../assets/shared/js/preciosPublicos.js";

// Lo que se imprime en la hoja para familias, sacado de la configuración
// del centro. Función pura: recibe el config ya leído y no toca la base de
// datos, para que el generador del PDF se pueda probar sin Supabase.
//
// EL HORARIO SALE DE LA CONFIGURACIÓN, NO SE ESCRIBE A MANO. Es el mismo
// bloquesDeConfig() que dibuja las filas del cuadrante de "Dar clase": si
// mañana el centro cierra a las 20:00 en vez de a las 20:30, la hoja lo
// dice sin que nadie se acuerde de cambiarla. Un horario impreso que no
// coincide con el real es peor que no tener hoja.
//
// LO QUE NO LLEVA: las plazas libres. Este papel se queda en casa de una
// familia dos semanas, y "4/6" caduca esa misma tarde. Quién tiene hueco se
// mira en el cuadrante al hablar con el padre, no en una hoja impresa.

const NOMBRE_DIA = {
  1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo",
};

function capitalizar(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : "";
}

// "Lunes a viernes" si los días van seguidos, "Lunes, miércoles y viernes"
// si no. La forma corta es la que se lee de un vistazo, y el caso seguido
// es el de casi todas las academias — pero un centro que solo abre martes y
// jueves no puede leer "martes a jueves", que sería mentira.
export function etiquetaDias(diasLaborables) {
  const dias = [...new Set((Array.isArray(diasLaborables) ? diasLaborables : [1, 2, 3, 4, 5])
    .map(Number)
    .filter((d) => NOMBRE_DIA[d]))].sort((a, b) => a - b);
  if (!dias.length) return "";
  if (dias.length === 1) return capitalizar(NOMBRE_DIA[dias[0]]);

  const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  if (seguidos) return `${capitalizar(NOMBRE_DIA[dias[0]])} a ${NOMBRE_DIA[dias[dias.length - 1]]}`;

  const nombres = dias.map((d) => NOMBRE_DIA[d]);
  return capitalizar(`${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`);
}

// Las líneas de contacto que de verdad hay. Se filtran los vacíos en vez de
// imprimir "Teléfono: —": en una cuartilla cada línea cuesta, y un hueco en
// blanco donde debería ir un teléfono hace dudar de todo lo demás.
export function lineasContacto(config = {}) {
  return [config.telefono_emisor, config.email_emisor, config.direccion_emisor]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

export function construirPayloadHojaFamilias({ tenantNombre = "", config = {} } = {}) {
  const precios = normalizarPrecios(config.precios_publicos);
  return {
    // El nombre comercial manda sobre el fiscal: en un autónomo,
    // nombre_emisor es el nombre de la persona y no lo que pone en la
    // puerta. Solo se cae al fiscal si el tenant no tiene nombre.
    academia: String(tenantNombre || config.nombre_emisor || "").trim(),
    dias: etiquetaDias(config.dias_laborables),
    bloques: bloquesDeConfig(config).map(etiquetaBloque),
    // Una tabla con los ejes puestos pero sin un solo precio no se imprime:
    // un cuadro en blanco en un papel que se entrega es peor que no llevar
    // cuadro. Ver hayPrecios().
    precios: hayPrecios(precios) ? precios : null,
    contacto: lineasContacto(config),
  };
}
