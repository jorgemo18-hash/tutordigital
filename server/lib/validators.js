import { z } from "zod";

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GroupsQuerySchema = PaginationSchema;

export const GroupCreateSchema = z.object({
  name: z.string().min(1).max(80),
  level: z.string().max(20).optional(),
});

export const GroupPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  level: z.string().max(20).optional(),
});

export const StudentsQuerySchema = PaginationSchema.extend({
  groupId: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  approval_status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const StudentCreateSchema = z.object({
  display_name: z.string().min(2).max(80),
  group_id: z.string().uuid().optional(),
  status: z.enum(["needs_teacher", "pending", "submitted"]).optional(),
  user_id: z.string().uuid().optional(),
  approval_status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const StudentPatchSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(2).max(80).optional(),
  group_id: z.string().uuid().optional(),
  status: z.enum(["needs_teacher", "pending", "submitted"]).optional(),
  user_id: z.string().uuid().nullable().optional(),
  approval_status: z.enum(["pending", "approved", "rejected"]).optional(),
  rejected_reason: z.string().max(120).optional(),
});

export const TasksQuerySchema = PaginationSchema.extend({
  groupId: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const TaskCreateSchema = z.object({
  group_id: z.string().uuid(),
  type: z.enum(["homework", "exam", "work"]),
  title: z.string().min(1).max(120),
  desc: z.string().max(2000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subject_name: z.string().max(80).optional(),
  teacher_notes: z.string().max(2000).optional(),
});

export const TaskPatchSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid().optional(),
  type: z.enum(["homework", "exam", "work"]).optional(),
  title: z.string().min(1).max(120).optional(),
  desc: z.string().max(2000).optional(),
  due_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
  student_id: z.string().uuid().optional(),
  student_status: z.enum(["done", "needs_teacher", "pending"]).optional(),
  teacher_notes: z.string().max(2000).nullable().optional(),
});

export const TicketsQuerySchema = PaginationSchema.extend({
  status: z.enum(["open", "resolved"]).optional(),
  groupId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const TicketCreateSchema = z.object({
  title: z.string().min(1).max(140),
  detail: z.string().max(2000).optional(),
  student_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional(),
  teacher_id: z.string().uuid().nullable().optional(),
});

export const TicketPatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(140).optional(),
  detail: z.string().max(2000).optional(),
  status: z.enum(["open", "resolved"]).optional(),
  teacher_id: z.string().uuid().nullable().optional(),
});

export const NotebookQuerySchema = PaginationSchema.extend({
  studentId: z.string().uuid(),
});

export const NotebookCreateSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().min(1).max(140),
  score: z.string().min(1).max(40),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional(),
});

export const NotebookPatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(140).optional(),
  score: z.string().min(1).max(40).optional(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional(),
});
