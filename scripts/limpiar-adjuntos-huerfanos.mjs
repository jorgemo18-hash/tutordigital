#!/usr/bin/env node
// scripts/limpiar-adjuntos-huerfanos.mjs — los archivos de tareas que ya no
// tienen tarea.
//
// POR QUÉ (24/09/2026). En el bucket `task-attachments` había 87 archivos:
// 34 con fila de una tarea que ya no existe y 51 sin fila ninguna. Son
// enunciados y fotos de cuadernos de alumnos (menores) de abril a julio que
// nadie puede ver desde la app y que nada borraba. Desde el mismo día,
// borrar una tarea borra también sus archivos (borrarAdjuntosDeTarea.js);
// este script recoge lo que ya estaba y lo que deje algún camino futuro.
//
// Qué cuenta como huérfano:
//   1. una fila de `attachments` de una tarea que ya no existe (y su archivo);
//   2. un archivo del bucket que no nombra ninguna fila de `attachments` ni
//      de `session_attachments`, y que tiene más de un día (uno más reciente
//      puede ser una subida a medias).
//
// BORRAR ES DEFINITIVO. Por eso sin `--borrar` solo enseña qué hay. La
// decisión de borrar lo que ya está es de Jorge (fotos de menores sin plazo
// de conservación, frente a "por si acaso").
//
// USO:
//   node scripts/limpiar-adjuntos-huerfanos.mjs            # solo mira
//   node scripts/limpiar-adjuntos-huerfanos.mjs --borrar   # borra
//
// REQUIERE en el entorno o en .env: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// La service key no se commitea ni se pega en un chat.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { cargarEnv, credencialesSupabase } from "./lib/cargarEnv.mjs";
import { clasificarHuerfanos } from "./lib/adjuntosHuerfanos.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "task-attachments";
const BORRAR = process.argv.includes("--borrar");

async function todas(consulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < 1000) return filas;
  }
}

// El bucket es <centro>/<tarea>/<archivo>: tres niveles.
async function archivosDelBucket(admin) {
  const lista = async (ruta) => {
    const { data, error } = await admin.storage.from(BUCKET).list(ruta, { limit: 1000 });
    if (error) throw error;
    return data || [];
  };
  const archivos = [];
  for (const centro of await lista("")) {
    for (const tarea of await lista(centro.name)) {
      for (const a of await lista(`${centro.name}/${tarea.name}`)) {
        if (!a.id) continue; // una carpeta, no un archivo
        archivos.push({ ruta: `${centro.name}/${tarea.name}/${a.name}`, creado: a.created_at, bytes: a.metadata?.size || 0 });
      }
    }
  }
  return archivos;
}

async function main() {
  cargarEnv(resolve(RAIZ, ".env"));
  const cred = credencialesSupabase();
  if (!cred.ok) { console.error(cred.motivo); process.exit(1); }
  const admin = createClient(cred.url, cred.key, { auth: { persistSession: false } });

  const [adjuntos, deSesion, tareas, archivos] = await Promise.all([
    todas(() => admin.from("attachments").select("id, owner_id, storage_path, size, created_at").eq("owner_type", "task")),
    todas(() => admin.from("session_attachments").select("storage_path")),
    todas(() => admin.from("tasks").select("id")),
    archivosDelBucket(admin),
  ]);

  const r = clasificarHuerfanos({ adjuntos, deSesion, tareas, archivos, ahora: new Date() });
  const mb = (b) => (b / 1024 / 1024).toFixed(1);
  console.log(`Archivos en el bucket: ${archivos.length}`);
  console.log(`Filas de tareas que ya no existen: ${r.filas.length} (${mb(r.bytesFilas)} MB)`);
  console.log(`Archivos sin ninguna fila (de más de un día): ${r.sueltos.length} (${mb(r.bytesSueltos)} MB)`);
  if (r.desde) console.log(`Fechas: del ${r.desde.slice(0, 10)} al ${r.hasta.slice(0, 10)}`);

  if (!BORRAR) {
    console.log("\nNo se ha borrado nada. Para borrarlo: node scripts/limpiar-adjuntos-huerfanos.mjs --borrar");
    return;
  }
  const rutas = [...r.filas.map((f) => f.storage_path), ...r.sueltos.map((a) => a.ruta)].filter(Boolean);
  for (let i = 0; i < rutas.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(rutas.slice(i, i + 100));
    if (error) { console.error("No se pudieron borrar los archivos:", error.message); process.exit(1); }
  }
  const ids = r.filas.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await admin.from("attachments").delete().in("id", ids.slice(i, i + 100));
    if (error) { console.error("No se pudieron borrar las filas:", error.message); process.exit(1); }
  }
  console.log(`\nBorrados ${rutas.length} archivos y ${ids.length} filas.`);
}

main().catch((err) => { console.error(err?.message || err); process.exit(1); });
