import fs from "node:fs";
import crypto from "node:crypto";

const RAIZ = new URL("../../", import.meta.url).pathname;

// El hash de los códigos vivía copiado en cinco sitios. Ahora hay uno, y
// estos tests fijan que da EXACTAMENTE lo mismo que las copias: un cambio
// aquí invalidaría todos los códigos ya emitidos.
export async function run({ test, assert }) {
  const { hashInviteCode, hashJoinCode } = await import("../../server/lib/codigos/hashDeCodigo.js");
  const { avisosDePeppers } = await import("../../server/lib/env.js");
  const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

  test("invitación: INVITE primero, luego JOIN; recorta espacios", () => {
    assert.equal(hashInviteCode(" ABC ", { INVITE_CODE_PEPPER: "i", JOIN_CODE_PEPPER: "j" }), sha("iABC"));
    assert.equal(hashInviteCode("ABC", { JOIN_CODE_PEPPER: "j" }), sha("jABC"));
    assert.equal(hashInviteCode("ABC", {}), sha("ABC"));
  });

  test("grupo: JOIN primero, luego INVITE", () => {
    assert.equal(hashJoinCode("XYZ", { INVITE_CODE_PEPPER: "i", JOIN_CODE_PEPPER: "j" }), sha("jXYZ"));
    assert.equal(hashJoinCode("XYZ", { INVITE_CODE_PEPPER: "i" }), sha("iXYZ"));
  });

  test("REGRESIÓN: ya no hay copias del hash sueltas por las rutas", () => {
    const sitios = ["server/lib/adminStudentHelpers.js", "server/lib/adminTeacherHelpers.js",
      "server/routes/v1/teacher.invites.routes.js", "server/routes/v1/student.invite.routes.js",
      "server/routes/v1/student.register.routes.js"];
    for (const s of sitios) {
      assert.equal(/_CODE_PEPPER/.test(fs.readFileSync(`${RAIZ}${s}`, "utf8")), false, `${s} sigue leyendo el pepper por su cuenta`);
    }
  });

  test("REGRESIÓN: sin peppers, el arranque lo avisa; con los dos, calla", () => {
    assert.equal(avisosDePeppers({}).length, 1);
    assert.match(avisosDePeppers({})[0], /dejarán de validar/);
    assert.match(avisosDePeppers({ INVITE_CODE_PEPPER: "x" })[0], /JOIN_CODE_PEPPER no configurado/);
    assert.deepEqual(avisosDePeppers({ INVITE_CODE_PEPPER: "x", JOIN_CODE_PEPPER: "y" }), []);
  });
}
