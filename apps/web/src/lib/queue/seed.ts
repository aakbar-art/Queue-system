import type { QueueState } from "./schema";

function uid() {
  return crypto.randomUUID();
}

export function createSeedState(): QueueState {
  const now = new Date().toISOString();
  const clinicType = "general" as const;

  const rooms = [
    { id: uid(), name: "Room 1", doctorId: null as string | null, doctorDisplay: null, specialtyDisplay: null },
    { id: uid(), name: "Room 2", doctorId: null as string | null, doctorDisplay: null, specialtyDisplay: null },
  ];

  const doctors = [
    {
      id: uid(),
      userId: null as string | null,
      fullName: "Dr. Sample",
      specialty: "General",
      bio: "Demo doctor",
      timetable: [
        { day: "mon" as const, start: "09:00", end: "12:00" },
        { day: "mon" as const, start: "14:00", end: "17:00" },
      ],
    },
  ];

  const adminId = uid();
  const frontId = uid();
  const docUserId = uid();

  const users = [
    {
      id: adminId,
      username: "admin",
      password: "admin123",
      fullName: "Queue Administrator",
      roles: ["admin"] as const,
      roomId: null,
      active: true,
      sectionAccess: null,
    },
    {
      id: frontId,
      username: "front",
      password: "front123",
      fullName: "Front Desk",
      roles: ["front_desk"] as const,
      roomId: rooms[0].id,
      active: true,
      sectionAccess: null,
    },
    {
      id: docUserId,
      username: "doctor",
      password: "doctor123",
      fullName: "Dr. Counter",
      roles: ["doctor"] as const,
      roomId: rooms[0].id,
      active: true,
      sectionAccess: null,
    },
  ];

  const catId = uid();
  const serviceCategories = [
    { id: catId, name: "Consultation", clinicType },
    { id: uid(), name: "Follow-up", clinicType },
  ];

  const services = [
    {
      id: uid(),
      categoryId: catId,
      name: "Standard consult",
      estMinutes: 15,
      clinicType,
      active: true,
    },
    {
      id: uid(),
      categoryId: catId,
      name: "Extended consult",
      estMinutes: 30,
      clinicType,
      active: true,
    },
  ];

  return {
    rev: 1,
    paused: false,
    nextNumber: 4,
    receiptSeq: 100,
    tickets: [
      {
        id: uid(),
        code: "A-001",
        number: 1,
        priority: "normal",
        source: "walk_in",
        status: "completed",
        patientId: null,
        phone: null,
        serviceId: services[0].id,
        roomId: rooms[0].id,
        doctorId: doctors[0].id,
        createdAt: now,
        calledAt: now,
        completedAt: now,
        notes: null,
      },
      {
        id: uid(),
        code: "A-002",
        number: 2,
        priority: "priority",
        source: "whatsapp",
        status: "waiting",
        patientId: null,
        phone: "+15550001111",
        serviceId: services[0].id,
        roomId: null,
        doctorId: null,
        createdAt: now,
        calledAt: null,
        completedAt: null,
        notes: null,
      },
      {
        id: uid(),
        code: "A-003",
        number: 3,
        priority: "emergency",
        source: "walk_in",
        status: "waiting",
        patientId: null,
        phone: null,
        serviceId: services[1].id,
        roomId: null,
        doctorId: null,
        createdAt: now,
        calledAt: null,
        completedAt: null,
        notes: null,
      },
    ],
    patients: [],
    sessions: {},
    users,
    rooms,
    doctors,
    approvals: [],
    fees: [],
    reservationCodes: [
      { id: uid(), code: "DEMO-RESERVE", active: true, consumedAt: null, consumedByPhone: null, note: "Demo reservation" },
    ],
    serviceCategories,
    services,
    config: {
      clinicName: "ArcEdge Demo Clinic",
      brandShort: "ArcEdge",
      clinicType,
      currency: "USD",
      ticketPrefix: "A",
      consultationFeeHelp: "Pay consultancy fee before queue tier selection unless you have a reservation code.",
      consultancyTiers: [
        { id: uid(), name: "Standard", amount: 25, active: true },
        { id: uid(), name: "Priority", amount: 50, active: true },
        { id: uid(), name: "Emergency", amount: 100, active: true },
      ],
    },
    notifications: {
      proximityMinutes: 10,
      notifyOnIntakeSteps: true,
      notifyOnCalled: true,
    },
    logs: [
      {
        id: uid(),
        at: now,
        actor: "system",
        action: "seed",
        ticketCode: null,
        detail: "Initial demo state loaded",
      },
    ],
  };
}
