import { z } from "zod";

export const roleSchema = z.enum(["admin", "front_desk", "doctor"]);
export const ticketStatusSchema = z.enum([
  "waiting",
  "called",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);
export const prioritySchema = z.enum(["normal", "priority", "emergency"]);
export const sourceSchema = z.enum(["whatsapp", "walk_in"]);
export const clinicTypeSchema = z.enum(["dental", "lab", "opd", "emergency", "general"]);
export const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const adminSectionSchema = z.enum([
  "queue",
  "approvals",
  "rooms",
  "fees",
  "services",
  "users",
  "doctors",
  "settings",
  "reservations",
  "reports",
  "notifications",
]);

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string().optional(),
  passwordHash: z.string().optional(),
  fullName: z.string(),
  roles: z.array(roleSchema),
  roomId: z.string().optional().nullable(),
  active: z.boolean(),
  sectionAccess: z.array(adminSectionSchema).optional().nullable(),
});

export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  doctorId: z.string().optional().nullable(),
  doctorDisplay: z.string().optional().nullable(),
  specialtyDisplay: z.string().optional().nullable(),
});

export const timetableSlotSchema = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  start: z.string(),
  end: z.string(),
});

export const doctorSchema = z.object({
  id: z.string(),
  userId: z.string().optional().nullable(),
  fullName: z.string(),
  specialty: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  timetable: z.array(timetableSlotSchema),
});

export const patientSchema = z.object({
  id: z.string(),
  phone: z.string(),
  fullName: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  age: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const ticketSchema = z.object({
  id: z.string(),
  code: z.string(),
  number: z.number(),
  priority: prioritySchema,
  source: sourceSchema,
  status: ticketStatusSchema,
  patientId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  createdAt: z.string(),
  calledAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["bot", "user", "system"]),
  text: z.string(),
  at: z.string(),
  attachmentUrl: z.string().optional().nullable(),
  kind: z.enum(["text", "pdf", "image"]).default("text"),
});

export const whatsappSessionSchema = z.object({
  phone: z.string(),
  step: z.string(),
  draft: z.record(z.string(), z.unknown()).default({}),
  messages: z.array(chatMessageSchema),
  pendingApprovalId: z.string().optional().nullable(),
  ticketId: z.string().optional().nullable(),
});

export const approvalSchema = z.object({
  id: z.string(),
  patient: patientSchema,
  evidence: z.object({
    imageDataUrl: z.string(),
    note: z.string().optional().nullable(),
    at: z.string(),
  }),
  serviceId: z.string().optional().nullable(),
  feeAmount: z.number().optional().nullable(),
  priority: prioritySchema.optional().nullable(),
  consultancyAmount: z.number().optional().nullable(),
  status: approvalStatusSchema,
  createdAt: z.string(),
});

export const feeLineSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  gross: z.number(),
  discount: z.number(),
  net: z.number(),
  paid: z.number(),
  refund: z.number(),
  status: z.enum(["open", "partial", "settled", "refunded"]),
  receiptNo: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  reservationCodeId: z.string().optional().nullable(),
  createdAt: z.string(),
});

export const reservationCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  active: z.boolean(),
  consumedAt: z.string().optional().nullable(),
  consumedByPhone: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const serviceCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  clinicType: clinicTypeSchema,
});

export const serviceSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  estMinutes: z.number(),
  clinicType: clinicTypeSchema,
  active: z.boolean(),
});

export const consultancyTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number(),
  active: z.boolean(),
});

export const queueConfigSchema = z.object({
  clinicName: z.string(),
  brandShort: z.string(),
  clinicType: clinicTypeSchema,
  currency: z.string(),
  ticketPrefix: z.string(),
  consultationFeeHelp: z.string(),
  consultancyTiers: z.array(consultancyTierSchema),
});

export const notificationsSchema = z.object({
  proximityMinutes: z.number(),
  notifyOnIntakeSteps: z.boolean(),
  notifyOnCalled: z.boolean(),
});

export const logEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  ticketCode: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
});

export const sessionsMapSchema = z.record(z.string(), whatsappSessionSchema);

export const queueStateSchema = z.object({
  rev: z.number(),
  paused: z.boolean(),
  nextNumber: z.number(),
  receiptSeq: z.number(),
  tickets: z.array(ticketSchema),
  patients: z.array(patientSchema),
  sessions: sessionsMapSchema,
  users: z.array(userSchema),
  rooms: z.array(roomSchema),
  doctors: z.array(doctorSchema),
  approvals: z.array(approvalSchema),
  fees: z.array(feeLineSchema),
  reservationCodes: z.array(reservationCodeSchema),
  serviceCategories: z.array(serviceCategorySchema),
  services: z.array(serviceSchema),
  config: queueConfigSchema,
  notifications: notificationsSchema,
  logs: z.array(logEntrySchema),
});

export type QueueState = z.infer<typeof queueStateSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type User = z.infer<typeof userSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Doctor = z.infer<typeof doctorSchema>;
export type Patient = z.infer<typeof patientSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type FeeLine = z.infer<typeof feeLineSchema>;
export type WhatsAppSession = z.infer<typeof whatsappSessionSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type Role = z.infer<typeof roleSchema>;
export type AdminSection = z.infer<typeof adminSectionSchema>;
export type ClinicType = z.infer<typeof clinicTypeSchema>;
