#!/usr/bin/env node
// scripts/migrar-archivos-privados.mjs — vacía el bucket PÚBLICO de fichas de
// inscripción y facturas, y las deja en el privado.
//
// POR QUÉ. `academia-assets` es público: sus URL abren el archivo sin ningún
// login y no caducan nunca. Ahí dentro estaban las hojas de inscripción
// escaneadas —nombre del alumno menor, dirección, teléfonos de los padres— y
// las facturas del centro. Desde la migración 114 los archivos NUEVOS ya se
// suben al bucket privado `academia-documentos`; este script se ocupa de los
// que ya estaban. El logo y el fondo del centro se quedan donde están, y con
// razón: van incrustados en los correos a las familias.
//
// DOS PASADAS, y la segunda no sobra:
//
//   1. LAS QUE TIENEN FILA. Se recorren academia_alumnos.ficha_url y
//      academia_gastos.foto_url, se mueve el archivo y se escribe la ruta en
//      la columna nueva.
//   2. LAS HUÉRFANAS. En el bucket público quedan archivos que NO tiene
//      ninguna fila: los dejó el flujo viejo de gastos, que subía la foto con
//      un id inventado antes de crear el gasto. Son invisibles desde el panel
//      —nadie los va a echar de menos— pero siguen siendo públicos, que es
//      justo lo que hay que quitar. La primera pasada sola dejaba 12 en
//      producción (07/09) y el script decía que había terminado.
//
// No se BORRAN los huérfanos, se mueven: alguno puede ser el justificante de
// un gasto que sí existe pero se quedó sin foto adjunta, y esos hay que
// conservarlos seis años (Código de Comercio, art. 30).
//
// ES IDEMPOTENTE: se puede volver a ejecutar.
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
import {
  rutaDesdeUrlPublica, esCarpeta, listarObjetos, moverObjeto, borrarObjeto,
} from "./lib/storageMover.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET_PUBLICO = "academia-assets";
const BUCKET_PRIVADO = "academia-documentos";

// Las carpetas del bucket público que NO pueden seguir siendo públicas. El
// logo y el fondo del centro no están aquí a propósito.
const CARPETAS_PRIVADAS = ["fichas", "gastos"];

