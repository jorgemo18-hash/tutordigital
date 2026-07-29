// Harness de tests RLS — conecta a Postgres como el rol de conexión
// (normalmente `postgres`, el mismo que usa SUPABASE_DB_URL para
// pg_dump/psql, ver scripts/backup-db.sh) y dentro de cada test cambia a
// `authenticated` + un `request.jwt.claim.sub` concreto, exactamente como
// PostgREST evalúa las políticas RLS para una petición real. Cada test va
// envuelto en BEGIN/ROLLBACK: crea sus propias filas (auth.users, profiles,
// tenants, tenant_memberships, ...) y no deja rastro ni depende de datos
// reales.
//
// Por qué un harness separado de tests/run.mjs: ese runner es offline y
// rápido (fakeSupabaseAdmin, sin red). Los tests RLS necesitan una conexión
// viva a Postgres — no pueden ser parte del `npm test` por defecto.
import pg from "pg";

function requireDbUrl() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "Falta SUPABASE_DB_URL. Los tests RLS necesitan una conexión real a Postgres " +
        "(mismo valor que usa scripts/backup-db.sh — dashboard de Supabase -> Connect -> " +
        "Session pooler, puerto 5432). Expórtala en el entorno o en un .env en la raíz del repo."
    );
  }
  return url;
}

function makeTx(client) {
  return {
    // Corre como el rol de conexión (postgres) — bypasa RLS. Usar solo para
    // crear fixtures, nunca para las comprobaciones que se están probando.
    query: (sql, params) => client.query(sql, params),

    // Cambia la sesión a como la vería PostgREST para una petición real de
    // un usuario concreto. set_config(), no `SET LOCAL var = valor`, porque
    // set_config() admite parámetros ($1) — SET no, y no queremos construir
    // SQL por interpolación de string con un uuid que en teoría podría venir
    // de fuera.
    async asUser(userId) {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    },

    // Vuelve al rol de conexión dentro de la misma transacción (por si un
    // test necesita alternar usuario/postgres varias veces).
    async asPostgres() {
      await client.query("RESET ROLE");
    },
  };
}

// Ejecuta fn(tx) dentro de BEGIN...ROLLBACK. fn recibe un `tx` con .query
// (sin RLS, para fixtures), .asUser(userId) y .asPostgres(). Pase lo que
// pase dentro de fn (éxito o excepción), la transacción se revierte siempre
// — ningún test dejar datos reales en la base.
export async function withRlsTransaction(fn) {
  const client = new pg.Client({ connectionString: requireDbUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    const tx = makeTx(client);
    return await fn(tx);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

export async function createTestUser(tx, userId) {
  await tx.query("insert into auth.users (id) values ($1)", [userId]);
  await tx.query("insert into profiles (id) values ($1)", [userId]);
  return userId;
}

export async function createTestTenant(tx, { slug, name = slug, status = "active" }) {
  const { rows } = await tx.query(
    "insert into tenants (slug, name, status) values ($1, $2, $3) returning id",
    [slug, name, status]
  );
  return rows[0].id;
}

export async function createTestMembership(tx, { tenantId, userId, role, status = "active" }) {
  await tx.query(
    "insert into tenant_memberships (tenant_id, user_id, role, status) values ($1, $2, $3, $4)",
    [tenantId, userId, role, status]
  );
}
