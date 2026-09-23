import { CURSOS, nivelDeCurso, nivelInfo } from "../curso.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildField(label, attrs = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";
  const labelEl = document.createElement("label");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  wrap.appendChild(labelEl);
  const input = document.createElement("input");
  input.className = "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

// Sección "Datos del alumno": nombre, curso, fecha de alta, nivel (badge en
// vivo) y contacto del propio alumno (email/teléfono/dirección/ciudad/CP) —
// columnas propias en academia_alumnos, independientes de la familia.
export function buildDatosSection({
  nombre = "", curso = "", fechaAlta = "", codigo = "",
  email = "", telefono = "", direccion = "", ciudad = "", codigoPostal = "",
  onEmailChange,
} = {}) {
  const wrap = document.createElement("div");

  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "DATOS DEL ALUMNO";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const nombreField = buildField("Nombre", { type: "text", value: nombre, placeholder: "Nombre del alumno" });
  wrap.appendChild(nombreField.wrap);

  const cursoRow = document.createElement("div");
  cursoRow.className = "ac-field-row";

  const cursoField = document.createElement("div");
  cursoField.className = "ac-field";
  const cursoLabel = document.createElement("label");
  cursoLabel.className = "ac-field-label";
  cursoLabel.textContent = "Curso";
  const cursoSelect = document.createElement("select");
  cursoSelect.className = "ac-select";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Selecciona…";
  cursoSelect.appendChild(blank);
  for (const c of CURSOS) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    cursoSelect.appendChild(opt);
  }
  cursoSelect.value = curso;
  cursoField.append(cursoLabel, cursoSelect);

  const nivelField = document.createElement("div");
  nivelField.className = "ac-field";
  const nivelLabel = document.createElement("label");
  nivelLabel.className = "ac-field-label";
  nivelLabel.textContent = "Nivel";
  const nivelBadgeWrap = document.createElement("div");
  nivelBadgeWrap.style.paddingTop = "8px";
  const nivelBadge = document.createElement("span");
  nivelBadgeWrap.appendChild(nivelBadge);
  nivelField.append(nivelLabel, nivelBadgeWrap);

  function refreshNivel() {
    const nivel = nivelDeCurso(cursoSelect.value);
    const info = nivelInfo(nivel);
    nivelBadge.className = `ac-lv ${info.cls}`;
    nivelBadge.textContent = nivel ? info.label : "—";
  }
  cursoSelect.addEventListener("change", refreshNivel);
  refreshNivel();

  cursoRow.append(cursoField, nivelField);
  wrap.appendChild(cursoRow);

  // EL CÓDIGO VA AL LADO DE LA FECHA DE ALTA y no en el bloque de contacto:
  // no es un dato del alumno como persona, es cómo lo llama la academia en su
  // contabilidad. La ayuda debajo dice para qué sirve, porque un campo
  // llamado "código" sin más se confunde con el código de acceso del alumno,
  // que es otra cosa y la genera el programa.
  const altaRow = document.createElement("div");
  altaRow.className = "ac-field-row";
  const fechaField = buildField("Fecha de alta", { type: "date", value: fechaAlta || todayISO() });
  const codigoField = buildField("Código de alumno", {
    type: "text",
    value: codigo,
    placeholder: "El de tus cobros",
  });
  // `ac-field-hint` es la clase que ya usa el resto del drawer, con su
  // variante `--error`: aquí sirve para las dos cosas, la explicación y el
  // aviso de código repetido que devuelve el backend.
  const codigoHint = document.createElement("div");
  codigoHint.className = "ac-field-hint";
  const AYUDA_CODIGO = "Para identificarlo en el banco. Opcional.";
  codigoHint.textContent = AYUDA_CODIGO;
  codigoField.wrap.appendChild(codigoHint);
  altaRow.append(fechaField.wrap, codigoField.wrap);
  wrap.appendChild(altaRow);

  const contactoRow1 = document.createElement("div");
  contactoRow1.className = "ac-field-row";
  const emailField = buildField("Email", { type: "email", value: email });
  const telefonoField = buildField("Teléfono", { type: "text", value: telefono });
  contactoRow1.append(emailField.wrap, telefonoField.wrap);
  wrap.appendChild(contactoRow1);

  // El botón "Guardar" del pie (alumno nuevo, ver alumnoDrawerFoot.js) pasa
  // a "Guardar y enviar acceso" en cuanto hay email — tanto si lo escribe
  // el admin como si llega de prefillContacto() (la familia elegida ya
  // tenía uno).
  if (onEmailChange) {
    emailField.input.addEventListener("input", () => onEmailChange(emailField.input.value.trim()));
  }

  const direccionField = buildField("Dirección", { type: "text", value: direccion });
  wrap.appendChild(direccionField.wrap);

  const contactoRow2 = document.createElement("div");
  contactoRow2.className = "ac-field-row";
  const ciudadField = buildField("Ciudad", { type: "text", value: ciudad });
  const codigoPostalField = buildField("Código postal", { type: "text", value: codigoPostal });
  contactoRow2.append(ciudadField.wrap, codigoPostalField.wrap);
  wrap.appendChild(contactoRow2);

  return {
    wrap,
    // AVISA DE QUE EL CÓDIGO YA ESTÁ EN OTRO ALUMNO. Lo detecta la base de
    // datos (índice único por centro, migración 124) y el backend lo
    // traduce; aquí solo se pinta, junto al campo que hay que corregir. Un
    // toast genérico obligaría a adivinar cuál de los campos es.
    marcarCodigoRepetido(mensaje) {
      codigoField.input.classList.add("ac-input-amber");
      codigoHint.classList.add("ac-field-hint--error");
      codigoHint.textContent = mensaje || "Ese código ya es de otro alumno.";
      codigoField.input.focus();
    },
    getValue: () => ({
      nombre: nombreField.input.value.trim(),
      curso: cursoSelect.value,
      fecha_alta: fechaField.input.value || todayISO(),
      // "" a null: dos alumnos con código vacío NO son un choque, y el
      // índice único solo mira los que tienen código. Mandando "" el
      // segundo alumno sin código chocaría con el primero.
      codigo: codigoField.input.value.trim() || null,
      email: emailField.input.value.trim() || null,
      telefono: telefonoField.input.value.trim() || null,
      direccion: direccionField.input.value.trim() || null,
      ciudad: ciudadField.input.value.trim() || null,
      codigo_postal: codigoPostalField.input.value.trim() || null,
    }),
    // Aplica datos extraídos por OCR. Si el curso no coincide con ninguna
    // opción del select, se deja vacío y el campo se marca en ámbar para
    // que el admin lo complete a mano. Un campo vacío en el OCR no borra
    // lo que ya hubiera escrito el admin.
    setFromOcr({ nombre: n, curso, email, telefono, direccion, ciudad, codigo_postal } = {}) {
      if (n) nombreField.input.value = n;
      // El código NO se lee de la ficha y no es un olvido: es un dato de la
      // contabilidad de la academia, no de la hoja que firma la familia.
      codigoField.input.classList.remove("ac-input-amber");
      codigoHint.classList.remove("ac-field-hint--error");
      codigoHint.textContent = AYUDA_CODIGO;
      cursoSelect.classList.remove("ac-input-amber");
      if (curso && CURSOS.includes(curso)) {
        cursoSelect.value = curso;
      } else if (curso) {
        cursoSelect.value = "";
        cursoSelect.classList.add("ac-input-amber");
      }
      // El email del alumno es obligatorio para guardar el alta (ver
      // academiaAlumnoSchemas.js) y la ficha lo pide, pero el OCR lo
      // extraía y se descartaba aquí: había que teclearlo a mano en cada
      // alumno. onEmailChange avisa al pie del drawer para que el botón
      // pase a "Guardar y enviar acceso", igual que si lo escribiera el
      // admin.
      if (email) {
        emailField.input.value = email;
        onEmailChange?.(email.trim());
      }
      if (telefono) telefonoField.input.value = telefono;
      if (direccion) direccionField.input.value = direccion;
      if (ciudad) ciudadField.input.value = ciudad;
      if (codigo_postal) codigoPostalField.input.value = codigo_postal;
      refreshNivel();
    },
    // A diferencia de setFromOcr (que no borra lo ya escrito), esto
    // REEMPLAZA el contacto por el de la familia recién elegida en el
    // selector — o lo vacía si se pasa {} (p.ej. al elegir "Crear familia
    // nueva"). El admin puede seguir editando después.
    prefillContacto({ email, telefono, direccion, ciudad, codigo_postal } = {}) {
      emailField.input.value = email || "";
      telefonoField.input.value = telefono || "";
      direccionField.input.value = direccion || "";
      ciudadField.input.value = ciudad || "";
      codigoPostalField.input.value = codigo_postal || "";
      onEmailChange?.(emailField.input.value.trim());
    },
  };
}
