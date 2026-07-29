// Prueba de concepto del harness RLS (Tanda 0): academia_fichajes ya tiene
// políticas aplicadas en producción hoy (migración 090 y siguientes), así
// que sirve para demostrar que el harness funciona ANTES de escribir
// ninguna política nueva para las 14 tablas objetivo. No es parte del
// trabajo de esas 14 tablas — es la validación del mecanismo.
import { randomUUID } from "node:crypto";
import {
  withRlsTransaction,
  createTestUser,
  createTestTenant,
  createTestMembership,
} from "./harness.mjs";

async function crearFichaje(tx, { tenantId, workerProfileId }) {
  await tx.query(
    "insert into academia_fichajes (tenant_id, worker_profile_id, tipo, origen) values ($1, $2, 'entrada', 'worker')",
    [tenantId, workerProfileId]
  );
}

export async function run({ test, assert }) {
  test("RLS academia_fichajes: el propio profesor ve su fichaje", async () => {
    await withRlsTransaction(async (tx) => {
      const userId = randomUUID();
      await createTestUser(tx, userId);
      const tenantId = await createTestTenant(tx, { slug: `rls-test-${randomUUID()}` });
      await createTestMembership(tx, { tenantId, userId, role: "teacher" });
      await crearFichaje(tx, { tenantId, workerProfileId: userId });

      await tx.asUser(userId);
      const { rows } = await tx.query(
        "select count(*)::int as n from academia_fichajes where worker_profile_id = $1",
        [userId]
      );
      assert.equal(rows[0].n, 1, "el dueño del fichaje debería verlo");
    });
  });

  test("RLS academia_fichajes: un usuario de OTRO tenant no ve el fichaje", async () => {
    await withRlsTransaction(async (tx) => {
      const ownerId = randomUUID();
      const outsiderId = randomUUID();
      await createTestUser(tx, ownerId);
      await createTestUser(tx, outsiderId);

      const tenantA = await createTestTenant(tx, { slug: `rls-test-${randomUUID()}` });
      const tenantB = await createTestTenant(tx, { slug: `rls-test-${randomUUID()}` });
      await createTestMembership(tx, { tenantId: tenantA, userId: ownerId, role: "teacher" });
      await createTestMembership(tx, { tenantId: tenantB, userId: outsiderId, role: "teacher" });
      await crearFichaje(tx, { tenantId: tenantA, workerProfileId: ownerId });

      await tx.asUser(outsiderId);
      const { rows } = await tx.query(
        "select count(*)::int as n from academia_fichajes where worker_profile_id = $1",
        [ownerId]
      );
      assert.equal(rows[0].n, 0, "un usuario de otro tenant no debería ver el fichaje ajeno");
    });
  });
}
