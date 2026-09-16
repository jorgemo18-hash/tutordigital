import { fetchHorarioCentro, fetchAlumnos } from "../api.js";
import { alumnosSinHorario } from "../drawer/horario/ocupacionCliente.js";
import { buildRejillaCentro, diasDe } from "./horario/rejillaCentro.js";
import { buildBotonImprimir, buildCabeceraDeImpresion, buildNotaOrientacion, ensureEstilosDeImpresion } from "../../../aula/js/horario/imprimirCuadrante.js";
import { buildSinHorarioLista } from "./horario/sinHorarioLista.js";
import { buildTablaImprimible } from "../../../../shared/js/cuadranteImprimible.js";
import { revisarAjusteDelCuadrante } from "../../../../shared/js/ajusteDelCuadrante.js";
import { bloquesDeConfig } from "../../../../shared/js/horarioBloques.js";
import {
  TODOS,
  gruposDeHorario,
  opcionesDeProfesor,
  tieneSentidoElSelector,
} from "./horario/agrupacionProfesor.js";

// Vista global del horario del centro. Existía la capacidad en el backend
// desde siempre (GET /academia/horario ya devolvía todas las franjas para el
// rol admin) pero ninguna pantalla la consumía: el admin asignaba franjas
// alumno por alumno sin poder ver nunca el cuadrante completo, lo que
// obligaba a llevar un Excel en paralelo.
//
// Desde la migración 109 cada franja sabe quién la imparte, así que aquí se
// puede filtrar y agrupar por profesor. Con "Todos" se pinta una rejilla por
// profesor y, al final, otra con las franjas sin asignar — que no se
// esconden: son los huecos que hay que resolver al cuadrar el curso.
//
// Si NINGUNA franja tiene profesor (academia de una sola persona que nunca
// ha rellenado el campo, o cualquier centro anterior a la 109) no se pinta
// selector y se ve una única rejilla, exactamente como antes: un desplegable
// con una sola opción es ruido.
//
// De solo lectura a propósito: asignar sigue haciéndose en la ficha del
// alumno, que es donde ya funciona y donde está el resto del contexto
// (tarifa, familia, descuentos). Duplicar la asignación aquí sería un
// segundo camino para escribir lo mismo, y este repo ya tiene cicatrices de
// eso.
function buildSelectorProfesor(opciones, { valor, onChange }) {
  const wrap = document.createElement("div");
  wrap.className = "ach-filtro";

  const label = document.createElement("label");
  label.className = "ac-label";
  label.textContent = "Ver";
  wrap.appendChild(label);

  const select = document.createElement("select");
  select.className = "ac-select";
  for (const { value, label: texto } of opciones) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = texto;
    select.appendChild(opt);
  }
  select.value = valor;
  select.addEventListener("change", () => onChange(select.value));
  wrap.appendChild(select);

  return wrap;
}

export function createHorarioSection({ config = {}, nombreCentro = "" } = {}) {
  // Se recuerda mientras dure la sesión: volver a Horario después de
  // corregir una ficha no debe devolverte a "Todos" si estabas mirando a un
  // profesor concreto.
  let seleccion = TODOS;

  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Horario";
    head.appendChild(title);
    container.appendChild(head);

    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    Promise.all([fetchHorarioCentro(), fetchAlumnos({ activo: true })])
      .then(([franjas, alumnos]) => {
        cargando.remove();

        const layout = document.createElement("div");
        layout.className = "ach-layout";

        const rejillaWrap = document.createElement("div");
        rejillaWrap.className = "ach-rejilla-wrap";

        // Mismo botón y misma hoja de impresión que el cuadrante del aula
        // (assets/academia/aula/js/horario/imprimirCuadrante.js): son dos
        // rejillas distintas, pero imprimir un folio horizontal es lo mismo en
        // las dos y no hay dos formas de hacerlo. Y lo que se imprime tampoco
        // es la rejilla de aquí: `.ach-rejilla-wrap` tiene scroll horizontal,
        // así que en papel se cortaba por el mismo sitio por el que se corta
        // en pantalla. Ver cuadranteImprimible.js.
        ensureEstilosDeImpresion();
        const acciones = document.createElement("div");
        acciones.className = "ac-cuadrante-acciones";
        acciones.appendChild(buildBotonImprimir());
        const notaOrientacion = buildNotaOrientacion();
        if (notaOrientacion) acciones.appendChild(notaOrientacion);
        container.appendChild(acciones);
        container.appendChild(buildCabeceraDeImpresion({
          titulo: "Horario del centro",
          centro: nombreCentro,
        }));

        // Una hoja de papel por grupo, en el mismo orden que las rejillas:
        // con "Todos" hay una rejilla por profesor, y en papel también — un
        // cuadrante que mezcle a dos profesores en la misma casilla no le
        // sirve a ninguno de los dos.
        const hojasSlot = document.createElement("div");
        container.appendChild(hojasSlot);
        const bloques = bloquesDeConfig(config);
        const maxPorFranja = Number(config.max_alumnos_por_franja) || 0;

        function pintarRejillas() {
          rejillaWrap.innerHTML = "";
          hojasSlot.innerHTML = "";
          for (const grupo of gruposDeHorario(franjas, seleccion)) {
            rejillaWrap.appendChild(
              buildRejillaCentro({ franjas: grupo.franjas, config, titulo: grupo.titulo })
            );
            hojasSlot.appendChild(
              buildTablaImprimible({
                franjas: grupo.franjas,
                dias: diasDe(config),
                bloques,
                maxPorFranja,
                titulo: grupo.titulo,
              })
            );
          }
          // Cada hoja se mide contra su folio y elige su cuerpo de letra.
          revisarAjusteDelCuadrante(container);
        }

        if (tieneSentidoElSelector(franjas)) {
          container.appendChild(
            buildSelectorProfesor(opcionesDeProfesor(franjas), {
              valor: seleccion,
              onChange: (valor) => {
                seleccion = valor;
                // Solo se repintan las rejillas: la lista de "sin horario"
                // es de alumnos, no de franjas, y no depende del filtro.
                pintarRejillas();
              },
            })
          );
        }

        pintarRejillas();
        layout.appendChild(rejillaWrap);
        layout.appendChild(buildSinHorarioLista(alumnosSinHorario(alumnos, franjas)));
        container.appendChild(layout);
      })
      .catch((err) => {
        cargando.textContent = err.message || "No se pudo cargar el horario.";
        cargando.className = "ac-error";
      });
  }

  return { render };
}
