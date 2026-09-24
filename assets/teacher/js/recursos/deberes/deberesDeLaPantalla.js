import { abrirDialogoDeDeberes } from "./dialogoDeDeberes.js";
import { ponerComoDeberes, adjuntaElPdf } from "./ponerComoDeberes.js";

// "PONER COMO DEBERES" desde la pantalla de hojas: guarda la hoja (si no lo
// estaba: el código va en el título y en el papel), abre el diálogo y, al
// aceptar, crea la tarea con el PDF. Todo lo de la pantalla le llega por
// parámetros: la hoja en pantalla, el guardado, los grupos del profesor.
export function crearDeberesDeLaPantalla({
  api, guardado, getActual, parametros, centro = "", pedirPdfFn,
  getGrupos = () => [], getGrupoActivo = () => null, getAsignatura = () => "", getTituloDeLaHoja = () => "Hoja de ejercicios",
  onGuardada = () => {}, onHecho = () => {}, mensaje = () => {},
  abrirDialogoFn = abrirDialogoDeDeberes, doc = document,
}) {
  let abierto = null;

  // Los grupos del panel; si el panel aún no los tiene, se piden.
  async function grupos() {
    const del = getGrupos() || [];
    if (del.length) return del;
    const r = await api.gruposDelProfesor();
    return (r.items || []).map((g) => ({ id: g.id, name: g.name }));
  }

  async function abrir() {
    const actual = getActual();
    if (!actual || abierto) return;
    mensaje("Guardando la hoja…");
    let hoja;
    let lista;
    try {
      const { codigo, nueva } = await guardado.asegurar(actual, { parametros: parametros(), centro });
      if (nueva) onGuardada();
      hoja = { id: guardado.id, codigo };
      lista = await grupos();
    } catch (err) {
      mensaje(err?.message || "No se pudo guardar la hoja.", true);
      return;
    }
    mensaje("");
    const pedirPdf = () => pedirPdfFn({ ...actual.hoja, centro, codigo: hoja.codigo });
    abierto = abrirDialogoFn({
      doc,
      codigo: hoja.codigo,
      tituloSugerido: `${getTituloDeLaHoja()} (${hoja.codigo})`.slice(0, 120),
      grupos: lista,
      grupoActivo: getGrupoActivo(),
      onEnviar: async (datos) => {
        const r = await ponerComoDeberes({ api, hoja, pedirPdf, datos: { ...datos, asignatura: getAsignatura() } });
        const grupo = lista.find((g) => g.id === datos.grupoId)?.name || "el grupo";
        if (r.adjunto) {
          mensaje(`Hoja ${hoja.codigo} puesta como deberes para ${grupo}. La verán en su agenda con el PDF.`);
        }
        onHecho(r.tarea);
        return r;
      },
      onReintentar: async (tarea) => {
        await adjuntaElPdf({ api, tareaId: tarea.id, codigo: hoja.codigo, pedirPdf });
        mensaje(`Hoja ${hoja.codigo} puesta como deberes, ya con el PDF.`);
        onHecho(tarea);
      },
      onCerrar: () => { abierto = null; },
    });
  }

  return { abrir, get abierto() { return Boolean(abierto); } };
}
