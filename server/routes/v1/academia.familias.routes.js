import { z } from "zod";
import { makeRequestId } from "../../lib/requestId.js";
import { ok, created, fail } from "../../lib/http.js";
import { requireRole } from "../../lib/middleware.js";
import { getTenantSlug } from "../../lib/tenantSlug.js";
import { createSupabaseAdmin } from "../../lib/supabase.js";
import { makeTenantMembershipGuard } from "../../lib/security/tenantMembershipGuard.js";
import { ibanValido, motivoIbanInvalido, normalizarIban } from "../../../assets/shared/js/iban.js";

// El formulario (familiaFields.js) ya manda null para los campos opcionales
// vacíos, pero el preprocess también acepta "" por si llega así desde
// cualquier otro caller — "" fallaba .email()/.enum() con un 400 confuso.
const vacioAUndefined = (v) => (v === "" ? undefined : v);
// Igual que vacioAUndefined, pero también normaliza null — el email pasa a
// ser obligatorio (ver más abajo), así que "" y null deben caer en el mismo
// required_error que "campo ausente", no en una rama .nullable() aparte.
const emailVacioAUndefined = (v) => (v === "" || v == null ? undefined : v);

// EL EMAIL YA NO ES OBLIGATORIO (11/09/2026). Lo era, con este argumento:
// "sin él no se le puede enviar factura ni informe a esa familia". Sigue
// siendo cierto, y por eso el aviso se mudó al sitio donde importa —el panel
// de Envío a familias, ver familiasSinEmail.js— en vez de bloquear el alta.
//
// El motivo: cuando a Jorge le llaman para inscribir a alguien se queda con
// el nombre y un móvil; cuando le escriben, con el email. Exigirlo aquí
// dejaba a esos alumnos atascados en Borradores —fuera del horario y del
// diario— con el alumno ya viniendo a clase.
//
// Mismo principio que el recibo de 0 €: el dato se exige cuando hace falta
// de verdad (al enviar), no al crear. Y si viene, tiene que ser un email
// de verdad: opcional no es "vale cualquier cosa".
// dni/telefono/direccion/ciudad/codigo_postal se aceptan desde que el
// formulario de familia los pide (ver familiaFields.js): existían en
// academia_familias y el PDF del recibo los imprime en "Datos del cliente",
// pero este endpoint los descartaba en silencio, así que una familia creada
// desde el selector nacía siempre sin ellos. Todos opcionales — el único
// obligatorio sigue siendo el email.
const opcional = () => z.preprocess(vacioAUndefined, z.string().trim().optional().nullable());

// El IBAN se valida con su propio dígito de control, no solo con un regex de
// forma. Lo cuenta academiaFamilias/iban.js: de los 22 que había escritos a
// mano en producción, cuatro no eran cobrables, y el campo los había
// aceptado sin decir nada. La interfaz avisa mientras se escribe, pero la
// comprobación tiene que estar TAMBIÉN aquí — un PATCH no pasa por la
// interfaz.
//
// Un IBAN vacío sigue siendo válido: "todavía no lo tengo" es un estado
// normal, y exigirlo para poder guardar una familia bloquearía altas.
const ibanOpcional = () =>
  z.preprocess(
    (v) => (v === "" || v == null ? v : normalizarIban(v)),
    z.string().trim().optional().nullable().refine(
      (v) => !v || ibanValido(v),
      (v) => ({ message: motivoIbanInvalido(v) || "IBAN no válido." })
    )
  );

export const CreateFamiliaSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.preprocess(emailVacioAUndefined, z.string().trim().email().optional().nullable()),
  dni: opcional(),
  telefono: opcional(),
  direccion: opcional(),
  ciudad: opcional(),
  codigo_postal: opcional(),
  notas: opcional(),
  metodo_pago: z.preprocess(
    vacioAUndefined,
    z.enum(["bizum", "domiciliado", "transferencia", "efectivo"]).optional().nullable()
  ),
  codigo_sepa: ibanOpcional(),
});

// GET /api/v1/academia/familias — listado mínimo (id, nombre, email,
// metodo_pago) para el buscador "Vincular a hermano/a" del drawer de
// alumnos. El detalle completo de una familia viaja embebido en
// GET /academia/alumnos/:id.
export default async function academiaFamiliasRoutes(app) {
  const guard = makeTenantMembershipGuard();

  app.get("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_familias")
      .select("id, nombre, email, metodo_pago")
      .eq("tenant_id", auth.tenant.id)
      .eq("activa", true)
      .order("nombre", { ascending: true });

    if (error) {
      req.log.error({ err: error, requestId }, "academia familias fetch failed");
      return fail(reply, 500, "familias_fetch_failed", "Failed to fetch familias", requestId);
    }
    return ok(reply, { familias: data || [] }, requestId);
  });

  // POST /api/v1/academia/familias — crea una familia de forma aislada
  // (sin alumno todavía), usada por el drawer "Seleccionar familia" del
  // drawer de alumno: crear y vincular ya no se hacen en el mismo paso
  // que guardar el alumno.
  app.post("/", { preHandler: guard.preHandler }, async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    const tenantSlug = getTenantSlug(req);
    const auth = await requireRole(req, reply, requestId, { tenantSlug, roles: ["admin"] });
    if (!auth.ok) return;

    const parsed = CreateFamiliaSchema.safeParse(req.body || {});
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues, body: req.body, requestId }, "academia familias create: invalid body");
      return fail(reply, 400, "invalid_body", "Invalid body", requestId, { issues: parsed.error.issues });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("academia_familias")
      .insert({ tenant_id: auth.tenant.id, activa: true, ...parsed.data })
      // Se devuelve la familia completa, no solo los 4 campos de antes: el
      // drawer se queda con este objeto como "familia seleccionada", y al
      // pulsar "Editar familia" pintaría vacíos el DNI y la dirección que
      // se acababan de guardar.
      .select("id, nombre, email, telefono, dni, direccion, ciudad, codigo_postal, metodo_pago, codigo_sepa, notas")
      .single();

    if (error) {
      req.log.error({ err: error, requestId }, "academia familias create failed");
      return fail(reply, 500, "familia_create_failed", "Failed to create familia", requestId);
    }
    return created(reply, { familia: data }, requestId);
  });
}
