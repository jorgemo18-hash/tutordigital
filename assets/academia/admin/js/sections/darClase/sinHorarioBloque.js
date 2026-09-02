import { fetchAlumnos, fetchHorarioCentro } from "../../api.js";
import { alumnosSinHorario } from "../../drawer/horario/ocupacionCliente.js";
import { buildSinHorarioLista } from "../horario/sinHorarioLista.js";

// La lista de "alumnos activos sin ninguna franja", dentro de "Dar clase".
//
// POR QUÉ ESTÁ AQUÍ: vivía solo en la sección "Horario" del menú, y esa
// sección desaparece del menú cuando el centro tiene un único profesor (ver
// seccionesAdmin en sidebar.js). Sin esto, esconder la entrada duplicada se
// llevaría por delante lo ÚNICO que no estaba duplicado: el aviso de que
// hay altas sin cuadrar. Un alumno matriculado en septiembre "para
// octubre" se quedaría guardado y fuera de la vista, sin ningún sitio donde
// se vea que le falta algo.
//
// Va DEBAJO de la rejilla y no en una columna al lado a propósito: al lado
// le come 240px de ancho a los cinco días y el viernes acaba cortado.
//
// Pide los datos del CENTRO (fetchHorarioCentro/fetchAlumnos), no los del
// profesor: quien mira esto es el admin, y la pregunta "¿a quién le falta
// horario?" es del centro entero. Con un solo profesor los dos conjuntos
// coinciden de todas formas, que es justo cuando se pinta.
//
// Si falla, no se pinta nada: es un aviso auxiliar y no puede tumbar el
// horario, que es lo que se venía a ver.
export async function renderSinHorarioBloque(
  contenedor,
  { fetchAlumnosFn = fetchAlumnos, fetchHorarioCentroFn = fetchHorarioCentro } = {}
) {
  if (!contenedor) return null;
  let alumnos = [];
  let franjas = [];
  try {
    [franjas, alumnos] = await Promise.all([fetchHorarioCentroFn(), fetchAlumnosFn({ activo: true })]);
  } catch {
    return null;
  }
  const pendientes = alumnosSinHorario(alumnos, franjas);
  if (!pendientes.length) return null; // nada que avisar: no se ocupa sitio

  const wrap = document.createElement("div");
  wrap.className = "ac-sin-horario-abajo";
  wrap.appendChild(buildSinHorarioLista(pendientes));
  contenedor.appendChild(wrap);
  return wrap;
}
