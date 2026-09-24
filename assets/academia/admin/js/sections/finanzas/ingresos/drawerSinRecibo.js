import { buildIcon } from "../../../icons.js";
import { metodoPagoLabel } from "../../../drawer/familia/familiaFields.js";
import { compararNombres } from "../../../../../../shared/js/ordenAlumnos.js";
import { formatoEuros } from "../../../../../../shared/js/formatoDinero.js";

// EL DRAWER DE "FAMILIAS SIN RECIBO".
//
// Jorge, 24/09/2026: *"sale un aviso de que tantos se han quedado sin
// recibo, ese aviso que sea clicable y que se abra un drawer lateral con las
// familias que están sin recibo"*. El aviso decía CUÁNTAS y CUÁNTO, pero no
// QUIÉNES, que es lo único que sirve para arreglarlo.
//
// Solo enseña; no emite nada. Los recibos se siguen generando en «Envío a
// familias», que es donde está el lote y su vista previa: otro botón de
// "generar" aquí sería un segundo camino para lo mismo, y dos caminos para
// emitir dinero acaban dando dos resultados distintos.
//
// Se crea al abrirse y se QUITA del DOM al cerrarse: la lista es la del mes
// que se estaba mirando, y un drawer que sobreviviera a un cambio de mes
// enseñaría las familias de otro.

function filaDeFamilia(fila, doc) {
  const item = doc.createElement("li");
  item.className = "ac-sinrecibo-fila";

  const linea = doc.createElement("div");
  linea.className = "ac-sinrecibo-linea";
  const nombre = doc.createElement("span");
  nombre.className = "ac-sinrecibo-nombre";
  nombre.textContent = fila.nombre || "Familia sin nombre";
  const importe = doc.createElement("span");
  importe.className = "ac-sinrecibo-importe";
  importe.textContent = formatoEuros(fila.importe);
  linea.append(nombre, importe);

  // Sin forma de pago es un dato que falta, no un método más: se dice.
  const metodo = doc.createElement("div");
  metodo.className = "ac-sinrecibo-metodo";
  metodo.textContent = fila.metodo_pago ? metodoPagoLabel(fila.metodo_pago) : "Sin forma de pago";

  const alumnos = doc.createElement("div");
  alumnos.className = "ac-sinrecibo-alumnos";
  alumnos.textContent = (fila.alumnos || []).join(", ");

  item.append(linea, metodo, alumnos);
  return item;
}

function cabecera(doc, periodo) {
  const head = doc.createElement("div");
  head.className = "ac-drawer-head";
  const titulo = doc.createElement("div");
  titulo.className = "ac-drawer-title";
  titulo.textContent = `Sin recibo de ${periodo}`;
  const cerrarBtn = doc.createElement("button");
  cerrarBtn.type = "button";
  cerrarBtn.className = "ac-drawer-close";
  cerrarBtn.setAttribute("aria-label", "Cerrar");
  cerrarBtn.appendChild(buildIcon("close", { size: 14 }));
  head.append(titulo, cerrarBtn);
  return { head, cerrarBtn };
}

function cuerpo(doc, filas) {
  const total = Math.round(filas.reduce((s, f) => s + (Number(f.importe) || 0), 0) * 100) / 100;
  const body = doc.createElement("div");
  body.className = "ac-drawer-body";
  const resumen = doc.createElement("p");
  resumen.className = "ac-sinrecibo-resumen";
  resumen.textContent = `${filas.length} ${filas.length === 1 ? "familia" : "familias"} · ${formatoEuros(total)}`;
  const lista = doc.createElement("ul");
  lista.className = "ac-sinrecibo-lista";
  for (const fila of filas) lista.appendChild(filaDeFamilia(fila, doc));
  const pista = doc.createElement("p");
  pista.className = "ac-sinrecibo-pista";
  pista.textContent = "Para emitirles el recibo, ve a «Envío a familias» y genera los que faltan.";
  body.append(resumen, lista, pista);
  return body;
}

export function abrirDrawerSinRecibo({ detalle, periodo, root = document.body, doc = document }) {
  const overlay = doc.createElement("div");
  overlay.className = "ac-drawer-overlay ac-drawer-sinrecibo";
  const drawer = doc.createElement("div");
  drawer.className = "ac-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", `Familias sin recibo de ${periodo}`);
  overlay.appendChild(drawer);

  const filas = [...(detalle || [])].sort((a, b) => compararNombres(a.nombre, b.nombre));
  const { head, cerrarBtn } = cabecera(doc, periodo);
  drawer.append(head, cuerpo(doc, filas));
  root.appendChild(overlay);

  function alTeclado(e) { if (e.key === "Escape") cerrar(); }
  function cerrar() {
    doc.removeEventListener("keydown", alTeclado);
    overlay.remove();
  }
  cerrarBtn.addEventListener("click", cerrar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
  doc.addEventListener("keydown", alTeclado);

  // Un fotograma después, para que se vea la transición de entrada.
  const abrir = () => overlay.classList.add("open");
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(abrir);
  else abrir();
  cerrarBtn.focus();

  return { cerrar, el: overlay };
}
