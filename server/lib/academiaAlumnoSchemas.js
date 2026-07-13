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
  dia_semana: z.number().int().min(1).max(6),
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

export const AlumnoCreateSchema = z.object({
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
}).superRefine((data, ctx) => {
  // El email del alumno es obligatorio para poder invitarle al tutor — pero
  // solo cuando se guarda como alumno activo (botón "Guardar" del drawer).
  // Los borradores (activo:false — botón "Borrador", o ficha OCR pendiente
  // de revisar) no lo exigen todavía; se completa después desde su ficha.
  if (data.activo !== false && !data.email) {
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
