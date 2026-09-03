import { bloquesDeConfig, etiquetaBloque } from "../../../assets/shared/js/horarioBloques.js";
import { normalizarPrecios, hayPrecios } from "../../../assets/shared/js/preciosPublicos.js";
import { hayReservas, reservasVigentes, reservaDe } from "../../../assets/shared/js/horarioReservas.js";
import { etiquetaCortaNivel } from "../../../assets/shared/js/niveles.js";

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

const ABREVIATURA_DIA = {
  1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom",
};

// "Todos", y no la casilla en blanco, para una hora sin curso reservado.
// Un hueco vacío en una rejilla impresa se lee como "ese día a esa hora no
// hay clase", que es justo lo contrario de lo que significa.
const SIN_RESERVA = "Todos";

function diasDeConfig(config) {
  const dias = Array.isArray(config?.dias_laborables) && config.dias_laborables.length
    ? config.dias_laborables
    : [1, 2, 3, 4, 5];
  return [...new Set(dias.map(Number).filter((d) => NOMBRE_DIA[d]))].sort((a, b) => a - b);
}

// La rejilla de días × horas con el curso de cada casilla, SOLO si el
// centro reserva alguna hora. Si no reserva ninguna —el caso de Lyceo y de
// la mayoría— se devuelve null y la hoja sale con la lista de horas de
// siempre: veinticinco casillas que dicen todas "Todos" gastarían media
// cuartilla para no decir nada.
function rejillaDeReservas(config, bloques, dias) {
  const vigentes = reservasVigentes(config?.horario_reservas, { dias, bloques });
  if (!hayReservas(vigentes)) return null;
  return {
    dias: dias.map((d) => ABREVIATURA_DIA[d]),
    filas: bloques.map((bloque) => ({
      hora: etiquetaBloque(bloque),
      celdas: dias.map((dia) => etiquetaCortaNivel(reservaDe(vigentes, dia, bloque)) || SIN_RESERVA),
    })),
  };
}

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
  const bloques = bloquesDeConfig(config);
  const dias = diasDeConfig(config);
  return {
    // El nombre comercial manda sobre el fiscal: en un autónomo,
    // nombre_emisor es el nombre de la persona y no lo que pone en la
    // puerta. Solo se cae al fiscal si el tenant no tiene nombre.
    academia: String(tenantNombre || config.nombre_emisor || "").trim(),
    dias: etiquetaDias(config.dias_laborables),
    bloques: bloques.map(etiquetaBloque),
    // Cuando el centro reserva horas por curso, el horario se imprime como
    // rejilla en vez de como lista: es la única forma de decir "los lunes a
    // las 17:30 solo viene Primaria".
    rejilla: rejillaDeReservas(config, bloques, dias),
    // Una tabla con los ejes puestos pero sin un solo precio no se imprime:
    // un cuadro en blanco en un papel que se entrega es peor que no llevar
    // cuadro. Ver hayPrecios().
    precios: hayPrecios(precios) ? precios : null,
    contacto: lineasContacto(config),
  };
}
