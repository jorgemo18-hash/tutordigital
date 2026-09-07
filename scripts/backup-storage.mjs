#!/usr/bin/env node
// scripts/backup-storage.mjs — copia de seguridad de los ARCHIVOS.
//
// POR QUÉ EXISTE. `backup-db.sh` hace un pg_dump, y un pg_dump vuelca tablas
// de Postgres: los archivos de Supabase Storage NO están ahí. Y son 135 MB
// que duelen: las 38 fichas de inscripción en papel escaneadas, las facturas
// del centro, el logo y los PDF generados. Si el proyecto de Supabase se cae,
// se borra un bucket por error o se acaba el plan gratuito, la base de datos
// vuelve entera y los archivos no vuelven.
//
// CÓMO FUNCIONA. Mantiene un ESPEJO en <destino>/storage/<bucket>/<ruta> y
// baja solo lo que falta o ha cambiado (ver lib/storageEspejo.mjs). La
// primera vez baja los 135 MB; a partir de ahí, unos pocos archivos nuevos.
//
// LO QUE SE BORRA EN SUPABASE NO SE BORRA AQUÍ, a propósito: es una copia de
// seguridad. Si alguien borra una ficha por error, el espejo la conserva. Se
// listan aparte como "solo en la copia" para que se vea que sobran, no que
// faltan.
//
// SE COPIAN TODOS LOS BUCKETS, incluida la caché de documentos generados.
// Una lista de exclusiones es una cosa más que alguien olvida actualizar el
// día que se añade un bucket nuevo, y ese día el archivo nuevo se queda sin
// copia sin que nadie se entere. Sobra medio mega; compensa.
//
// USO:
//   node scripts/backup-storage.mjs
//   BACKUP_DEST_DIR=/Volumes/Disco node scripts/backup-storage.mjs
//
// REQUIERE SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (entorno o .env).
//
// ⚠ Lo que baja son datos personales de menores. La carpeta de copias tiene
// que estar en un volumen cifrado (FileVault) y nunca en una carpeta
// sincronizada sin cifrar a un servicio de terceros.

import { mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";
import { cargarEnv, credencialesSupabase } from "./lib/cargarEnv.mjs";
import { rutaLocalDe, hayQueDescargar, estadoLocal, listarBucketEntero } from "./lib/storageEspejo.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = `${process.env.BACKUP_DEST_DIR || `${homedir()}/tutordigital-backups`}/storage`;

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function descargar(admin, bucket, objeto, resumen) {
  const local = rutaLocalDe(DESTINO, bucket, objeto.ruta);
  const previo = estadoLocal(local);

  if (!hayQueDescargar({ local: previo, bytesRemotos: objeto.bytes, actualizadoRemoto: objeto.actualizado })) {
    resumen.yaEstaban += 1;
    return;
  }

  const { data, error } = await admin.storage.from(bucket).download(objeto.ruta);
  if (error || !data) {
    console.log(`  ✗ ${bucket}/${objeto.ruta}: ${error?.message || "no se pudo descargar"}`);
    resumen.fallidos += 1;
    return;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  // Se comprueba lo que ha llegado ANTES de escribir: una descarga cortada a
  // medias escrita encima de la copia buena deja la copia rota, y eso no se
  // nota hasta el día que hace falta restaurarla.
  if (typeof objeto.bytes === "number" && buffer.length !== objeto.bytes) {
    console.log(`  ✗ ${bucket}/${objeto.ruta}: llegaron ${buffer.length} de ${objeto.bytes} bytes, no se guarda`);
    resumen.fallidos += 1;
    return;
  }

  mkdirSync(dirname(local), { recursive: true });
  writeFileSync(local, buffer);

  // La fecha del archivo local pasa a ser la del remoto: así el propio
  // sistema de archivos hace de registro y la próxima ejecución sabe que
  // esta copia ya está al día, sin manifiesto aparte.
  if (objeto.actualizado) {
    const fecha = new Date(objeto.actualizado);
    if (!Number.isNaN(fecha.getTime())) utimesSync(local, fecha, fecha);
  }

  resumen.bajados += 1;
  resumen.bytes += buffer.length;
}

// Los archivos que están en la copia y ya no en Supabase. No se borran; se
// cuentan y se dejan en el manifiesto, que es lo que convierte "sobran" en
// información en vez de en una sorpresa.
function escribirManifiesto(porBucket) {
  const lineas = ["bucket\truta\tbytes\tactualizado"];
  for (const [bucket, objetos] of porBucket) {
    for (const o of objetos) lineas.push(`${bucket}\t${o.ruta}\t${o.bytes ?? ""}\t${o.actualizado ?? ""}`);
  }
  mkdirSync(DESTINO, { recursive: true });
  writeFileSync(`${DESTINO}/MANIFIESTO.tsv`, `${lineas.join("\n")}\n`);
}

async function main() {
  cargarEnv(resolve(RAIZ, ".env"));
  const cred = credencialesSupabase();
  if (!cred.ok) {
    console.error(`✗ ${cred.motivo}`);
    process.exit(1);
  }

  const admin = createClient(cred.url, cred.key, { auth: { persistSession: false } });

  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) {
    console.error(`✗ No se pudieron listar los buckets: ${error.message}`);
    process.exit(1);
  }
  if (!buckets?.length) {
    console.error("✗ Supabase no devolvió ningún bucket. Con la service key debería devolverlos todos: algo va mal.");
    process.exit(1);
  }

  console.log(`→ Espejo de Storage en ${DESTINO}`);
  const resumen = { bajados: 0, yaEstaban: 0, fallidos: 0, bytes: 0 };
  const porBucket = new Map();

  for (const bucket of buckets) {
    const listado = await listarBucketEntero(admin, bucket.name);
    if (!listado.ok) {
      console.error(`✗ No se pudo listar ${bucket.name}: ${listado.motivo}`);
      resumen.fallidos += 1;
      continue;
    }
    porBucket.set(bucket.name, listado.objetos);
    console.log(`\n${bucket.name}${bucket.public ? " (público)" : ""}: ${listado.objetos.length} archivo(s)`);
    for (const objeto of listado.objetos) await descargar(admin, bucket.name, objeto, resumen);
  }

  escribirManifiesto(porBucket);

  console.log("\n──────────────");
  console.log(`Bajados ahora: ${resumen.bajados} (${mb(resumen.bytes)})`);
  console.log(`Ya estaban al día: ${resumen.yaEstaban}`);
  if (resumen.fallidos) console.log(`✗ Fallidos: ${resumen.fallidos}`);
  console.log(`Manifiesto: ${DESTINO}/MANIFIESTO.tsv`);

  if (resumen.fallidos) {
    console.error("\n✗ La copia de los archivos está INCOMPLETA.");
    process.exit(1);
  }
  console.log("\n✓ Archivos al día.");
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
