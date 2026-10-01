import { el, boton, campo, selector } from "../elementos.js";
import { ETAPAS } from "../../../../shared/curriculo/etapas.js";
import { createVisorDeHoja } from "../../../../shared/generador/visorDeHoja.js";
import { pedirPdfDeLaHoja } from "../../../../shared/generador/apiDeHojas.js";
import { abrirPdf } from "../../../../shared/generador/abrirPdf.js";

// RECURSOS → HOJAS CON IA: para los temas que todavía no tienen generador
// propio. La IA escribe los ejercicios mirando ejercicios de referencia del
// tema y el currículo de Aragón; el servidor comprueba las soluciones de lo
// que se puede calcular y tira lo que no cuadra (server/lib/hojasIA/).
//
// Aquí se ve, ejercicio a ejercicio, si su solución está COMPROBADA o no se
// ha podido comprobar, y la solución para el profesor (que no se imprime).
// Lo que aún no hace: cambiar un ejercicio suelto, guardarla con código o
// ponerla de deberes (eso es del generador de siempre).
const NOMBRE_MATERIA = { matematicas: "Matemáticas" };
const nombreMateria = (m) => NOMBRE_MATERIA[m] || m;
const nombreCurso = (etapa, curso) => (etapa === "eso" ? `${curso}.º ESO` : `${curso}.º ${ETAPAS[etapa]?.nombre || etapa}`);

