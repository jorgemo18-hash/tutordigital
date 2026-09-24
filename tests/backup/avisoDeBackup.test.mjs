import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname;

// EL CORREO DEL BACKUP (roadmap: «Que el backup avise por email»).
//
// Dos partes: el correo en sí (qué dice, cómo se manda a Resend) y que el
// script programado lo mande cuando toca: SIEMPRE una vez por pasada —el de
// "todo bien" es el que, si deja de llegar, dice que la tarea se paró—, y el
// de fallo o aviso en vez del de "todo bien", no además.
export async function run({ test, assert }) {
  const { correoDeBackup, configuracionDelAviso, enviarCorreo } = await import("../../scripts/lib/avisoDeBackup.mjs");

  test("backup/correo: el asunto dice el estado, y el de 'todo bien' explica que su ausencia es la alarma", () => {
    const ok = correoDeBackup({ estado: "ok", mensaje: "Copia hecha.", ahora: new Date("2026-09-28T07:00:00Z") });
    assert.equal(ok.asunto, "[TutorDigital] Copia de seguridad hecha");
    assert.ok(ok.texto.includes("Si un lunes no te llega este correo"));
    assert.ok(ok.texto.includes("28/9/2026"));
    const fallo = correoDeBackup({ estado: "fallo", mensaje: "pg_dump: timeout" });
    assert.ok(fallo.asunto.includes("HA FALLADO"));
    assert.ok(fallo.texto.startsWith("pg_dump: timeout"));
    assert.throws(() => correoDeBackup({ estado: "raro", mensaje: "x" }), /estado/);
  });

  test("backup/correo: sin clave o sin destinatario no se manda (y se dice qué falta)", () => {
    assert.deepEqual(configuracionDelAviso({}), { ok: false, faltan: ["RESEND_API_KEY", "BACKUP_AVISO_EMAIL"] });
    assert.deepEqual(configuracionDelAviso({ RESEND_API_KEY: "k" }), { ok: false, faltan: ["BACKUP_AVISO_EMAIL"] });
    const c = configuracionDelAviso({ RESEND_API_KEY: "k", BACKUP_AVISO_EMAIL: "yo@x.es" });
    assert.equal(c.de, "TutorDigital <noreply@tutordigital.app>");
  });

  test("backup/correo: se manda a la API de Resend con la clave en la cabecera, y un error se devuelve", async () => {
    const llamadas = [];
    const fetchFn = async (url, init) => { llamadas.push({ url, init }); return { ok: true, text: async () => "" }; };
    const config = configuracionDelAviso({ RESEND_API_KEY: "clave", BACKUP_AVISO_EMAIL: "yo@x.es" });
    const r = await enviarCorreo({ config, correo: { asunto: "A", texto: "T" }, fetchFn });
    assert.deepEqual(r, { ok: true });
    assert.equal(llamadas[0].url, "https://api.resend.com/emails");
    assert.equal(llamadas[0].init.headers.Authorization, "Bearer clave");
    assert.deepEqual(JSON.parse(llamadas[0].init.body), { from: config.de, to: ["yo@x.es"], subject: "A", text: "T" });
    const mal = await enviarCorreo({ config, correo: { asunto: "A", texto: "T" }, fetchFn: async () => ({ ok: false, status: 403, text: async () => "dominio no verificado" }) });
    assert.equal(mal.ok, false);
    assert.ok(mal.motivo.includes("403"));
  });

  // ── El script programado, con el volcado, la notificación y el correo
  //    sustituidos por comandos que apuntan lo que reciben ──────────────
  function pasada({ volcadoOk = true, marcaDeHaceDias = null } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "backup-"));
    const volcado = join(dir, "volcado.sh");
    writeFileSync(volcado, volcadoOk
      ? `#!/usr/bin/env bash\ntouch "$BACKUP_DEST_DIR/tutordigital_20260928_090000.dump"\n`
      : "#!/usr/bin/env bash\necho 'pg_dump: connection refused'\nexit 1\n");
    const correos = join(dir, "correos.txt");
    const notis = join(dir, "notis.txt");
    const correoCmd = join(dir, "correo.sh");
    const notiCmd = join(dir, "noti.sh");
    writeFileSync(correoCmd, `#!/usr/bin/env bash\necho "$1|$2" >> "${correos}"\n`);
    writeFileSync(notiCmd, `#!/usr/bin/env bash\necho "$1" >> "${notis}"\n`);
    for (const f of [volcado, correoCmd, notiCmd]) chmodSync(f, 0o755);
    if (marcaDeHaceDias !== null) {
      const epoch = Math.floor(Date.now() / 1000) - marcaDeHaceDias * 86400;
      writeFileSync(join(dir, "ULTIMO-BACKUP-OK.txt"), `antes\n${epoch}\n`);
    }
    const r = spawnSync("bash", [`${RAIZ}scripts/backup-db-programado.sh`], {
      env: { ...process.env, BACKUP_DEST_DIR: dir, BACKUP_SCRIPT: volcado, CORREO_CMD: correoCmd, NOTIFICAR_CMD: notiCmd, BACKUP_STORAGE: "0" },
      encoding: "utf8",
    });
    const lee = (f) => (existsSync(f) ? readFileSync(f, "utf8").trim().split("\n") : []);
    return { codigo: r.status, correos: lee(correos), notis: lee(notis) };
  }

  test("backup/programado: si sale bien, UN correo de 'ok' y ninguna notificación", () => {
    const r = pasada();
    assert.equal(r.codigo, 0);
    assert.equal(r.correos.length, 1, r.correos.join(" / "));
    assert.ok(r.correos[0].startsWith("ok|Copia hecha. 1 copia(s)"), r.correos[0]);
    assert.deepEqual(r.notis, []);
  });

  test("backup/programado: si falla, correo de fallo (no de ok) y notificación", () => {
    const r = pasada({ volcadoOk: false, marcaDeHaceDias: 3 });
    assert.equal(r.codigo, 1);
    assert.equal(r.correos.length, 1);
    assert.ok(r.correos[0].startsWith("fallo|La copia de seguridad ha fallado. La última buena es de hace 3 días"), r.correos[0]);
    assert.equal(r.notis.length, 1);
  });

  test("backup/programado: si sale bien pero la anterior era muy vieja, correo de AVISO en lugar del de ok", () => {
    const r = pasada({ marcaDeHaceDias: 30 });
    assert.equal(r.codigo, 0);
    assert.equal(r.correos.length, 1, r.correos.join(" / "));
    assert.ok(r.correos[0].startsWith("aviso|Copia hecha, pero la anterior era de hace 30 días"), r.correos[0]);
  });
}
