// Manipulación de UI pura del flujo home — reciben `dom` (o el elemento
// concreto) como parámetro explícito, sin cerrar sobre ningún estado propio.

export function show(el, visible) {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
}

export function setError(el, msg, requestId = "") {
  if (!el) return;
  el.textContent = "";
  if (msg) {
    el.append(document.createTextNode(msg));
    if (requestId) {
      const span = document.createElement("span");
      span.className = "errorRef";
      span.textContent = ` (ref: ${requestId})`;
      el.appendChild(span);
    }
  }
  el.style.display = msg ? "block" : "none";
}

export function extractRequestId(data) {
  return data?.requestId || data?.request_id || "";
}

export function showStep(dom, step) {
  show(dom.stepLogin, step === "login");
  show(dom.stepSignup, step === "signup");
  show(dom.stepReset, step === "reset");
  show(dom.stepTenantSelect, step === "tenant");
  show(dom.stepJoinTenant, step === "join");
  show(dom.stepRole, step === "role");
  show(dom.stepPendingApproval, step === "pending");
  if (dom.portalCard) {
    if (step === "join") dom.portalCard.classList.add("isJoinStep");
    else dom.portalCard.classList.remove("isJoinStep");
  }
}

export function populateStudentCourseSelect(dom) {
  const sel = dom.studentCourseSelect;
  if (!sel) return;
  if (sel.options && sel.options.length > 0) return;
  sel.innerHTML = `
    <option value="">Selecciona…</option>
    <optgroup label="Primaria">
      <option value="1P">1º Primaria</option><option value="2P">2º Primaria</option><option value="3P">3º Primaria</option>
      <option value="4P">4º Primaria</option><option value="5P">5º Primaria</option><option value="6P">6º Primaria</option>
    </optgroup>
    <optgroup label="ESO">
      <option value="1E">1º ESO</option><option value="2E">2º ESO</option><option value="3E">3º ESO</option><option value="4E">4º ESO</option>
    </optgroup>
    <optgroup label="Bachillerato">
      <option value="1B">1º Bachillerato</option><option value="2B">2º Bachillerato</option>
    </optgroup>
  `;
}
