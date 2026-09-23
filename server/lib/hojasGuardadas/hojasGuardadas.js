import { prefijoDelDia, siguienteCodigo } from "./codigoDelDia.js";

// LAS HOJAS GUARDADAS (migración 129): guardar la que se va a imprimir, la
// lista de las últimas de un profesor y abrir una.
//
// `admin` es el cliente de Supabase con la clave de servicio: el acceso lo
// decide la ruta (rol y centro), como en el resto del backend.

// Dos profesores del mismo centro imprimiendo en el mismo segundo pueden
// calcular el mismo código; la base de datos lo impide (código único por
// centro) y se reintenta con el siguiente.
export const REINTENTOS = 5;
const DUPLICADO = "23505";

export async function guardaHoja({ admin, tenantId, userId, hoja, huecos, parametros, ahora = new Date() }) {
  for (let intento = 0; intento < REINTENTOS; intento += 1) {
    const { data: deHoy, error: errLista } = await admin
      .from("contenido_hojas")
      .select("codigo")
      .eq("tenant_id", tenantId)
      .like("codigo", `${prefijoDelDia(ahora)}%`);
    if (errLista) throw errLista;
    const codigo = siguienteCodigo((deHoy || []).map((f) => f.codigo), ahora);
    const fila = {
      tenant_id: tenantId,
      codigo,
      tema_id: parametros?.temaId || null,
      objetivo: String(hoja.objetivo || "Hoja de ejercicios").slice(0, 300),
      materia: String(hoja.materia || ""),
      curso: String(hoja.curso || ""),
      tema: String(hoja.tema || ""),
      centro: String(hoja.centro || ""),
      creada_por: userId,
      contenido: { ...hoja, codigo },
      huecos,
      parametros,
    };
    const { data, error } = await admin.from("contenido_hojas").insert(fila).select("id, codigo, created_at").single();
    if (!error) return data;
    if (error.code !== DUPLICADO) throw error;
  }
  throw new Error("no se pudo reservar un código para la hoja");
}

export const RECIENTES = 12;

export async function hojasRecientes({ admin, tenantId, userId, limite = RECIENTES }) {
  const { data, error } = await admin
    .from("contenido_hojas")
    .select("id, codigo, objetivo, tema, curso, materia, created_at")
    .eq("tenant_id", tenantId)
    .eq("creada_por", userId)
    .not("contenido", "is", null)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

// Una hoja del centro. No hace falta que sea del mismo profesor: el código
// va impreso y cualquier profesor del centro puede tener la hoja en la mano.
export async function abreHoja({ admin, tenantId, id }) {
  const { data, error } = await admin
    .from("contenido_hojas")
    .select("id, codigo, contenido, huecos, parametros, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data && data.contenido ? data : null;
}
