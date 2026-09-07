import { bloquesDeConfig, etiquetaBloque } from "../../../assets/shared/js/horarioBloques.js";
import { normalizarPrecios, hayPrecios } from "../../../assets/shared/js/preciosPublicos.js";
import { hayReservas, reservasVigentes, nivelesDe, esHoraAbierta } from "../../../assets/shared/js/horarioReservas.js";
import { etiquetaCortaNivel } from "../../../assets/shared/js/niveles.js";
import { ocupacionPorCasilla, estaCompleta, clave } from "./ocupacionHoja.js";

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
// EL HORARIO VA SIEMPRE COMO REJILLA de días × horas, aunque no haya nada
// que escribir dentro. Es lo que Jorge llevaba a mano en papel y para lo que
// lo usa: rodear a bolígrafo las horas que elige cada familia. Una lista de
// horas no se puede rodear.
//
// LAS HORAS COMPLETAS SE MARCAN, las plazas exactas NO. Un "4/6" impreso
// caduca esa misma tarde; "esta hora está completa" aguanta semanas y es lo
// que de verdad decide la conversación — el padre se lleva al niño a la hora
// que tiene sitio. Las plazas al detalle se miran en el cuadrante.

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

// Lo que pone una casilla. Una hora puede tener más de un curso —en un
// centro con dos profesores, a las cuatro puede haber Primaria con una y
// ESO con otro— y entonces se imprimen los dos: a la familia le importa si
// su hijo puede venir, no con quién. Con todos marcados vuelve a ser una
// hora abierta.
//
// "Todos" solo se escribe si el centro reserva alguna hora. Si no reserva
// ninguna, la rejilla va en blanco a propósito: es una plantilla donde se
// rodean a mano las horas elegidas, y veinticinco casillas repitiendo
// "Todos" solo estorban. En cambio, con unas horas marcadas y otras no, el
// hueco en blanco se leería como "aquí no hay clase" — y ahí sí hace falta
// decirlo.
function textoDeCasilla(niveles, hayCursos) {
  if (esHoraAbierta(niveles)) return hayCursos ? SIN_RESERVA : "";
  return niveles.map(etiquetaCortaNivel).join(" · ");
}

function rejillaDeHorario(config, bloques, dias, franjas) {
  const vigentes = reservasVigentes(config?.horario_reservas, { dias, bloques });
  const hayCursos = hayReservas(vigentes);
  const ocupacion = ocupacionPorCasilla(franjas, { dias, bloques });

  let hayCompletas = false;
  const filas = bloques.map((bloque) => ({
    hora: etiquetaBloque(bloque),
    celdas: dias.map((dia) => {
      const completo = estaCompleta(ocupacion.get(clave(dia, bloque)), config?.max_alumnos_por_franja);
      if (completo) hayCompletas = true;
      return { texto: textoDeCasilla(nivelesDe(vigentes, dia, bloque), hayCursos), completo };
    }),
  }));

  // La leyenda solo se imprime si hay alguna casilla marcada: explicar un
  // sombreado que no aparece en ningún sitio gasta una línea de la cuartilla
  // y hace dudar de si falta algo.
  return { dias: dias.map((d) => ABREVIATURA_DIA[d]), filas, hayCompletas };
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

// `franjas` son las filas vigentes de academia_horario del centro (con
// dia_semana, hora_inicio y hora_fin). Sin ellas la hoja sale igual, solo
// que sin ninguna hora marcada como completa.
export function construirPayloadHojaFamilias({ tenantNombre = "", config = {}, franjas = [] } = {}) {
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
    // El horario impreso, siempre como rejilla de días × horas.
    rejilla: rejillaDeHorario(config, bloques, dias, franjas),
    // Una tabla con los ejes puestos pero sin un solo precio no se imprime:
    // un cuadro en blanco en un papel que se entrega es peor que no llevar
    // cuadro. Ver hayPrecios().
    precios: hayPrecios(precios) ? precios : null,
    contacto: lineasContacto(config),
  };
}
