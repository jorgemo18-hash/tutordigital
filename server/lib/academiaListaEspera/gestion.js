// Alta, edición y baja de entradas de la lista de espera — sin las
// comprobaciones de invariantes que tiene gestion.js de
// academiaSustituciones (no hay solape ni estado que proteger aquí, es una
// lista simple de contactos).

// Los campos opcionales se guardan como null, nunca como cadena vacía: una
// cadena vacía se pinta como un contacto que "tiene" email y no lo tiene.
function oNull(valor) {
  const limpio = String(valor ?? "").trim();
  return limpio || null;
}

export async function crearEntradaListaEspera(admin, { tenantId, nombre, curso, telefono, email, notas }) {
  const { data, error } = await admin
    .from("academia_lista_espera")
    .insert({
      tenant_id: tenantId,
      nombre,
      curso: oNull(curso),
      telefono: oNull(telefono),
      email: oNull(email),
      notas: oNull(notas),
    })
    .select("id, nombre, curso, telefono, email, notas, created_at")
    .single();
  if (error) return { ok: false, code: "crear_failed", error };
  return { ok: true, entrada: data };
}

// Edición de una entrada ya existente. Sin esto, corregir un dígito de un
// teléfono obligaba a borrar y volver a escribir el contacto entero — y el
// borrado es definitivo, así que el camino para arreglar una errata pasaba
// por destruir el dato.
//
// Solo se tocan los campos presentes en `cambios`: un PATCH parcial no
// puede vaciar en silencio lo que el llamador no ha mencionado. `nombre`
// es el único que no admite quedarse vacío (es lo que identifica la fila
// en la tabla), y por eso lo valida el esquema de la ruta antes de llegar
// aquí.
const CAMPOS_EDITABLES = ["nombre", "curso", "telefono", "email", "notas"];

export async function actualizarEntradaListaEspera(admin, { tenantId, id, cambios = {} }) {
  const parche = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in cambios)) continue;
    parche[campo] = campo === "nombre" ? String(cambios.nombre).trim() : oNull(cambios[campo]);
  }
  if (!Object.keys(parche).length) return { ok: false, code: "sin_cambios" };

  const { data, error } = await admin
    .from("academia_lista_espera")
    .update(parche)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, nombre, curso, telefono, email, notas, created_at")
    .maybeSingle();
  if (error) return { ok: false, code: "actualizar_failed", error };
  if (!data) return { ok: false, code: "not_found" };
  return { ok: true, entrada: data };
}

// DELETE real (no hay histórico/auditoría que preservar aquí, a
// diferencia de revocarSustitucion) — .select().maybeSingle() tras el
// delete para distinguir "no existía en este tenant" de un error real.
export async function eliminarEntradaListaEspera(admin, { tenantId, id }) {
  const { data, error } = await admin
    .from("academia_lista_espera")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, code: "eliminar_failed", error };
  if (!data) return { ok: false, code: "not_found" };
  return { ok: true };
}
