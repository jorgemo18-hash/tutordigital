#!/usr/bin/env node
// scripts/avisar-backup.mjs — manda el correo del backup (ver
// scripts/lib/avisoDeBackup.mjs). Lo llama backup-db-programado.sh.
//
// USO:
//   node scripts/avisar-backup.mjs ok "12 copias en /Users/…/tutordigital-backups"
//   node scripts/avisar-backup.mjs fallo "pg_dump: connection refused"
//
// REQUIERE en el entorno o en .env: RESEND_API_KEY y BACKUP_AVISO_EMAIL (a
// quién). Opcional: BACKUP_AVISO_REMITENTE. Si faltan, lo dice y sale bien:
// un correo que no se puede mandar no debe tumbar la copia.
import { hostname } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cargarEnv } from "./lib/cargarEnv.mjs";
import { correoDeBackup, configuracionDelAviso, enviarCorreo, ESTADOS } from "./lib/avisoDeBackup.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
cargarEnv(resolve(RAIZ, ".env"));

const [estado, ...resto] = process.argv.slice(2);
if (!ESTADOS.includes(estado)) {
  console.error(`Uso: avisar-backup.mjs <${ESTADOS.join("|")}> "mensaje"`);
  process.exit(2);
}

const config = configuracionDelAviso(process.env);
if (!config.ok) {
  console.error(`Correo del backup sin configurar (faltan ${config.faltan.join(", ")}): no se manda.`);
  process.exit(0);
}

const correo = correoDeBackup({ estado, mensaje: resto.join(" ") || "(sin detalle)", equipo: hostname() });
const r = await enviarCorreo({ config, correo });
if (!r.ok) {
  console.error(`No se pudo mandar el correo del backup: ${r.motivo}`);
  process.exit(1);
}
console.log(`Correo del backup mandado a ${config.para} (${estado}).`);
