import fs from "node:fs";
import path from "node:path";

// El agujero que cerró la auditoría del 08/09/2026, y las dos piezas que lo
// formaban. Son tests estructurales —leen el código fuente— porque lo que hay
// que impedir es que la construcción vuelva, no un valor concreto en tiempo
// de ejecución.
//
// EL FALLO. Encadenaba dos cosas, ninguna peligrosa por sí sola:
//
//   1. POST /api/v1/public/register-school era PÚBLICA, sin ninguna
//      comprobación, y creaba una cuenta de Supabase con el email que se le
//      pidiera y `email_confirm: true` — o sea, ya verificada, sin que nadie
//      demostrase tener ese buzón.
//   2. El login (y también GET /me) llamaban a autoRedeemInvites, que
//      buscaba invitaciones de profesor pendientes POR EMAIL, en todos los
//      centros, y concedía membresía `teacher` activa.
//
// Juntas: alguien que supiera el email de un profesor invitado —los emails de
// una academia son públicos— se registraba con ese email, entraba, y el
// sistema le daba acceso de profesor al centro de otro: horario, diario,
// sesiones y los nombres de sus alumnos menores. No hacía falta ninguna
// credencial previa.
//
// El canje bueno ya existía: exige el TOKEN del enlace del correo, comprueba
// su hash y su caducidad, y es lo que llama invite.html.
function leer(rel) {
  return fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

function existe(rel) {
  return fs.existsSync(path.resolve(process.cwd(), rel));
}

export async function run({ test, assert }) {
  test("REGRESIÓN: no hay ninguna ruta pública que cree cuentas de usuario", () => {
    // La ruta se eliminó entera. Si vuelve un alta pública de centros, tendrá
    // que verificar el correo de verdad, no dar la cuenta por confirmada.
    assert.equal(
      existe("server/routes/v1/public.onboarding.routes.js"),
      false,
      "public.onboarding.routes.js creaba cuentas con email_confirm:true sin verificar nada"
    );
    const app = leer("server/app.js");
    assert.equal(app.includes("publicOnboarding"), false, "sigue registrada en app.js");
  });

  test("REGRESIÓN: solo dos rutas crean cuentas ya confirmadas, y las dos piden autorización antes", () => {
    // `email_confirm: true` en createUser convierte "dame una cuenta con este
    // email" en "soy el dueño de este email", y ahí estaba el fallo. No se
    // puede prohibir del todo —hay dos sitios donde es correcto— así que esto
    // es un cable trampa: si aparece un tercero, hay que mirarlo a mano.
    //
    // Los dos permitidos, y por qué:
    //   - student.register: exige el código del grupo Y que el email esté ya
    //     en student_invites. No se puede usar con un email cualquiera.
    //   - superadmin.tenant.create: solo un superadmin, creando a propósito
    //     la cuenta del director de un centro nuevo.
    const PERMITIDAS = ["student.register.routes.js", "superadmin.tenant.create.routes.js"];

    const rutas = fs.readdirSync(path.resolve(process.cwd(), "server/routes/v1"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".js"));
    // El (?<![a-zA-Z_]) evita casar con `needs_email_confirm: true`, que es
    // otra cosa: la respuesta que le dice al cliente que falta confirmar.
    const conConfirm = rutas.filter((f) => /(?<![a-zA-Z_])email_confirm:\s*true/.test(leer(`server/routes/v1/${f}`)));

    assert.deepEqual(
      conConfirm.map((f) => path.basename(f)).sort(),
      [...PERMITIDAS].sort(),
      "una ruta nueva crea cuentas ya confirmadas: comprueba que exige autorización antes de hacerlo"
    );
  });

  test("REGRESIÓN: entrar o cargar el perfil NO concede roles", () => {
    // Ni el login ni /me pueden dar una membresía. Solo el canje con token.
    for (const archivo of ["server/routes/v1/auth.routes.js", "server/routes/v1/me.js"]) {
      const src = leer(archivo);
      assert.equal(src.includes("autoRedeemInvites"), false, `${archivo} vuelve a canjear invitaciones`);
      assert.equal(
        /tenant_memberships[\s\S]{0,200}\.upsert\(/.test(src),
        false,
        `${archivo} escribe en tenant_memberships: autenticarse no puede dar acceso a un centro`
      );
    }
  });

  test("REGRESIÓN: autoRedeemInvites no existe en ningún sitio", () => {
    const src = leer("server/lib/teacherUtils.js");
    assert.equal(
      /export\s+(async\s+)?function\s+autoRedeemInvites/.test(src),
      false,
      "canjeaba por email, sin ninguna prueba de que quien entra sea el invitado"
    );
  });

  test("el canje bueno sigue en pie: exige token, y lo compara contra su hash", () => {
    // Este test es el contrapeso de los de arriba: si alguien 'arregla' el
    // problema quitando también el canje legítimo, los profesores no pueden
    // entrar y esto lo caza.
    const src = leer("server/routes/v1/teacher.invites.routes.js");
    assert.match(src, /token_required/, "sin token no se canjea");
    assert.match(src, /code_hash/, "el token se compara contra el hash guardado");
    assert.match(src, /expires_at|expired/, "una invitación caducada no vale");
    assert.match(src, /requireAuth/, "hay que estar autenticado");
  });
}