const TABLAS = [
  { tabla: "academia_alumnos", columnaUrl: "ficha_url", columnaPath: "ficha_path", que: "ficha" },
  { tabla: "academia_gastos", columnaUrl: "foto_url", columnaPath: "foto_path", que: "factura" },
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

// Mueve un archivo y cuenta el resultado. Compartido por las dos pasadas:
// `alTerminar` es lo único que cambia (la primera escribe la ruta en su fila,
// la segunda no tiene fila que tocar).
async function moverYContar(admin, { ruta, etiqueta, resumen, alTerminar = null }) {
  const resultado = await moverObjeto(admin, { origen: BUCKET_PUBLICO, destino: BUCKET_PRIVADO, ruta });
  if (resultado.estado === "fallo") {
    console.log(`  ✗ ${etiqueta}: ${resultado.motivo}`);
    resumen.fallidos += 1;
    return;
  }

  if (alTerminar) {
    const guardado = await alTerminar();
    if (!guardado.ok) {
      console.log(`  ✗ ${etiqueta}: copiado pero no se pudo guardar la ruta (${guardado.motivo})`);
      resumen.fallidos += 1;
      return;
    }
  }

  const borrado = await borrarObjeto(admin, BUCKET_PUBLICO, ruta);
  if (!borrado.ok) {
    console.log(`  ⚠ ${etiqueta}: movido, pero el original PÚBLICO no se pudo borrar (${borrado.motivo})`);
    resumen.sinBorrar += 1;
    return;
  }

  console.log(`  ✓ ${etiqueta}: ${ruta}`);
  resumen.movidos += 1;
}

// ── Pasada 1: los archivos que tienen fila ────────────────────────────────

async function migrarTabla(admin, cfg, resumen) {
  const { data, error } = await admin
    .from(cfg.tabla)
    .select(`id, ${cfg.columnaUrl}, ${cfg.columnaPath}`)
    .not(cfg.columnaUrl, "is", null);
  if (error) throw new Error(`No se pudo leer ${cfg.tabla}: ${error.message}`);

  const pendientes = (data || []).filter((f) => f[cfg.columnaUrl]);
  console.log(`\n${cfg.tabla}: ${pendientes.length} por mover`);

  for (const fila of pendientes) {
    const ruta = rutaDesdeUrlPublica(fila[cfg.columnaUrl], BUCKET_PUBLICO);
    if (!ruta) {
      console.log(`  ⚠ ${cfg.que} ${fila.id}: no se entiende la URL guardada, se deja como está`);
      resumen.raras += 1;
      continue;
    }
    if (!APLICAR) {
      console.log(`  · ${cfg.que} ${fila.id}: ${ruta}`);
      resumen.movidos += 1;
      continue;
    }
    await moverYContar(admin, {
      ruta,
      etiqueta: `${cfg.que} ${fila.id}`,
      resumen,
      alTerminar: async () => {
        const { error: errDb } = await admin
          .from(cfg.tabla)
          .update({ [cfg.columnaPath]: ruta, [cfg.columnaUrl]: null })
          .eq("id", fila.id);
        return errDb ? { ok: false, motivo: errDb.message } : { ok: true };
      },
    });
  }
}

// ── Pasada 2: lo que queda suelto en el bucket público ────────────────────

async function rutasSueltas(admin) {
  const raiz = await listarObjetos(admin, BUCKET_PUBLICO, "");
  if (!raiz.ok) throw new Error(`No se pudo listar ${BUCKET_PUBLICO}: ${raiz.motivo}`);

  const rutas = [];
  for (const entrada of raiz.entradas) {
    // En la raíz del bucket cada carpeta es un tenant; los archivos sueltos
    // (logo.png, bg.jpg) se ignoran, que son justo los que SÍ son públicos.
    if (!esCarpeta(entrada)) continue;
    for (const carpeta of CARPETAS_PRIVADAS) {
      const prefijo = `${entrada.name}/${carpeta}`;
      const listado = await listarObjetos(admin, BUCKET_PUBLICO, prefijo);
      if (!listado.ok) throw new Error(`No se pudo listar ${prefijo}: ${listado.motivo}`);
      for (const objeto of listado.entradas) {
        if (esCarpeta(objeto)) continue;
        rutas.push(`${prefijo}/${objeto.name}`);
      }
    }
  }
  return rutas;
}

async function barrerSueltos(admin, resumen) {
  const rutas = await rutasSueltas(admin);
  console.log(`\nsueltos en el bucket público (sin fila que los apunte): ${rutas.length}`);
  for (const ruta of rutas) {
    if (!APLICAR) {
      console.log(`  · ${ruta}`);
      resumen.movidos += 1;
      continue;
    }
    await moverYContar(admin, { ruta, etiqueta: "suelto", resumen });
  }
  return rutas.length;
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
    : "→ SIMULACRO (nada se toca). Añade --aplicar para hacerlo de verdad.");

  for (const cfg of TABLAS) await migrarTabla(admin, cfg, resumen);
  await barrerSueltos(admin, resumen);

  console.log("\n──────────────");
  console.log(`${APLICAR ? "Movidos" : "Se moverían"}: ${resumen.movidos}`);
  if (resumen.raras) console.log(`URL que no se entienden: ${resumen.raras}`);
  if (resumen.sinBorrar) console.log(`⚠ Movidos pero con copia PÚBLICA viva: ${resumen.sinBorrar}`);
  if (resumen.fallidos) console.log(`✗ Fallidos: ${resumen.fallidos}`);

  // El "ya está" se comprueba VOLVIENDO A MIRAR el bucket, no dando por
  // buena la cuenta de arriba. La versión anterior de este script anunciaba
  // que no quedaba nada sabiendo solo de los archivos con fila, y dejó 12
  // facturas públicas diciendo que había terminado.
  if (APLICAR) {
    const quedan = await rutasSueltas(admin);
    if (quedan.length === 0 && !resumen.fallidos) {
      console.log(`\n✓ Comprobado: en ${BUCKET_PUBLICO} no queda ninguna ficha ni factura.`);
    } else if (quedan.length) {
      console.log(`\n⚠ Siguen en el bucket público ${quedan.length} archivo(s). Vuelve a ejecutarlo.`);
    }
  }

  process.exit(resumen.fallidos ? 1 : 0);
}

// Solo se ejecuta si se lanza directamente: importarlo desde un test no debe
// conectarse a nada.
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
