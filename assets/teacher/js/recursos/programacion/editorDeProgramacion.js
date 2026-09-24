import { el, boton } from "../elementos.js";
import { variantesDe, deLaVariante, cobertura, sumaDePesos } from "../../../../shared/programacion/estructuraDeLaProgramacion.js";
import { APARTADOS_DE_TEXTO } from "../../../../shared/programacion/apartadosLegales.js";
import { crearGuardadoAutomatico } from "./guardadoAutomatico.js";
import { pintarPasoDatos, sesionesDelCurso, SEMANAS_POR_DEFECTO } from "./pasoDatos.js";
import { pintarPasoUnidades } from "./pasoUnidades.js";
import { pintarPasoEvaluacion } from "./pasoEvaluacion.js";
import { pintarPasoTextos } from "./pasoTextos.js";
import { pintarDocumento } from "./documentoDeProgramacion.js";
import { abrirPdf } from "../../../../shared/generador/abrirPdf.js";

// EL EDITOR DE UNA PROGRAMACIÓN: cinco pasos en pestañas (no un asistente
// obligatorio: se vuelve a cualquiera cuando se quiera) y guardado solo.
//
//   1 Datos · 2 Unidades (b) · 3 Evaluación (c, d, e) · 4 Resto (f–ñ) ·
//   5 Documento (a–ñ para imprimir)
//
// Cada pestaña lleva una marca de si está completa, para saber de un
// vistazo qué queda.
export const PASOS = [
  ["datos", "Datos"],
  ["unidades", "Unidades"],
  ["evaluacion", "Evaluación"],
  ["resto", "Resto"],
  ["documento", "Documento"],
];

const LETRAS_RESTO = APARTADOS_DE_TEXTO.map((a) => a.letra).filter((l) => l !== "c" && l !== "e");

export function estadoDeLosPasos(curriculo, datos) {
  const lleno = (l) => Boolean(String(datos.textos?.[l] || "").trim());
  return {
    datos: Boolean(datos.sesionesSemanales),
    unidades: (datos.unidades || []).length > 0 && cobertura(curriculo, datos.unidades).completa,
    evaluacion: lleno("c") && lleno("e") && Math.round(sumaDePesos(datos.pesos) * 10) / 10 === 100,
    resto: LETRAS_RESTO.every(lleno),
    documento: null,
  };
}

