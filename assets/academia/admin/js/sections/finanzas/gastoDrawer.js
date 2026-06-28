import { CATEGORIAS_GASTO, calcGasto } from "./calculos.js";
import { buildGastoUpload } from "./gastoUpload.js";
import { buildIcon } from "../../icons.js";

function buildField(label, tag, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement(tag);
  input.className = tag === "select" ? "ac-select" : "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function buildCategoriaSelect() {
  const field = buildField("Categoría", "select");
  for (const c of CATEGORIAS_GASTO) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    field.input.appendChild(opt);
  }
  return field;
}

// Drawer lateral para registrar un gasto. `onGuardar(gasto)` recibe el
// gasto con los importes ya calculados (IVA, retención, total).
export function createGastoDrawer(root, { onGuardar }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
  }

  function render() {
    drawer.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-drawer-head";
    const title = document.createElement("div");
    title.className = "ac-drawer-title";
    title.textContent = "Nuevo gasto";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ac-drawer-close";
    closeBtn.appendChild(buildIcon("close", { size: 14 }));
    closeBtn.addEventListener("click", close);
    head.append(title, closeBtn);

    const body = document.createElement("div");
    body.className = "ac-drawer-body";

    const fecha = buildField("Fecha", "input", { type: "date", value: new Date().toISOString().slice(0, 10) });
    const proveedor = buildField("Proveedor", "input", { type: "text" });
    const concepto = buildField("Concepto", "input", { type: "text" });
    const cif = buildField("CIF / NIF proveedor", "input", { type: "text" });
    const categoria = buildCategoriaSelect();
    const baseImponible = buildField("Base imponible (€)", "input", { type: "number", min: "0", step: "0.01", value: "0" });
    const ivaPct = buildField("IVA (%)", "input", { type: "number", min: "0", step: "1", value: "21" });
    const importeIva = buildField("Importe IVA (€)", "input", { type: "number", readOnly: true, disabled: true });
    importeIva.input.classList.add("ac-tarifa-readonly");
    const retencionPct = buildField("Retención (%)", "input", { type: "number", min: "0", step: "1", value: "0" });
    const importeRetencion = buildField("Importe retención (€)", "input", { type: "number", readOnly: true, disabled: true });
    importeRetencion.input.classList.add("ac-tarifa-readonly");
    const total = buildField("Total a pagar (€)", "input", { type: "number", readOnly: true, disabled: true });
    total.input.classList.add("ac-tarifa-readonly");
    const notas = buildField("Notas", "textarea", { rows: 2 });

    function refreshCalculo() {
      const { ivaImporte, retencionImporte, total: totalCalc } = calcGasto({
        baseImponible: baseImponible.input.value,
        ivaPct: ivaPct.input.value,
        retencionPct: retencionPct.input.value,
      });
      importeIva.input.value = ivaImporte.toFixed(2);
      importeRetencion.input.value = retencionImporte.toFixed(2);
      total.input.value = totalCalc.toFixed(2);
    }
    [baseImponible, ivaPct, retencionPct].forEach((f) => f.input.addEventListener("input", refreshCalculo));
    refreshCalculo();

    // Solo se rellenan los campos editables del formulario; importe_iva/
    // importe_retencion/total_a_pagar que también devuelve el OCR no se
    // usan directamente porque esos tres son siempre calculados
    // (refreshCalculo) a partir de base/IVA%/retención%, nunca editables.
    const upload = buildGastoUpload({
      onExtraido: (datos) => {
        if (datos.fecha) fecha.input.value = datos.fecha;
        if (datos.proveedor) proveedor.input.value = datos.proveedor;
        if (datos.cif) cif.input.value = datos.cif;
        if (datos.concepto) concepto.input.value = datos.concepto;
        if (datos.categoria && CATEGORIAS_GASTO.includes(datos.categoria)) categoria.input.value = datos.categoria;
        if (datos.base_imponible != null) baseImponible.input.value = datos.base_imponible;
        if (datos.iva_pct != null) ivaPct.input.value = datos.iva_pct;
        if (datos.retencion_pct != null) retencionPct.input.value = datos.retencion_pct;
        refreshCalculo();
      },
    });

    const fieldRow1 = document.createElement("div");
    fieldRow1.className = "ac-field-row";
    fieldRow1.append(fecha.wrap, proveedor.wrap);
    const fieldRow2 = document.createElement("div");
    fieldRow2.className = "ac-field-row";
    fieldRow2.append(cif.wrap, categoria.wrap);
    const fieldRow3 = document.createElement("div");
    fieldRow3.className = "ac-field-row";
    fieldRow3.append(baseImponible.wrap, ivaPct.wrap);
    const fieldRow4 = document.createElement("div");
    fieldRow4.className = "ac-field-row";
    fieldRow4.append(importeIva.wrap, retencionPct.wrap);

    body.append(
      fieldRow1, concepto.wrap, fieldRow2, fieldRow3, fieldRow4,
      importeRetencion.wrap, total.wrap, notas.wrap
    );

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";

    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ac-btn ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", close);
    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";
    const guardarBtn = document.createElement("button");
    guardarBtn.type = "button";
    guardarBtn.className = "ac-btn primary";
    guardarBtn.textContent = "Guardar gasto";
    guardarBtn.addEventListener("click", async () => {
      if (!proveedor.input.value.trim() || !concepto.input.value.trim()) {
        msg.textContent = "Proveedor y concepto son obligatorios.";
        msg.className = "ac-drawer-msg error";
        return;
      }
      guardarBtn.disabled = true;
      msg.textContent = "";
      try {
        await onGuardar({
          fecha: fecha.input.value,
          proveedor: proveedor.input.value.trim(),
          concepto: concepto.input.value.trim(),
          cif: cif.input.value.trim(),
          categoria: categoria.input.value,
          base_imponible: Number(baseImponible.input.value) || 0,
          iva_pct: Number(ivaPct.input.value) || 0,
          retencion_pct: Number(retencionPct.input.value) || 0,
          notas: notas.input.value.trim(),
        });
        close();
      } catch (err) {
        msg.textContent = err.message || "No se pudo guardar el gasto.";
        msg.className = "ac-drawer-msg error";
        guardarBtn.disabled = false;
      }
    });
    right.appendChild(guardarBtn);
    foot.append(cancelBtn, right);

    drawer.append(head, upload, body, msg, foot);
  }

  function open() {
    render();
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  return { open, close };
}
