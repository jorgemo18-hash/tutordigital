export async function run({ test, assert }) {
  const { parseRepoFiles, matchMigrations, isValidAllowlistEntry } = await import("./reconcileMigrations.mjs");

  test("isValidAllowlistEntry: exige reason Y destino no vacíos", () => {
    assert.equal(isValidAllowlistEntry({ reason: "algo", destino: "algo" }), true);
    assert.equal(isValidAllowlistEntry({ reason: "algo" }), false);
    assert.equal(isValidAllowlistEntry({ destino: "algo" }), false);
    assert.equal(isValidAllowlistEntry({ reason: "algo", destino: "" }), false);
    assert.equal(isValidAllowlistEntry({ reason: "  ", destino: "algo" }), false);
    assert.equal(isValidAllowlistEntry({}), false);
  });

  test("matchMigrations: entrada de allowlist SIN destino no explica nada — el gap real reaparece", () => {
    const { unexplainedRepoOnly, malformedAllowlistEntries } = matchMigrations({
      repoByNnn: { "090": "drop_columna" },
      dbEntries: [],
      allowlist: { repoOnly: [{ file: "090_drop_columna.sql", reason: "pendiente" }], dbOnly: [] },
    });
    assert.deepEqual(unexplainedRepoOnly, ["090_drop_columna.sql"]);
    assert.deepEqual(malformedAllowlistEntries, ["repoOnly: 090_drop_columna.sql"]);
  });

  test("matchMigrations: entrada de allowlist con reason+destino SÍ explica (caso normal, ya cubierto arriba) y no se reporta como malformada", () => {
    const { unexplainedRepoOnly, malformedAllowlistEntries } = matchMigrations({
      repoByNnn: { "090": "drop_columna" },
      dbEntries: [],
      allowlist: {
        repoOnly: [{ file: "090_drop_columna.sql", reason: "pendiente a propósito", destino: "Jorge la aplica manualmente" }],
        dbOnly: [],
      },
    });
    assert.deepEqual(unexplainedRepoOnly, []);
    assert.deepEqual(malformedAllowlistEntries, []);
  });

  test("parseRepoFiles: extrae NNN y slug de nombres de archivo válidos, ignora el resto", () => {
    const result = parseRepoFiles(["001_init.sql", "090_drop_x.sql", "GAPS.md", "README.txt"]);
    assert.deepEqual(result, { "001": "init", "090": "drop_x" });
  });

  test("matchMigrations: match exacto NNN_slug -> nada sin explicar", () => {
    const { unexplainedRepoOnly, unexplainedDbOnly } = matchMigrations({
      repoByNnn: { "001": "init" },
      dbEntries: [{ version: "20260101000000", name: "001_init" }],
    });
    assert.deepEqual(unexplainedRepoOnly, []);
    assert.deepEqual(unexplainedDbOnly, []);
  });

  test("matchMigrations: aplicada SIN el prefijo numérico (el bug real de 089) -> se reconoce sola", () => {
    const { unexplainedRepoOnly, unexplainedDbOnly } = matchMigrations({
      repoByNnn: { "089": "backfill_exencion_iva" },
      dbEntries: [{ version: "20260720134727", name: "backfill_exencion_iva" }],
    });
    assert.deepEqual(unexplainedRepoOnly, []);
    assert.deepEqual(unexplainedDbOnly, []);
  });

  test("matchMigrations: archivo en el repo sin aplicar y sin excusa en el allowlist -> falla", () => {
    const { unexplainedRepoOnly } = matchMigrations({
      repoByNnn: { "090": "drop_columna" },
      dbEntries: [],
    });
    assert.deepEqual(unexplainedRepoOnly, ["090_drop_columna.sql"]);
  });

  test("matchMigrations: archivo sin aplicar SÍ explicado en el allowlist (reason+destino) -> no falla", () => {
    const { unexplainedRepoOnly } = matchMigrations({
      repoByNnn: { "090": "drop_columna" },
      dbEntries: [],
      allowlist: {
        repoOnly: [{ file: "090_drop_columna.sql", reason: "pendiente a propósito", destino: "Jorge la aplica manualmente" }],
        dbOnly: [],
      },
    });
    assert.deepEqual(unexplainedRepoOnly, []);
  });

  test("matchMigrations: fila en BD sin archivo del repo y sin excusa -> falla", () => {
    const { unexplainedDbOnly } = matchMigrations({
      repoByNnn: {},
      dbEntries: [{ version: "20260101000000", name: "algo_fuera_de_banda" }],
    });
    assert.deepEqual(unexplainedDbOnly, ["20260101000000  algo_fuera_de_banda"]);
  });

  test("matchMigrations: fila en BD sin archivo del repo pero SÍ en dbOnly del allowlist (reason+destino) -> no falla", () => {
    const { unexplainedDbOnly } = matchMigrations({
      repoByNnn: {},
      dbEntries: [{ version: "20260101000000", name: "algo_fuera_de_banda" }],
      allowlist: {
        repoOnly: [],
        dbOnly: [{ dbVersion: "20260101000000", reason: "grant manual, documentado", destino: "Tolerable permanente" }],
      },
    });
    assert.deepEqual(unexplainedDbOnly, []);
  });

  test("matchMigrations: una migración NUEVA sin aplicar y sin allowlist SIEMPRE falla (caso real que debe detectar)", () => {
    const { unexplainedRepoOnly } = matchMigrations({
      repoByNnn: { "102": "algo_nuevo" },
      dbEntries: [{ version: "001", name: "init" }],
      allowlist: {
        repoOnly: [{ file: "090_drop_columna.sql", reason: "otro caso, no este", destino: "no aplica aquí" }],
        dbOnly: [],
      },
    });
    assert.deepEqual(unexplainedRepoOnly, ["102_algo_nuevo.sql"]);
  });
}