export async function abrirEditorDeProgramacion({ raiz, api, id, centro = "", onVolver = () => {}, doc = document, reloj = globalThis }) {
  raiz.replaceChildren(el(doc, "p", "rc-msg", "Abriendo la programación…"));
  let prog;
  let completo;
  try {
    prog = await api.leeProgramacion(id);
    completo = await api.curriculo(prog.materia_slug, prog.curso);
  } catch (err) {
    raiz.replaceChildren(el(doc, "p", "rc-msg rc-msg--error", err?.message || "No se pudo abrir la programación."), boton(doc, "← Volver", { onClick: onVolver }));
    return null;
  }
  const cabecera = { titulo: prog.titulo || "", curso: prog.curso, materia_slug: prog.materia_slug };
  const datos = { ...(prog.datos || {}) };
  const variantes = variantesDe(completo);
  if (variantes.length > 1 && !datos.variante) datos.variante = variantes[0];
  if (datos.sesionesSemanales == null && completo.sesionesSemanales) datos.sesionesSemanales = completo.sesionesSemanales;
  if (!datos.semanas) datos.semanas = SEMANAS_POR_DEFECTO;
  const curriculoActual = () => deLaVariante(completo, datos.variante);
  // El borrador con IA (iaEnElEditor.js): lo pide al servidor con lo que
  // hay ahora mismo en la programación.
  const cuerpoIA = () => ({ materia_slug: cabecera.materia_slug, curso: cabecera.curso ?? null, variante: datos.variante || null });
  const ia = {
    proponerUnidades: () => api.proponUnidadesIA({ ...cuerpoIA(), sesionesTotales: sesionesDelCurso(datos) }),
    redactar: async (letras) => (await api.redactaTextosIA({ ...cuerpoIA(), datos, letras })).textos,
  };
  const abiertas = new Set();

  const estado = el(doc, "span", "rc-pg__estado", "Guardado");
  estado.setAttribute("role", "status");
  const guardado = crearGuardadoAutomatico({
    guardarFn: () => api.guardaProgramacion(id, { titulo: cabecera.titulo, datos }),
    onEstado: (t) => { estado.textContent = t; },
    reloj,
  });

  // Cerrar la pestaña con cambios a medio guardar: el navegador avisa.
  let abierto = true;
  doc.defaultView?.addEventListener?.("beforeunload", (e) => {
    if (abierto && guardado.pendiente) { e.preventDefault(); e.returnValue = ""; }
  });

  const cab = el(doc, "div", "rc-head");
  const tit = el(doc, "div");
  const h1 = el(doc, "h1", "rc-h1", cabecera.titulo || "Programación sin título");
  tit.append(el(doc, "div", "rc-crumb", `Recursos · Programación · ${completo.materia}${cabecera.curso ? ` ${cabecera.curso}.º` : ""}`), h1);
  const volver = boton(doc, "← Mis programaciones", {
    clase: "rc-btn--gh",
    onClick: async () => { await guardado.guardarYa(); abierto = false; onVolver(); },
  });
  cab.append(tit, el(doc, "span", "rc-sp"), estado, volver);

  const pestanas = el(doc, "div", "rc-subnav rc-pg__pasos");
  pestanas.setAttribute("role", "tablist");
  const cuerpo = el(doc, "div", "rc-pg__cuerpo");
  const botones = {};
  let actual = "datos";

  function marcas() {
    const e = estadoDeLosPasos(curriculoActual(), datos);
    PASOS.forEach(([clave, texto], i) => {
      botones[clave].textContent = `${i + 1}. ${texto}${e[clave] === true ? " ✓" : ""}`;
      botones[clave].classList.toggle("is-on", clave === actual);
      botones[clave].setAttribute("aria-selected", String(clave === actual));
    });
  }
  const onCambio = () => { h1.textContent = cabecera.titulo || "Programación sin título"; guardado.cambio(); marcas(); };

  function mostrar(clave) {
    actual = clave;
    const curriculo = curriculoActual();
    const comun = { contenedor: cuerpo, datos, onCambio, doc };
    if (clave === "datos") {
      pintarPasoDatos({
        ...comun, cabecera, variantes, sesionesOficiales: completo.sesionesSemanales,
        onVariante: () => { datos.unidades = []; datos.pesos = {}; onCambio(); },
      });
    } else if (clave === "unidades") {
      pintarPasoUnidades({ ...comun, curriculo, sesionesTotales: sesionesDelCurso(datos), abiertas, ia });
    } else if (clave === "evaluacion") {
      pintarPasoEvaluacion({ ...comun, curriculo, ia });
    } else if (clave === "resto") {
      pintarPasoTextos({ ...comun, letras: LETRAS_RESTO, ia });
    } else {
      pintarDocumento({
        contenedor: cuerpo, curriculo, datos, cabecera, centro, doc,
        // Primero se guarda lo pendiente: el PDF es de lo que hay en pantalla.
        onPdf: async () => {
          await guardado.guardarYa();
          await abrirPdf({
            pedirPdfFn: () => api.pdfDeProgramacion({ curriculo, datos, cabecera, centro }), win: doc.defaultView, doc,
            queEs: "de la programación", nombreArchivo: "programacion-didactica.pdf",
          });
        },
      });
    }
    marcas();
  }

  PASOS.forEach(([clave]) => {
    const b = el(doc, "button", "rc-subnav__btn");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.paso = clave;
    b.addEventListener("click", () => mostrar(clave));
    botones[clave] = b;
    pestanas.appendChild(b);
  });

  const aviso = completo.literal != null && completo.literal < 95
    ? el(doc, "p", "rc-ban", `Ojo: el texto de esta materia se sacó del PDF oficial con un ${completo.literal} % de coincidencia literal. Revisa el documento contra el anexo antes de entregarlo.`)
    : null;
  raiz.replaceChildren(...[cab, aviso, pestanas, cuerpo].filter(Boolean));
  mostrar("datos");
  return { mostrar, guardado, get datos() { return datos; }, get cabecera() { return cabecera; } };
}
