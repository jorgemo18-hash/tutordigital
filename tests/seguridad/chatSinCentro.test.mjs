import fs from "node:fs";
import path from "node:path";

// El chat era una barra libre contra la factura de Anthropic (auditoría del
// 08/09/2026). Dos agujeros en el mismo sitio:
//
//   1. SIN CENTRO NO SE COMPROBABA NADA. El guard de pertenencia devuelve
//      "adelante" cuando no llega cabecera de centro —está escrito así a
//      propósito, para que cada ruta decida— y /chat no decidía. Una cuenta
//      cualquiera, sin pertenecer a ningún centro, llamaba al chat.
//   2. Y SIN LÍMITE. checkDailyLimit se rinde si no hay slug de centro, y
//      además solo se llamaba cuando había sesión de tutoría. Sin sesión, ni
//      límite ni atribución del consumo.
//
// Encima, el modelo lo elegía quien llamaba: el esquema acepta cualquier
// cadena y se pasaba tal cual a Anthropic. Ningún cliente de la app manda ese
// campo, así que solo servía para pedir el modelo más caro y que lo pagara la
// academia.
function leer(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

export async function run({ test, assert }) {
  test("REGRESIÓN: el modelo del cuerpo se IGNORA, lo decide el servidor", async () => {
    // El vector era mandar el nombre del modelo más caro que exista en el
    // cuerpo de la petición. Se resolvió ignorándolo, no filtrándolo con una
    // lista blanca: una lista hay que mantenerla, y el día que alguien meta
    // ahí un modelo caro reabre la puerta sin darse cuenta.
    const src = leer("server/lib/chat.js");
    assert.equal(
      /String\(validatedData\.model/.test(src),
      false,
      "el modelo del cliente vuelve a llegar a Anthropic"
    );
    assert.match(src, /const model\s*=\s*defaultModel;/);
  });

  test("y no hay ninguna otra puerta: nadie más lee validatedData.model", () => {
    for (const archivo of ["server/lib/chat.js", "server/routes/v1/chat.routes.js"]) {
      assert.equal(
        /validatedData\.model|body\.model\s*\|\|/.test(leer(archivo)),
        false,
        `${archivo} usa el modelo que manda el cliente`
      );
    }
  });

  test("REGRESIÓN: /chat exige centro, y el límite diario ya no depende de tener sesión", () => {
    const src = leer("server/routes/v1/chat.routes.js");
    assert.match(src, /if \(!req\.tenantSlug\)[\s\S]{0,120}tenant_required/,
      "sin cabecera de centro, 403 antes de llamar a Anthropic");
    assert.equal(
      /if \(sessionId && req\.userId\) \{/.test(src),
      false,
      "el límite diario volvía a aplicarse solo con sesión de tutoría"
    );
    assert.match(src, /if \(req\.userId\) \{[\s\S]{0,200}checkDailyLimit/);
  });
}
