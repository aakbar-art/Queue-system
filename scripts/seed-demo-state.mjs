/**
 * Writes server/data/snapshot.json with demo users (bcrypt hashes) when --force or file missing.
 * Run from repo root: node scripts/seed-demo-state.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const target = path.join(root, "server", "data", "snapshot.json");
const force = process.argv.includes("--force");

if (fs.existsSync(target) && !force) {
  console.log("snapshot exists; use --force to overwrite");
  process.exit(0);
}

const h = (p) => bcrypt.hashSync(p, 10);

const roomId = randomUUID();
const adminId = randomUUID();
const frontId = randomUUID();
const docId = randomUUID();
const catId = randomUUID();
const svcId = randomUUID();
const docProfileId = randomUUID();

const state = {
  rev: 1,
  paused: false,
  nextNumber: 2,
  receiptSeq: 100,
  tickets: [
    {
      id: randomUUID(),
      code: "A-001",
      number: 1,
      priority: "normal",
      source: "walk_in",
      status: "waiting",
      patientId: null,
      phone: null,
      serviceId: svcId,
      roomId: null,
      doctorId: null,
      createdAt: new Date().toISOString(),
      calledAt: null,
      completedAt: null,
      notes: null,
    },
  ],
  patients: [],
  sessions: {},
  users: [
    {
      id: adminId,
      username: "admin",
      passwordHash: h("admin123"),
      fullName: "Queue Administrator",
      roles: ["admin"],
      roomId: null,
      active: true,
      sectionAccess: null,
    },
    {
      id: frontId,
      username: "front",
      passwordHash: h("front123"),
      fullName: "Front Desk",
      roles: ["front_desk"],
      roomId,
      active: true,
      sectionAccess: null,
    },
    {
      id: docId,
      username: "doctor",
      passwordHash: h("doctor123"),
      fullName: "Dr. Counter",
      roles: ["doctor"],
      roomId,
      active: true,
      sectionAccess: null,
    },
  ],
  rooms: [{ id: roomId, name: "Room 1", doctorId: null, doctorDisplay: null, specialtyDisplay: null }],
  doctors: [
    {
      id: docProfileId,
      userId: docId,
      fullName: "Dr. Counter",
      specialty: "General",
      bio: "Seeded",
      timetable: [{ day: "mon", start: "09:00", end: "12:00" }],
    },
  ],
  approvals: [],
  fees: [],
  reservationCodes: [
    {
      id: randomUUID(),
      code: "DEMO-RESERVE",
      active: true,
      consumedAt: null,
      consumedByPhone: null,
      note: "Demo",
    },
  ],
  serviceCategories: [{ id: catId, name: "Consultation", clinicType: "general" }],
  services: [
    {
      id: svcId,
      categoryId: catId,
      name: "Standard consult",
      estMinutes: 15,
      clinicType: "general",
      active: true,
    },
  ],
  config: {
    clinicName: "ArcEdge Seeded Clinic",
    brandShort: "ArcEdge",
    clinicType: "general",
    currency: "USD",
    ticketPrefix: "A",
    consultationFeeHelp: "Seeded snapshot for API login.",
    consultancyTiers: [{ id: randomUUID(), name: "Standard", amount: 25, active: true }],
  },
  notifications: {
    proximityMinutes: 10,
    notifyOnIntakeSteps: true,
    notifyOnCalled: true,
  },
  logs: [
    {
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: "seed",
      action: "bootstrap",
      ticketCode: null,
      detail: "scripts/seed-demo-state.mjs",
    },
  ],
};

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(state, null, 2));
console.log("Wrote", target);
