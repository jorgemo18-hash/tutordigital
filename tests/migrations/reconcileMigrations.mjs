// Lógica pura de reconciliación entre supabase/migrations/*.sql y
// supabase_migrations.schema_migrations — separada de cualquier acceso a
// BD para poder testearla offline (ver reconcileMigrations.test.mjs, que
// SÍ corre en el npm test por defecto). El script que de verdad consulta
// la BD real (liveCheck.mjs, requiere SUPABASE_DB_URL) es un wrapper fino
// alrededor de matchMigrations().
//
// Por qué existe: GAPS.md documentaba a mano la correspondencia
// repo<->BD, pero solo hasta la migración 049 — nadie lo extendió, y el
// desajuste real de 089/090 (dos migraciones con nombres en BD que no
// llevan el prefijo numérico del archivo) pasó dos semanas sin que nada
// lo detectara. Esto lo hace imposible de acumular en silencio otra vez.

// Extrae { "037": "attachments_student_upload", ... } de una lista de
// nombres de archivo tipo "037_attachments_student_upload.sql".
export function parseRepoFiles(filenames) {
  const byNnn = {};
  for (const f of filenames) {
    const m = /^(\d{3})_(.+)\.sql$/.exec(f);
    if (m) byNnn[m[1]] = m[2];
  }
  return byNnn;
}

// Compara repoByNnn (de parseRepoFiles) contra dbEntries (filas de
// schema_migrations, [{version, name}, ...]) usando 4 formas de match
// automático (mismo criterio que se usó para reconciliar el repo a mano
// el 2026-07-30):
//   1. version === NNN (estilo "bookkeeping" de las migraciones 001-036)
//   2. name === "NNN_slug" (estilo Supabase CLI normal)
//   3. name === "slug" (aplicada sin el prefijo numérico — el bug real de 089)
//   4. name con un prefijo NNN[a-z]?_ distinto, pero el resto === slug
//
// Una entrada de allowlist sin 'destino' no es una excusa válida: explica
// QUÉ es el desajuste pero no CUÁNDO se resuelve ni por qué es tolerable
// para siempre — eso es exactamente lo que deja una política de RLS
// ausente (o cualquier otro gap real) en CI verde indefinidamente sin que
// nadie vuelva a mirarlo. 'reason' y 'destino' son ambos obligatorios,
// como string no vacío.
export function isValidAllowlistEntry(entry) {
  return Boolean(entry && typeof entry.reason === "string" && entry.reason.trim() && typeof entry.destino === "string" && entry.destino.trim());
}

// allowlist (de known-drift.json) explica desajustes ya investigados a
// mano: cada entrada de allowlist.repoOnly consume un archivo del repo
// (con o sin dbVersion asociado); cada entrada de allowlist.dbOnly
// consume una versión de BD. Una entrada MALFORMADA (sin reason/destino
// válidos) NO cuenta como explicación — el desajuste que "cubre" vuelve a
// aparecer como sin explicar, además de reportarse aparte en
// malformedAllowlistEntries. Devuelve qué queda SIN explicar por ninguna
// vía — eso es lo que debe hacer fallar el test.
export function matchMigrations({ repoByNnn, dbEntries, allowlist = { repoOnly: [], dbOnly: [] } }) {
  const dbByExactName = new Map();
  const dbByStrippedName = new Map();
  for (const e of dbEntries) {
    if (!dbByExactName.has(e.name)) dbByExactName.set(e.name, []);
    dbByExactName.get(e.name).push(e);
    const m = /^\d{3}[a-z]?_(.+)$/.exec(e.name);
    const stripped = m ? m[1] : e.name;
    if (!dbByStrippedName.has(stripped)) dbByStrippedName.set(stripped, []);
    dbByStrippedName.get(stripped).push(e);
  }

  const malformedAllowlistEntries = [
    ...allowlist.repoOnly.filter((a) => !isValidAllowlistEntry(a)).map((a) => `repoOnly: ${a.file || "(sin file)"}`),
    ...allowlist.dbOnly.filter((a) => !isValidAllowlistEntry(a)).map((a) => `dbOnly: ${a.dbVersion || "(sin dbVersion)"}`),
  ];

  const validRepoOnly = allowlist.repoOnly.filter(isValidAllowlistEntry);
  const validDbOnly = allowlist.dbOnly.filter(isValidAllowlistEntry);

  const matchedDbVersions = new Set();
  const unexplainedRepoOnly = [];

  for (const [nnn, slug] of Object.entries(repoByNnn)) {
    const candidates = [
      ...dbEntries.filter((e) => e.version === nnn),
      ...(dbByExactName.get(`${nnn}_${slug}`) || []),
      ...(dbByExactName.get(slug) || []),
      ...(dbByStrippedName.get(slug) || []),
    ];
    if (candidates.length) {
      for (const c of candidates) matchedDbVersions.add(c.version);
      continue;
    }
    const explained = validRepoOnly.find((a) => a.file === `${nnn}_${slug}.sql`);
    if (explained) {
      if (explained.dbVersion) matchedDbVersions.add(explained.dbVersion);
      continue;
    }
    unexplainedRepoOnly.push(`${nnn}_${slug}.sql`);
  }

  const allowedDbVersions = new Set([
    ...validDbOnly.map((a) => a.dbVersion),
    ...validRepoOnly.filter((a) => a.dbVersion).map((a) => a.dbVersion),
  ]);

  const unexplainedDbOnly = dbEntries
    .filter((e) => !matchedDbVersions.has(e.version) && !allowedDbVersions.has(e.version))
    .map((e) => `${e.version}  ${e.name}`);

  return { unexplainedRepoOnly, unexplainedDbOnly, malformedAllowlistEntries };
}
