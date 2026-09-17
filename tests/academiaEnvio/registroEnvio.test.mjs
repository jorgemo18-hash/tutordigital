// DEJAR CONSTANCIA DEL EMAIL QUE YA SALIÓ.
//
// La regla que gobierna este módulo: **el email ya se ha enviado**. Nada de
// lo que pase al registrarlo puede deshacerlo, así que nada de lo que pase
// al registrarlo puede romper el envío. Si esto lanzara una excepción a
// mitad de la tanda de recibos de septiembre, las familias restantes se
// quedarían sin recibo por un fallo de contabilidad interna.
export async function run({ test, assert }) {
  const { registrarEnvioEmail, tipoDeEnvio } = await import(
    "../../server/lib/academiaEnvio/registroEnvio.js"
  );

  function adminFalso({ error = null } = {}) {
    const filas = [];
    return {
      filas,
      from: () => ({
        insert(fila) {
          if (!error) filas.push(fila);
          return {
            select: () => ({ maybeSingle: () => Promise.resolve({ data: error ? null : { id: "env_1" }, error }) }),
          };
        },
      }),
    };
  }

  const BASE = {
    tenantId: "t1",
    resendEmailId: "re_abc",
    destinatario: "familia@example.com",
    asunto: "Lyceo · Septiembre 2026",
    familiaId: "f1",
    reciboId: "r1",
    tipo: "recibo",
  };

  test("EL PUNTO DE TODO: guarda el id de Resend, que es la clave de unión", async () => {
    const admin = adminFalso();
    const { envioId, error } = await registrarEnvioEmail(admin, BASE);
    assert.equal(error, null);
    assert.equal(envioId, "env_1");
    assert.equal(admin.filas[0].resend_email_id, "re_abc", "sin esto, un rebote no se puede atribuir a este recibo");
    assert.equal(admin.filas[0].recibo_id, "r1");
    assert.equal(admin.filas[0].familia_id, "f1");
    assert.equal(admin.filas[0].tenant_id, "t1");
  });

  test("sin id de Resend no se escribe una fila inútil", async () => {
    // Una fila sin la clave de unión no sirve para lo único que hace esta
    // tabla. Mejor no tenerla que tener basura que nunca casará con nada.
    const admin = adminFalso();
    const r = await registrarEnvioEmail(admin, { ...BASE, resendEmailId: null });
    assert.equal(r.omitido, true);
    assert.equal(r.error, null, "y NO es un error: el email salió bien");
    assert.equal(admin.filas.length, 0);
  });

  test("un fallo de escritura se DEVUELVE, no se lanza", async () => {
    // Si esto lanzara, tumbaría el envío de los recibos que falten.
    const admin = adminFalso({ error: { message: "boom" } });
    const r = await registrarEnvioEmail(admin, BASE);
    assert.equal(r.envioId, null);
    assert.equal(r.error.message, "boom");
  });

  test("tipoDeEnvio nombra lo que se adjuntó de verdad", () => {
    assert.equal(tipoDeEnvio({ hayRecibo: true, hayInformes: true }), "recibo_informe");
    assert.equal(tipoDeEnvio({ hayRecibo: true }), "recibo");
    assert.equal(tipoDeEnvio({ hayInformes: true }), "informe");
    assert.equal(tipoDeEnvio({}), "otro");
  });

  test("los tipos que devuelve caben en el CHECK de la columna", () => {
    // El CHECK de la migración 122 es la lista cerrada. Si alguien añade un
    // tipo aquí y no allí, el INSERT falla en producción y no en los tests.
    const PERMITIDOS = ["recibo", "informe", "recibo_informe", "ausencia", "otro"];
    for (const combo of [{ hayRecibo: true, hayInformes: true }, { hayRecibo: true }, { hayInformes: true }, {}]) {
      assert.ok(PERMITIDOS.includes(tipoDeEnvio(combo)), `tipo fuera del CHECK: ${tipoDeEnvio(combo)}`);
    }
  });
}
