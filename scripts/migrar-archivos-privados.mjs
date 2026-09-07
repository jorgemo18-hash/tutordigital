#!/usr/bin/env node
// scripts/migrar-archivos-privados.mjs — mueve al bucket privado las fichas
// de inscripción y las facturas que ya estaban subidas al bucket PÚBLICO.
//
// POR QUÉ. `academia-assets` es público: sus URL abren el archivo sin ningún
// login y no caducan nunca. Ahí dentro están las hojas de inscripción
// escaneadas —nombre del alumno menor, dirección, teléfonos de los padres— y
// las facturas del centro. Desde la migración 114 los archivos NUEVOS ya se
// suben al bucket privado `academia-documentos`; este script se ocupa de los
// que ya estaban. El logo y el fondo del centro se quedan donde están, y con
// razón: van incrustados en los correos a las familias.
//
// QUÉ HACE, por cada archivo:
//   1. lo copia de academia-assets a academia-documentos, misma ruta;
//   2. comprueba que la copia existe y pesa lo mismo que el original;
//   3. escribe la ruta en la columna nueva (ficha_path / foto_path);
//   4. borra el original del bucket público y vacía la columna vieja.
//
// El borrado va AL FINAL y solo si los tres pasos anteriores salieron bien.
// Un archivo duplicado unos minutos no le hace daño a nadie; uno borrado
// antes de estar copiado no vuelve.
//
// ES IDEMPOTENTE: se puede volver a ejecutar. Las filas que ya tienen ruta y
// no tienen URL vieja se saltan.
//
// USO:
//   node scripts/migrar-archivos-privados.mjs            # simulacro, no toca nada
//   node scripts/migrar-archivos-privados.mjs --aplicar  # lo hace de verdad
//
// REQUIERE en el entorno o en .env:
//   SUPABASE_URL                 https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    la service key (Project Settings → API)
//
// La service key es acceso total a la base de datos y al Storage: no se
// commitea, no se pega en un chat y no se deja en el portapapeles.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET_PUBLICO = "academia-assets";
const BUCKET_PRIVADO = "academia-documentos";

// Qué tablas migrar. Añadir aquí si algún día hay un tercer adjunto privado.
const TABLAS = [
  { tabla: "academia_alumnos", columnaUrl: "ficha_url", columnaPath: "ficha_path", carpeta: "fichas", que: "ficha" },
  { tabla: "academia_gastos", columnaUrl: "foto_url", columnaPath: "foto_path", carpeta: "gastos", que: "factura" },
];

const APLICAR = process.argv.includes("--aplicar");

// .env se lee a mano en vez de con dotenv: el proyecto no lo tiene como
// dependencia y este script se ejecuta suelto, no dentro del servidor.
function cargarEnv() {
  try {
    for (const linea of readFileSync(resolve(RAIZ, ".env"), "utf8").split("\n")) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const igual = limpia.indexOf("=");
      if (igual === -1) continue;
      const clave = limpia.slice(0, igual).trim();
      if (process.env[clave]) continue;
      process.env[clave] = limpia.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Sin .env no pasa nada: puede venir todo del entorno.
  }
}

// La ruta dentro del bucket, sacada de la URL pública guardada. La URL lleva
// un `?v=<timestamp>` que hay que quitar, y viene percent-encoded.
export function rutaDesdeUrlPublica(url, bucket = BUCKET_PUBLICO) {
  const texto = String(url || "");
  const marca = `/object/public/${bucket}/`;
  const desde = texto.indexOf(marca);
  if (desde === -1) return null;
  const cruda = texto.slice(desde + marca.length).split("?")[0];
  if (!cruda) return null;
  try {
    return decodeURIComponent(cruda);
  } catch {
    return cruda;
  }
}

function tamanoDe(entrada) {
  const bruto = entrada?.metadata?.size;
  return typeof bruto === "number" ? bruto : null;
}

async function tamanoEnBucket(admin, bucket, ruta) {
  const barra = ruta.lastIndexOf("/");
  const carpeta = barra === -1 ? "" : ruta.slice(0, barra);
  const nombre = barra === -1 ? ruta : ruta.slice(barra + 1);
  const { data, error } = await admin.storage.from(bucket).list(carpeta, { search: nombre, limit: 100 });
  if (error) return null;
  return tamanoDe((data || []).find((e) => e.name === nombre));
}

