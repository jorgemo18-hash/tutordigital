// Fake mínimo del cliente admin de Supabase — solo implementa la parte de
// la API encadenable (.from/.select/.eq/.neq/.gte/.lte/.gt/.lt/.in/.is/
// .or/.order/.limit/.range/.maybeSingle/.single/.insert/.update/.upsert/
// .delete, incluido .upsert().select().single()) que usan tasksHelpers.js,
// taskOwnership.js, sesionLibreTask.js, sessionInactivity.js,
// academiaDocumentos/normas.js y las consultas de
// academiaDescuentos/academiaRecibos/academiaInformes/academiaFichajes/
// academiaListaEspera. No es un mock general de supabase-js — vive en
// tests/ porque solo sirve para testear estas funciones sin credenciales
// reales.
// "descuento_tipo.tenant_id" (filtro sobre una tabla embebida, ver
// fetchDescuentosActivosPorAlumno) — el fake no simula el JOIN en sí, pero
// sí sabe leer un path con puntos si el test ya sembró el objeto embebido
// directo en la fila (mismo patrón que `familia:` en academia_recibos).
function getPath(row, col) {
  return col.split(".").reduce((val, key) => (val == null ? val : val[key]), row);
}

function matchesOp(rowVal, op, val) {
  if (op === "eq") return rowVal === val;
  if (op === "neq") return rowVal !== val;
  if (op === "gte") return rowVal >= val;
  if (op === "lte") return rowVal <= val;
  if (op === "lt") return rowVal < val;
  if (op === "gt") return rowVal > val;
  if (op === "in") return val.includes(rowVal);
  if (op === "is") return val === null ? (rowVal === null || rowVal === undefined) : rowVal === val;
  // like/ilike: solo se traduce el comodín % de PostgREST; el resto del
  // patrón se escapa para que un punto o un guion del patrón no actúe como
  // metacarácter de expresión regular.
  if (op === "like" || op === "ilike") {
    if (rowVal == null) return false;
    const patron = String(val)
      .split("%")
      .map((trozo) => trozo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${patron}$`, op === "ilike" ? "i" : "").test(String(rowVal));
  }
  return true;
}

// "col.op.valor" tal cual lo escribe supabase-js en un .or("a.is.null,b.gte.x") —
// solo cubre los operadores que ya usan las queries reales (is/eq/neq/
// gte/lte/gt/lt), suficiente para lo que necesitan academia.sesiones.routes.js
// y tasks.routes.js.
function parseOrClause(clause) {
  const [col, op, ...rest] = clause.split(".");
  const raw = rest.join(".");
  const val = raw === "null" ? null : raw === "true" ? true : raw === "false" ? false : raw;
  return { col, op, val };
}

function matches(row, filters) {
  return filters.every(({ type, col, val }) => {
    if (type === "or") return val.some((clause) => matchesOp(getPath(row, clause.col), clause.op, clause.val));
    return matchesOp(getPath(row, col), type, val);
  });
}

function makeBuilder(table, state) {
  const filters = [];
  let orderCol = null;
  let orderAsc = true;
  let limitN = null;
  let rangeFrom = null;
  let rangeTo = null;
  let insertRows = null;
  let selectCols = null;
  let updatePatch = null;
  let upsertRow = null;
  let upsertOpts = null;
  let deleteFlag = false;

  const rowsFor = () => {
    if (insertRows) {
      const created = insertRows.map((row) => {
        const withId = { id: `fake-${state.nextId++}`, created_at: new Date().toISOString(), ...row };
        state.tables[table] = state.tables[table] || [];
        state.tables[table].push(withId);
        return withId;
      });
      return created;
    }
    let rows = (state.tables[table] || []).filter((r) => matches(r, filters));
    if (orderCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[orderCol];
        const bv = b[orderCol];
        if (av === bv) return 0;
        return orderAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }
    if (rangeFrom != null) rows = rows.slice(rangeFrom, rangeTo + 1);
    if (limitN != null) rows = rows.slice(0, limitN);
    return rows;
  };

  // Compartida por .then()/.single()/.maybeSingle() — un upsert real puede
  // encadenar .select().single() para leer la fila resultante (ver
  // generarYGuardarComentario, academia_informes), no solo await directo.
  function performUpsert() {
    state.tables[table] = state.tables[table] || [];
    const conflictCol = upsertOpts.onConflict;
    const existing = conflictCol
      ? state.tables[table].find((r) => r[conflictCol] === upsertRow[conflictCol])
      : null;
    if (existing) { Object.assign(existing, upsertRow); return existing; }
    const created = { id: `fake-${state.nextId++}`, ...upsertRow };
    state.tables[table].push(created);
    return created;
  }

  // Devuelve las filas borradas (para .select().maybeSingle() tras un
  // delete, ver eliminarEntradaListaEspera) y las quita de la tabla.
  function performDelete() {
    const rows = (state.tables[table] || []).filter((r) => matches(r, filters));
    state.tables[table] = (state.tables[table] || []).filter((r) => !matches(r, filters));
    return rows;
  }

  const builder = {
    select(cols) { selectCols = cols; return builder; },
    eq(col, val) { filters.push({ type: "eq", col, val }); return builder; },
    gte(col, val) { filters.push({ type: "gte", col, val }); return builder; },
    lte(col, val) { filters.push({ type: "lte", col, val }); return builder; },
    lt(col, val) { filters.push({ type: "lt", col, val }); return builder; },
    gt(col, val) { filters.push({ type: "gt", col, val }); return builder; },
    in(col, val) { filters.push({ type: "in", col, val }); return builder; },
    is(col, val) { filters.push({ type: "is", col, val }); return builder; },
    neq(col, val) { filters.push({ type: "neq", col, val }); return builder; },
    like(col, val) { filters.push({ type: "like", col, val }); return builder; },
    ilike(col, val) { filters.push({ type: "ilike", col, val }); return builder; },
    or(clauseStr) { filters.push({ type: "or", val: clauseStr.split(",").map(parseOrClause) }); return builder; },
    order(col, opts) { orderCol = col; orderAsc = opts?.ascending !== false; return builder; },
    limit(n) { limitN = n; return builder; },
    range(from, to) { rangeFrom = from; rangeTo = to; return builder; },
    insert(rows) { insertRows = Array.isArray(rows) ? rows : [rows]; return builder; },
    update(patch) { updatePatch = patch; return builder; },
    upsert(row, opts) { upsertRow = row; upsertOpts = opts || {}; return builder; },
    delete() { deleteFlag = true; return builder; },
    maybeSingle() {
      if (upsertRow) return Promise.resolve({ data: performUpsert(), error: null });
      if (deleteFlag) { const rows = performDelete(); return Promise.resolve({ data: rows[0] || null, error: null }); }
      const rows = rowsFor();
      return Promise.resolve({ data: rows[0] || null, error: null });
    },
    single() {
      if (upsertRow) return Promise.resolve({ data: performUpsert(), error: null });
      if (deleteFlag) {
        const rows = performDelete();
        if (!rows[0]) return Promise.resolve({ data: null, error: { message: "no rows" } });
        return Promise.resolve({ data: rows[0], error: null });
      }
      const rows = rowsFor();
      if (!rows[0]) return Promise.resolve({ data: null, error: { message: "no rows" } });
      return Promise.resolve({ data: rows[0], error: null });
    },
    then(resolve, reject) {
      if (upsertRow) {
        performUpsert();
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      if (deleteFlag) {
        const rows = performDelete();
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      }
      if (updatePatch) {
        const rows = (state.tables[table] || []).filter((r) => matches(r, filters));
        rows.forEach((r) => Object.assign(r, updatePatch));
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: rowsFor(), error: null }).then(resolve, reject);
    },
  };
  return builder;
}

export function makeFakeSupabaseAdmin(initialTables = {}) {
  const state = { tables: { ...initialTables }, nextId: 1 };
  return {
    from(table) { return makeBuilder(table, state); },
    _state: state,
  };
}
