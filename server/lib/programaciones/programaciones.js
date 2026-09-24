import { z } from "zod";

// LAS PROGRAMACIONES GUARDADAS (migración 130): la forma de `datos`, y
// listar, crear, leer, guardar y borrar las de un profesor.
//
// `admin` es el cliente de Supabase con la clave de servicio: el acceso lo
// deciden las rutas (rol y centro). Un profesor ve y toca SOLO las suyas:
// la programación es su documento de trabajo hasta que la entrega.
const Unidad = z.object({
  id: z.string().max(40),
  titulo: z.string().max(200),
  trimestre: z.number().int().min(1).max(3),
  sesiones: z.number().int().min(0).max(300),
  saberes: z.array(z.string().max(40)).max(400),
  criterios: z.array(z.string().max(20)).max(200),
});

export const DatosSchema = z.object({
  variante: z.string().max(200).nullable().optional(),
  sesionesSemanales: z.number().int().min(0).max(20).nullable().optional(),
  semanas: z.number().int().min(1).max(45).optional(),
  unidades: z.array(Unidad).max(40).optional(),
  pesos: z.record(z.string().max(30), z.number().min(0).max(100)).optional(),
  textos: z.record(z.string().max(2), z.string().max(20000)).optional(),
}).strict();

export const CabeceraSchema = z.object({
  materia_slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  curso: z.number().int().min(1).max(4).nullable(),
  titulo: z.string().max(200),
});

export const MAX_BYTES = 400 * 1024;

const COLUMNAS_LISTA = "id, materia_slug, curso, titulo, updated_at";

export async function misProgramaciones({ admin, tenantId, userId }) {
  const { data, error } = await admin
    .from("programaciones")
    .select(COLUMNAS_LISTA)
    .eq("tenant_id", tenantId)
    .eq("creada_por", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function creaProgramacion({ admin, tenantId, userId, cabecera, datos }) {
  const { data, error } = await admin
    .from("programaciones")
    .insert({ tenant_id: tenantId, creada_por: userId, ...cabecera, datos })
    .select(`${COLUMNAS_LISTA}, datos`)
    .single();
  if (error) throw error;
  return data;
}

// Leer y guardar exigen que sea del profesor Y del centro.
export async function leeProgramacion({ admin, tenantId, userId, id }) {
  const { data, error } = await admin
    .from("programaciones")
    .select(`${COLUMNAS_LISTA}, datos`)
    .eq("tenant_id", tenantId)
    .eq("creada_por", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function guardaProgramacion({ admin, tenantId, userId, id, titulo, datos, ahora = new Date() }) {
  const cambios = { datos, updated_at: ahora.toISOString() };
  if (typeof titulo === "string") cambios.titulo = titulo;
  const { data, error } = await admin
    .from("programaciones")
    .update(cambios)
    .eq("tenant_id", tenantId)
    .eq("creada_por", userId)
    .eq("id", id)
    .select(COLUMNAS_LISTA)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function borraProgramacion({ admin, tenantId, userId, id }) {
  const { data, error } = await admin
    .from("programaciones")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("creada_por", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