async function migrarFila(admin, cfg, fila, resumen) {
  const ruta = rutaDesdeUrlPublica(fila[cfg.columnaUrl]);
  if (!ruta) {
    console.log(`  ⚠ ${cfg.que} ${fila.id}: no se entiende la URL guardada, se deja como está`);
    resumen.raras += 1;
    return;
  }

  if (!APLICAR) {
    console.log(`  · ${cfg.que} ${fila.id}: ${ruta}`);
    resumen.movidos += 1;
    return;
  }

  const origen = await tamanoEnBucket(admin, BUCKET_PUBLICO, ruta);

  const { error: errCopia } = await admin.storage
    .from(BUCKET_PUBLICO)
    .copy(ruta, ruta, { destinationBucket: BUCKET_PRIVADO });
  // Un "ya existe" es la segunda pasada del script sobre el mismo archivo: no
  // es un fallo, se sigue y la comprobación de tamaño de abajo decide.
  if (errCopia && !/exist/i.test(errCopia.message || "")) {
    console.log(`  ✗ ${cfg.que} ${fila.id}: no se pudo copiar (${errCopia.message})`);
    resumen.fallidos += 1;
    return;
  }

  const destino = await tamanoEnBucket(admin, BUCKET_PRIVADO, ruta);
  if (destino === null || (origen !== null && destino !== origen)) {
    console.log(`  ✗ ${cfg.que} ${fila.id}: la copia no cuadra (${origen} → ${destino}). NO se borra el original.`);
    resumen.fallidos += 1;
    return;
  }

  const { error: errDb } = await admin
    .from(cfg.tabla)
    .update({ [cfg.columnaPath]: ruta, [cfg.columnaUrl]: null })
    .eq("id", fila.id);
  if (errDb) {
    console.log(`  ✗ ${cfg.que} ${fila.id}: copiado pero no se pudo guardar la ruta (${errDb.message})`);
    resumen.fallidos += 1;
    return;
  }

  const { error: errBorrado } = await admin.storage.from(BUCKET_PUBLICO).remove([ruta]);
  if (errBorrado) {
    // La fila ya apunta al privado, así que el panel funciona; lo que queda
    // es una copia pública viva. Hay que decirlo alto: es justo lo que este
    // script venía a quitar.
    console.log(`  ⚠ ${cfg.que} ${fila.id}: movido, pero el original PÚBLICO no se pudo borrar (${errBorrado.message})`);
    resumen.sinBorrar += 1;
    return;
  }

  console.log(`  ✓ ${cfg.que} ${fila.id}: ${ruta}`);
  resumen.movidos += 1;
}

async function migrarTabla(admin, cfg, resumen) {
  const { data, error } = await admin
    .from(cfg.tabla)
    .select(`id, ${cfg.columnaUrl}, ${cfg.columnaPath}`)
    .not(cfg.columnaUrl, "is", null);
  if (error) throw new Error(`No se pudo leer ${cfg.tabla}: ${error.message}`);

  const pendientes = (data || []).filter((f) => f[cfg.columnaUrl]);
  console.log(`\n${cfg.tabla}: ${pendientes.length} por mover`);
  for (const fila of pendientes) await migrarFila(admin, cfg, fila, resumen);
}

async function main() {
  cargarEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✗ Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (en el entorno o en .env).");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const resumen = { movidos: 0, fallidos: 0, raras: 0, sinBorrar: 0 };

  console.log(APLICAR
    ? `→ MOVIENDO de ${BUCKET_PUBLICO} (público) a ${BUCKET_PRIVADO} (privado)`
    : `→ SIMULACRO (nada se toca). Añade --aplicar para hacerlo de verdad.`);

  for (const cfg of TABLAS) await migrarTabla(admin, cfg, resumen);

  console.log("\n──────────────");
  console.log(`${APLICAR ? "Movidos" : "Se moverían"}: ${resumen.movidos}`);
  if (resumen.raras) console.log(`URL que no se entienden: ${resumen.raras}`);
  if (resumen.sinBorrar) console.log(`⚠ Movidos pero con copia PÚBLICA viva: ${resumen.sinBorrar}`);
  if (resumen.fallidos) console.log(`✗ Fallidos: ${resumen.fallidos}`);
  if (APLICAR && !resumen.fallidos && !resumen.sinBorrar) {
    console.log("\n✓ No queda ninguna ficha ni factura en el bucket público.");
  }
  process.exit(resumen.fallidos ? 1 : 0);
}

// Solo se ejecuta si se lanza directamente: importarlo desde un test no debe
// conectarse a nada (ver tests/academiaStorage/rutaDesdeUrlPublica.test.mjs).
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
