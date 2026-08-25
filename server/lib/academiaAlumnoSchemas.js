import { z } from "zod";

// Esquemas Zod del recurso alumno de academia — separados de
// academia.alumnos.routes.js (que ya rozaba las 400 líneas) para que cada
// archivo tenga una única responsabilidad: validación vs. handlers.

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export const FamiliaNuevaSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  dni: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().optional().nullable(),
  codigo_postal: z.string().trim().optional().nullable(),
  metodo_pago: z.enum(["bizum", "domiciliado", "transferencia", "efectivo"]).optional().nullable(),
  codigo_sepa: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
});

export const HorarioEntrySchema = z.object({
  // 1-7 (ISO 8601: 1=lunes … 7=domingo), alineado con el CHECK de
  // academia_horario (migración 102) y con dias_laborables de
  // academia_config, que ya aceptaba 1-7 desde la 057. Antes era max(6):
  // no bloqueaba nada que la UI ofreciera, pero dejaba tres validaciones
  // del mismo dato con tres rangos distintos (5 en BD, 6 aquí, 7 en
  // config), y ese desajuste es justo lo que provocó el 500 del sábado.
  dia_semana: z.number().int().min(1).max(7),
  hora_inicio: z.string().regex(HORA_RE),
  hora_fin: z.string().regex(HORA_RE),
});

export const TarifaSchema = z.object({
  precio_bruto: z.number().min(0),
  descuento_pct: z.number().min(0).max(100).optional().default(0),
});

export const ListQuerySchema = z.object({
  activo: z.enum(["true", "false"]).optional(),
  // Búsqueda por nombre en servidor — necesaria desde que la lista pagina:
  // con solo una página en memoria, filtrar en cliente dejaría de
  // encontrar alumnos de otras páginas (ver alumnosList.js).
  q: z.string().trim().max(120).optional(),
  // page ausente = sin paginar (comportamiento de siempre, lo usan los
  // pickers de "todos los alumnos activos" como familiaCompleta.js) — solo
  // se pagina cuando el llamador pide una página explícita.
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// "" en vez de null/ausente rompía z.string().email() con un 400 confuso
// (mismo problema ya visto en academia.familias.routes.js) — el frontend
// ya manda null para el campo vacío, esto es solo defensa en profundidad.
const vacioAUndefined = (v) => (v === "" ? undefined : v);

export const ContactoAlumnoSchema = {
  email: z.preprocess(vacioAUndefined, z.string().trim().email().optional().nullable()),
  telefono: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  ciudad: z.string().trim().optional().nullable(),
  codigo_postal: z.string().trim().optional().nullable(),
};

const baseAlumnoCreate = z.object({
  nombre: z.string().trim().min(1),
  curso: z.string().trim().min(1),
  fecha_alta: z.string().regex(FECHA_RE),
  // false para los borradores creados desde una ficha de inscripción
  // escaneada (OCR) — el admin los revisa y activa desde la pestaña
  // "Pendientes" antes de que el alumno aparezca como activo.
  activo: z.boolean().optional().default(true),
  ...ContactoAlumnoSchema,
  familia_id: z.string().uuid().optional().nullable(),
  familia_nueva: FamiliaNuevaSchema.optional().nullable(),
  // Edita en el sitio una familia existente elegida en el selector, antes
  // de vincularla al alumno nuevo (mismo botón "Editar" que en PUT /:id).
  familia_actualizada: FamiliaNuevaSchema.optional().nullable(),
  horario: z.array(HorarioEntrySchema).optional().default([]),
  tarifa: TarifaSchema.optional().nullable(),
});

// Fábrica en vez de un esquema constante: si el centro todavía no ha
// repartido el tutor (academia_config.acceso_tutor_activo = false, ver
// migración 105) el email del alumno no se le puede exigir — no hay ningún
// acceso que darle, y bloquear el alta por ese dato obliga a inventarse un
// correo para poder guardar la ficha.
//
// El email de la FAMILIA se exige siempre, tenga el centro el tutor
// encendido o no: es la dirección a la que van recibos e informes, que es
// justo lo que un centro usa antes de repartir el tutor.
export function buildAlumnoCreateSchema({ exigeEmailAlumno = true } = {}) {
  return baseAlumnoCreate.superRefine((data, ctx) => {
    // Solo al guardar como alumno ACTIVO (botón "Guardar" del drawer). Los
    // borradores (activo:false — botón "Borrador", o ficha OCR pendiente de
    // revisar) no lo exigen nunca; se completa después desde su ficha.
    if (exigeEmailAlumno && data.activo !== false && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "El email del alumno es obligatorio para poder invitarle al tutor",
      });
    }
    // Defensa en profundidad para familia_nueva: el flujo real de "crear
    // familia" hoy pasa por un endpoint aparte (POST /academia/familias, ver
    // selectorFamiliaDrawer.js) que ya exige email — el drawer de alumno ya
    // no manda familia_nueva relleno. Esto cubre igual cualquier otro caller
    // que sí lo use, con la misma regla.
    if (data.activo !== false && data.familia_nueva && !data.familia_nueva.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["familia_nueva", "email"],
        message: "El email de la familia es obligatorio para el envío de facturas e informes",
      });
    }
  });
}

// El comportamiento de un centro con el tutor encendido. Se mantiene como
// export con nombre para no cambiar a sus consumidores actuales (tests y
// cualquier caller que no dependa de la config del centro).
export const AlumnoCreateSchema = buildAlumnoCreateSchema();

export const AlumnoUpdateSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  curso: z.string().trim().min(1).optional(),
  fecha_alta: z.string().regex(FECHA_RE).optional(),
  ...ContactoAlumnoSchema,
  familia_id: z.string().uuid().nullable().optional(),
  familia_nueva: FamiliaNuevaSchema.optional().nullable(),
  // Edita en el sitio la familia YA vinculada al alumno (botón "Editar" del
  // drawer sobre una familia existente) — distinto de familia_nueva, que
  // siempre crea una fila nueva.
  familia_actualizada: FamiliaNuevaSchema.optional().nullable(),
  tarifa: TarifaSchema.optional().nullable(),
});

export const HorarioUpdateSchema = z.object({ horario: z.array(HorarioEntrySchema) });
export const ParamsSchema = z.object({ id: z.string().uuid() });
