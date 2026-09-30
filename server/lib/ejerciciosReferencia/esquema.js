import { z } from "zod";

// LA FORMA DE UN ARCHIVO DE EJERCICIOS DE REFERENCIA (datos/…/tema.json).
// Ver referencias.js para qué son y de dónde salen.
const Comprobacion = z.object({
  tipo: z.enum(["ecuacion", "sistema", "igualdad", "valor", "estadistica"]),
  apartado: z.string().max(20).optional(),
  enunciado: z.string().max(2000).optional(),
  respuesta: z.unknown(),
}).passthrough();

export const EjercicioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(40),
  tipo: z.string().min(1).max(80),
  dificultad: z.number().int().min(1).max(3),
  saberes: z.array(z.string().regex(/^[A-H]\.\d{1,2}$/)).min(1),
  enunciado: z.string().min(1).max(4000),
  solucion: z.string().min(1).max(4000),
  solucion_generada: z.boolean().optional(),
  comprobar: z.array(Comprobacion).min(1).optional(),
  // "comprobada": el código ha resuelto el ejercicio y la solución cuadra.
  // "sin_verificar": no se puede comprobar con código (un problema abierto,
  // un texto…). Un ejercicio con la solución mal no llega a estar aquí.
  verificacion: z.enum(["comprobada", "sin_verificar"]),
  fuente: z.string().min(1).max(40),
  ref: z.string().max(120).optional(),
}).strict();

export const TemaSchema = z.object({
  materia: z.string().regex(/^[a-z0-9-]+$/),
  etapa: z.enum(["primaria", "eso", "bachillerato"]),
  curso: z.number().int().min(1).max(6),
  tema: z.string().regex(/^[a-z0-9-]+$/),
  titulo: z.string().min(1).max(120),
  saberes: z.array(z.string().regex(/^[A-H]\.\d{1,2}$/)).min(1),
  fuentes: z.record(z.string(), z.object({ nombre: z.string(), url: z.string().url(), licencia: z.string() }).strict()),
  ejercicios: z.array(EjercicioSchema).min(1),
}).strict();
