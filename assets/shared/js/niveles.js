// Los niveles educativos que maneja el sistema, en un solo sitio.
//
// Ya existían repartidos: academia_alumnos.nivel guarda estos tres valores
// y el panel del profesor los pinta con su color (ver profesor/js/nivel.js).
// Al empezar a usarlos también en el horario del centro —reservar una hora
// para un curso, ver horarioReservas.js— hacía falta una lista canónica: si
// mañana entra "FP" o "Adultos", se añade AQUÍ y aparece en los dos sitios
// a la vez, en vez de en uno solo y con otro nombre.
//
// El orden es el escolar (de menos a más edad), que es como se leen en un
// desplegable y como se ordenan en la cabeza de cualquiera que trabaje en
// una academia.

// `corto` es para la rejilla impresa de la hoja para familias: en una
// casilla de kilómetro y medio de ancho, "Bachillerato" solo cabe
// encogiendo la letra hasta que no se lee. "Bach." lo entiende cualquier
// padre y se lee de un vistazo, que es de lo que va ese papel.
export const NIVELES = [
  { id: "primaria", label: "Primaria", corto: "Primaria" },
  { id: "eso", label: "ESO", corto: "ESO" },
  { id: "bachillerato", label: "Bachillerato", corto: "Bach." },
];

const POR_ID = new Map(NIVELES.map((n) => [n.id, n]));

export function esNivel(id) {
  return POR_ID.has(id);
}

// El nombre para enseñar. Un nivel desconocido (un dato viejo, un valor
// escrito a mano en la base de datos) se devuelve tal cual en vez de
// tragárselo: es preferible ver "fp" en pantalla y corregirlo que no ver
// nada y creer que el alumno no tiene nivel.
export function etiquetaNivel(id) {
  return POR_ID.get(id)?.label || id || "";
}

export function etiquetaCortaNivel(id) {
  return POR_ID.get(id)?.corto || id || "";
}
