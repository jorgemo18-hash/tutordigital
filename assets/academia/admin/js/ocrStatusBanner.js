// Banner de estado compartido por cualquier subida con OCR (ficha de
// inscripción, factura de gasto...) — antes vivía duplicado dentro de
// cada componente de subida.
const DEFAULTS = {
  successText: "✓ Datos extraídos — revisa y completa antes de guardar",
  errorText: "No se pudieron extraer los datos — rellena manualmente",
};

export function setOcrStatus(el, mode, { successText = DEFAULTS.successText, errorText = DEFAULTS.errorText } = {}) {
  el.innerHTML = "";
  if (mode === "hidden") {
    el.className = "hidden";
    return;
  }
  if (mode === "loading") {
    el.className = "ac-banner amber";
    const spinner = document.createElement("span");
    spinner.className = "ac-spinner";
    el.append(spinner, document.createTextNode(" Extrayendo datos…"));
    return;
  }
  if (mode === "success") {
    el.className = "ac-banner green";
    el.textContent = successText;
    return;
  }
  el.className = "ac-banner red";
  el.textContent = errorText;
}
