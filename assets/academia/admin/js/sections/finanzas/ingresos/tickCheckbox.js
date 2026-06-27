import { marcarReciboPagado, marcarReciboPendiente } from "../../../apiFinanzas.js";

// Checkbox compartido por "Pendientes" (lista por método de pago) e
// "Historial" (grid anual): marcado = pagado, desmarcado = pendiente/
// enviado (clicable, alterna), sin recibo = deshabilitado. El click llama
// a marcar-pagado/pendiente sobre `reciboId` y avisa a `onCambiado` para
// que el llamador decida cómo refrescarse — este helper no sabe si está
// dentro de una tabla o de una lista.
export function buildTickCheckbox({ reciboId, estado, onCambiado }) {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = estado === "pagado";
  checkbox.disabled = !reciboId;
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      if (checkbox.checked) await marcarReciboPagado(reciboId);
      else await marcarReciboPendiente(reciboId);
      await onCambiado();
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      window.alert(err.message || "No se pudo actualizar el recibo.");
      checkbox.disabled = false;
    }
  });
  return checkbox;
}