export function createPantallaDeHojasIA({
  api, centro = "", createVisorFn = createVisorDeHoja, pedirPdfFn = pedirPdfDeLaHoja, abrirPdfFn = abrirPdf, doc = document,
} = {}) {
  let cursos = [];
  let temas = [];
  let actual = null;
  const p = {};

  function mensaje(texto, error = false) {
    p.msg.textContent = texto || "";
    p.msg.className = error ? "rc-msg rc-msg--error" : "rc-msg";
  }

  const elegido = () => cursos[Number(p.curso.value)] || null;

  async function cargarTemas() {
    const c = elegido();
    temas = [];
    p.tema.replaceChildren();
    if (!c) return;
    try {
      temas = (await api.temasIA(c)).temas || [];
    } catch (err) {
      mensaje(err?.message || "No se pudieron cargar los temas.", true);
    }
    for (const t of temas) {
      const o = el(doc, "option", "", t.titulo);
      o.value = t.tema;
      p.tema.appendChild(o);
    }
    p.escribir.disabled = !temas.length;
  }

  function pintarEjercicios() {
    p.lista.replaceChildren();
    actual.huecos.forEach((h) => {
      const item = el(doc, "div", "rc-card rc-ia__ej");
      item.dataset.orden = String(h.orden);
      const cab = el(doc, "div", "rc-ia__cab");
      const estado = h.verificacion !== "comprobada"
        ? el(doc, "span", "rc-tag rc-tag--aviso", "Sin verificar: revísala")
        : h.revisar === "enunciado"
          ? el(doc, "span", "rc-tag rc-tag--aviso", "Cuentas comprobadas: lee el enunciado")
          : el(doc, "span", "rc-tag rc-tag--ok", "Solución comprobada");
      cab.append(el(doc, "b", "", `${h.orden}. ${h.nombre}`), estado);
      const saber = el(doc, "p", "rc-sub", `${h.saber?.codigo || ""} ${h.saber?.nombre || ""} · dificultad ${h.dificultad}`);
      const sol = el(doc, "details", "rc-ia__sol");
      sol.append(el(doc, "summary", "", "Solución"), el(doc, "p", "", h.solucion));
      item.append(cab, saber, sol);
      p.lista.appendChild(item);
    });
  }

  async function escribir() {
    const c = elegido();
    if (!c || !p.tema.value) return;
    p.escribir.disabled = true;
    mensaje("Escribiendo la hoja… (puede tardar hasta un minuto)");
    try {
      const cuerpo = { ...c, tema: p.tema.value, actividades: Number(p.cuantos.value) };
      if (p.dificultad.value) cuerpo.dificultad = Number(p.dificultad.value);
      if (p.resultados.value === "enteros") cuerpo.soloEnteros = true;
      actual = await api.generaHojaIA(cuerpo);
      const sinVerificar = actual.huecos.filter((h) => h.verificacion !== "comprobada").length;
      const aLeer = actual.huecos.filter((h) => h.verificacion === "comprobada" && h.revisar === "enunciado").length;
      mensaje([
        `${actual.huecos.length} ejercicios.`,
        sinVerificar ? `${sinVerificar} sin verificar: revísalos antes de imprimir.` : "",
        aLeer ? `${aLeer} ${aLeer === 1 ? "problema" : "problemas"} con las cuentas comprobadas: lee ${aLeer === 1 ? "su enunciado" : "sus enunciados"} antes de imprimir.` : "",
        !sinVerificar && !aLeer ? "Todas las soluciones comprobadas." : "",
        actual.descartados ? `Se han descartado ${actual.descartados} que no pasaron la comprobación.` : "",
      ].filter(Boolean).join(" "));
      pintarEjercicios();
      p.visor.pintar({ ...actual.hoja, centro });
      p.pdf.disabled = false;
    } catch (err) {
      mensaje(err?.message || "No se pudo escribir la hoja.", true);
    } finally {
      p.escribir.disabled = !temas.length;
    }
  }

  async function imprimir() {
    if (!actual) return;
    p.pdf.disabled = true;
    try {
      await abrirPdfFn({ pedirPdfFn: () => pedirPdfFn({ ...actual.hoja, centro }) });
    } catch (err) {
      mensaje(err?.message || "No se pudo generar el PDF.", true);
    } finally {
      p.pdf.disabled = false;
    }
  }

  async function render(raiz) {
    raiz.replaceChildren(el(doc, "p", "rc-msg", "Cargando…"));
    try {
      cursos = (await api.disponiblesIA()).cursos || [];
    } catch (err) {
      raiz.replaceChildren(el(doc, "p", "rc-msg rc-msg--error", err?.message || "No se pudo cargar."));
      return;
    }
    const cab = el(doc, "div", "rc-head");
    const tit = el(doc, "div");
    tit.append(el(doc, "div", "rc-crumb", "Recursos · Hojas con IA"), el(doc, "h1", "rc-h1", "Hojas escritas con IA"));
    cab.appendChild(tit);
    const intro = el(doc, "p", "rc-sub", "Para los temas que aún no tienen generador. La IA escribe ejercicios nuevos a partir de ejercicios de referencia del tema y del currículo de Aragón; las soluciones que se pueden calcular las comprueba el ordenador y lo que no cuadra no llega a la hoja.");
    p.curso = selector(doc, cursos.map((c, i) => [i, `${nombreMateria(c.materia)} · ${nombreCurso(c.etapa, c.curso)}`]), 0);
    p.tema = el(doc, "select", "rc-sel");
    p.cuantos = selector(doc, [4, 5, 6, 7, 8].map((n) => [n, `${n} ejercicios`]), 6);
    p.dificultad = selector(doc, [["", "Dificultad variada"], [1, "Sobre todo fácil"], [2, "Sobre todo media"], [3, "Sobre todo difícil"]], "");
    // Depende del tema: con fracciones es lo normal; en otros, mejor enteros.
    p.resultados = selector(doc, [["", "Pueden ser fracciones"], ["enteros", "Solo enteros"]], "");
    p.escribir = boton(doc, "Escribir la hoja", { clase: "rc-btn--pri", onClick: () => escribir() });
    p.pdf = boton(doc, "PDF para imprimir", { onClick: () => imprimir() });
    p.pdf.disabled = true;
    p.curso.addEventListener("change", () => cargarTemas());
    const barra = el(doc, "div", "rc-card rc-ctx");
    barra.append(campo(doc, "Curso", p.curso), campo(doc, "Tema", p.tema), campo(doc, "Cuántos", p.cuantos), campo(doc, "Dificultad", p.dificultad), campo(doc, "Resultados", p.resultados), p.escribir, p.pdf);
    p.msg = el(doc, "p", "rc-msg");
    p.msg.setAttribute("role", "status");
    p.lista = el(doc, "div", "rc-ia__lista");
    p.visor = createVisorFn({ doc, clase: "rc-folio" });
    const cuerpo = el(doc, "div", "rc-ia__cuerpo");
    cuerpo.append(p.lista, p.visor.el);
    raiz.replaceChildren(cab, intro, barra, p.msg, cuerpo);
    if (!cursos.length) {
      mensaje("Todavía no hay temas con ejercicios de referencia.");
      p.escribir.disabled = true;
      return;
    }
    await cargarTemas();
  }

  return { render, get actual() { return actual; } };
}
