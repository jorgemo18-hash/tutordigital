// mobileTeacherRecursos.js — Recursos → Hojas de ejercicios en el panel móvil.
//
// Es LA MISMA PANTALLA que en escritorio (js/recursos/pantallaDeHojas.js),
// en modo móvil: una columna, la barra de contexto plegada, el folio a
// pantalla completa, subir/bajar con botones y los diálogos como hojas
// inferiores (ver styles/teacher-new/11-recursos-movil.css). Una sola
// lógica: lo que se arregle en una se arregla en las dos.
//
// Se monta la primera vez que se abre la pestaña, como en escritorio.
import { createPantallaDeHojas } from "../js/recursos/pantallaDeHojas.js";

export function initMtRecursos({ pageEl, headerEl, mtState, centro = "", crearPantallaFn = createPantallaDeHojas }) {
  headerEl.innerHTML = `
    <div class="mt-header-eyebrow">Recursos</div>
    <div class="mt-header-title">Hojas de <em>ejercicios</em></div>`;
  const raiz = document.createElement("section");
  raiz.className = "rc rc--movil";
  raiz.id = "mtRecursosContent";
  pageEl.appendChild(raiz);

  let pantalla = null;
  return {
    alMostrar() {
      if (pantalla) {
        pantalla.revisarAsignatura();
        return;
      }
      pantalla = crearPantallaFn({ centro, movil: true, getAsignatura: () => mtState.currentSubjectName || "" });
      pantalla.render(raiz);
    },
  };
}
