/**
 * Seed script — creates an admin, a demo citizen, three workers, twenty
 * sample reports (with locations, status history, assignments) and
 * notifications so the app has rich data out of the box.
 *
 * Run:  npm run db:seed   (from the repo root)
 */
import 'dotenv/config';
import { PrismaClient, Role, Severity, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

/** Unsplash road / infrastructure photos used as demo image placeholders. */
const IMAGES = [
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
  'https://images.unsplash.com/photo-1508873696983-2df515122519?w=600',
  'https://images.unsplash.com/photo-1456428746267-a1756408f782?w=600',
  'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b2?w=600',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600',
  'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?w=600',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600',
  'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600',
  'https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=600',
];

const daysAgo = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(9 + (days % 9), 15 + days, 0, 0);
  return d;
};

/** Mirrors the production priority algorithm weights (see src/algorithms/priority.ts). */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 20,
  LOW: 10,
};

function computePriority(
  severity: Severity,
  confirmations: number,
  createdAt: Date,
  traffic: number
): number {
  const severityWeight = SEVERITY_WEIGHT[severity];
  const confirmationsWeight = Math.min(4, confirmations) * 12;
  const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / 86_400_000);
  const ageWeight = Math.min(20, Math.round(ageDays));
  const trafficWeight = Math.min(10, traffic);
  return severityWeight + confirmationsWeight + ageWeight + trafficWeight;
}

interface SeedReport {
  imageUrl?: string;
  title: string;
  description: string;
  roadName: string;
  municipality: string;
  ward: string;
  landmark?: string;
  lat: number;
  lng: number;
  severity: Severity;
  status: Status;
  duplicate?: boolean;
  completionImageUrl?: string;
  rejectionReason?: string;
  daysAgo: number;
}

const REPORTS: SeedReport[] = [
  {
    title: 'Severe pothole near Main Street intersection',
    description: 'Large, deep pothole causing vehicle damage and traffic slowdowns during peak hours.',
    roadName: 'Main Street', municipality: 'Kathmandu', ward: '5',
    landmark: 'Ratna Park junction', lat: 27.7172, lng: 85.324,
    severity: Severity.HIGH, status: Status.IN_PROGRESS, daysAgo: 3,
  },
  {
    title: 'Broken traffic light at Oak & Pine',
    description: 'Signals flashing red in all directions, creating confusion for pedestrians and vehicles.',
    roadName: 'Pine Road', municipality: 'Kathmandu', ward: '9',
    landmark: 'Jhamsikhel', lat: 27.7115, lng: 85.3105,
    severity: Severity.CRITICAL, status: Status.PENDING, daysAgo: 1,
  },
  {
    title: 'Faded crosswalk near elementary school',
    description: 'Pedestrian paint has worn off, unsafe for school children crossing the road.',
    roadName: 'School Lane', municipality: 'Lalitpur', ward: '2',
    landmark: 'Pulchowk Campus', lat: 27.6766, lng: 85.316,
    severity: Severity.MEDIUM, status: Status.COMPLETED, daysAgo: 12,
    completionImageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=600',
  },
  {
    title: 'Blocked drainage causing road flooding',
    description: 'Storm drain clogged with debris causing water buildup across two lanes.',
    roadName: 'River Road', municipality: 'Kathmandu', ward: '14',
    landmark: 'Baneshwor', lat: 27.6982, lng: 85.3372,
    severity: Severity.HIGH, status: Status.ASSIGNED, daysAgo: 2,
  },
  {
    title: 'Damaged guardrail after storm',
    description: 'Metal guardrail bent into the shoulder area following recent storm damage.',
    roadName: 'Highland Expressway', municipality: 'Bhaktapur', ward: '3',
    landmark: 'Suryabinayak', lat: 27.6644, lng: 85.4278,
    severity: Severity.MEDIUM, status: Status.VERIFIED, daysAgo: 5,
  },
  {
    title: 'Cracked road surface near bridge',
    description: 'Wide cracks across the carriageway approaching the bridge, hazard for motorcycles.',
    roadName: 'Bridge Road', municipality: 'Kirtipur', ward: '4',
    landmark: 'Chovar gorge', lat: 27.6652, lng: 85.2851,
    severity: Severity.HIGH, status: Status.IN_PROGRESS, daysAgo: 6,
  },
  {
    title: 'Deep pothole on residential lane',
    description: 'Pothole half the lane width; cars must swerve onto the pavement.',
    roadName: 'Maple Lane', municipality: 'Kathmandu', ward: '16',
    landmark: 'Minbhawan', lat: 27.7016, lng: 85.3316,
    severity: Severity.MEDIUM, status: Status.PENDING, daysAgo: 0,
  },
  {
    title: 'Pothole cluster near market area',
    description: 'A series of small potholes across the market entrance, difficult for loaded rickshaws.',
    roadName: 'Market Road', municipality: 'Madhyapur Thimi', ward: '1',
    landmark: 'Thimi bazaar', lat: 27.6793, lng: 85.3769,
    severity: Severity.MEDIUM, status: Status.VERIFIED, daysAgo: 8,
  },
  {
    title: 'Sinkhole opening on highway shoulder',
    description: 'Edge of the road collapsing; guardrail posts exposed. Urgent attention required.',
    roadName: 'Araniko Highway', municipality: 'Bhaktapur', ward: '7',
    landmark: 'Nagarkot road junction', lat: 27.6739, lng: 85.4135,
    severity: Severity.CRITICAL, status: Status.REJECTED, daysAgo: 4,
    rejectionReason: 'Duplicate of report #104; already assigned to district works.',
  },
  {
    title: 'Worn speed bump on collector road',
    description: 'Speed bump has flattened, vehicles speed through a school-heavy residential area.',
    roadName: 'Balkumari Road', municipality: 'Lalitpur', ward: '8',
    landmark: 'Lagankhel bus park', lat: 27.6577, lng: 85.3258,
    severity: Severity.LOW, status: Status.COMPLETED, daysAgo: 18,
    completionImageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b2?w=600',
  },
  {
    title: 'Manhole cover missing on ring road',
    description: 'Open manhole on a fast stretch of the ring road; extremely dangerous at night.',
    roadName: 'Ring Road', municipality: 'Kathmandu', ward: '11',
    landmark: 'Koteshwor', lat: 27.6873, lng: 85.3394,
    severity: Severity.CRITICAL, status: Status.IN_PROGRESS, daysAgo: 7,
  },
  {
    title: 'Pothole at edge of carriageway',
    description: 'Deep edge pothole making lane changes hazardous in wet weather.',
    roadName: 'Tribhuvan Highway', municipality: 'Hetauda', ward: '3',
    landmark: 'Hetauda industrial area', lat: 27.4283, lng: 85.0321,
    severity: Severity.HIGH, status: Status.PENDING, daysAgo: 10,
  },
  {
    title: 'Stretch of damaged rural road',
    description: 'Gravel road heavily rutted after monsoon, difficult for farming vehicles.',
    roadName: 'Rural Access Road', municipality: 'Kirtipur', ward: '6',
    landmark: 'Naikap', lat: 27.6901, lng: 85.2741,
    severity: Severity.MEDIUM, status: Status.REJECTED, daysAgo: 14,
    rejectionReason: 'Outside municipal maintenance boundary; forwarded to province.',
  },
  {
    title: 'Cave-in after heavy rainfall',
    description: 'Large cavity under the asphalt near the bus stop; several near misses reported.',
    roadName: 'Kupondole Road', municipality: 'Lalitpur', ward: '5',
    landmark: 'Kupondole bus stop', lat: 27.6831, lng: 85.3184,
    severity: Severity.HIGH, status: Status.IN_PROGRESS, daysAgo: 9,
  },
  {
    title: 'Multiple potholes on main thoroughfare',
    description: 'Repetitive potholes across both lanes; cyclists swerving into traffic.',
    roadName: 'Putalisadak', municipality: 'Kathmandu', ward: '12',
    landmark: 'Putalisadak chowk', lat: 27.7042, lng: 85.3187,
    severity: Severity.HIGH, status: Status.PENDING, duplicate: true, daysAgo: 21,
  },
  {
    title: 'Newly patched section sinking',
    description: 'Recent patch repair already sinking, forming a new shallow pothole.',
    roadName: 'Old Baneshwor', municipality: 'Kathmandu', ward: '14',
    landmark: 'Sankhamul', lat: 27.6938, lng: 85.3262,
    severity: Severity.LOW, status: Status.COMPLETED, daysAgo: 25,
    completionImageUrl: 'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600',
  },
  {
    title: 'Water-filled pothole in rainy season',
    description: 'Pothole hidden under standing water; tires drop in unexpectedly.',
    roadName: 'Jhamel Road', municipality: 'Bhaktapur', ward: '9',
    landmark: 'Kamalbinayak', lat: 27.6676, lng: 85.4266,
    severity: Severity.MEDIUM, status: Status.ASSIGNED, daysAgo: 30,
  },
  {
    title: 'Pothole at city intersection',
    description: 'Hazard at a busy intersection where many buses turn; can catch front wheels.',
    roadName: 'Kanti Path', municipality: 'Kathmandu', ward: '3',
    landmark: 'Singha Durbar gate', lat: 27.6966, lng: 85.3244,
    severity: Severity.HIGH, status: Status.VERIFIED, daysAgo: 35,
  },
  {
    title: 'Sunken utility trench on side road',
    description: 'Utility trench backfill has settled, leaving a long depression.',
    roadName: 'Gairidhara', municipality: 'Kathmandu', ward: '17',
    landmark: 'Jhamsikhel heights', lat: 27.7222, lng: 85.3175,
    severity: Severity.LOW, status: Status.COMPLETED, daysAgo: 45,
    completionImageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600',
  },
  {
    title: 'Pothole near roundabout slip road',
    description: 'Pothole on the exit slip of a roundabout, easy to hit while merging.',
    roadName: 'Balkhu Road', municipality: 'Kirtipur', ward: '2',
    landmark: 'Balkhu roundabout', lat: 27.6883, lng: 85.2936,
    severity: Severity.MEDIUM, status: Status.PENDING, duplicate: true, daysAgo: 60,
  },
];

const WORKERS = [
  { name: 'Ramesh Shrestha', phone: '980-100-0001', lat: 27.7031, lng: 85.3184 },
  { name: 'Sunita Maharjan', phone: '980-100-0002', lat: 27.6766, lng: 85.316 },
  { name: 'Kiran Thapa', phone: '980-100-0003', lat: 27.6609, lng: 85.3203 },
];

async function main() {
  console.log('🌱 Seeding database…');

  // ---- Clean slate ---------------------------------------------------------
  await prisma.adminLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.location.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users ---------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@roadguard.gov',
      phone: '555-0100',
      passwordHash: hash('Admin@123'),
      role: Role.ADMIN,
    },
  });

  const citizen = await prisma.user.create({
    data: {
      name: 'Citizen Demo',
      email: 'citizen@example.com',
      phone: '555-0199',
      passwordHash: hash('User@123'),
      role: Role.USER,
    },
  });

  const workers = [] as { id: number; name: string }[];
  for (const w of WORKERS) {
    const user = await prisma.user.create({
      data: {
        name: w.name,
        email: w.name.toLowerCase().replace(/[^a-z]+/g, '.') + '@roadguard.gov',
        phone: w.phone,
        passwordHash: hash('Worker@123'),
        role: Role.USER,
        isWorker: true,
        latitude: w.lat,
        longitude: w.lng,
      },
    });
    workers.push({ id: user.id, name: user.name });
  }

  // ---- Reports -------------------------------------------------------------
  for (let i = 0; i < REPORTS.length; i++) {
    const r = REPORTS[i];
    if (!r) continue;
    const imageUrl = r.imageUrl ?? IMAGES[i % IMAGES.length] ?? '';
    const createdAt = daysAgo(r.daysAgo);
    const traffic = (i * 7) % 11; // deterministic pseudo-traffic factor
    // A few reports were "confirmed" by fellow citizens (duplicate confirmations).
    const confirmations = r.duplicate ? 2 : i % 6 === 0 ? 1 : 0;
    const priorityScore = computePriority(r.severity, confirmations, createdAt, traffic);

    const report = await prisma.report.create({
      data: {
        userId: citizen.id,
        title: r.title,
        description: r.description,
        imageUrl,
        roadName: r.roadName,
        municipality: r.municipality,
        ward: r.ward,
        landmark: r.landmark,
        latitude: r.lat,
        longitude: r.lng,
        severity: r.severity,
        status: r.status,
        duplicate: !!r.duplicate,
        priorityScore,
        // The citizen suggested the same severity the stored report carries.
        suggestedSeverity: r.severity,
        aiSeverity: r.severity,
        confirmations,
        completionImageUrl: r.completionImageUrl,
        rejectionReason: r.rejectionReason,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.location.create({
      data: {
        reportId: report.id,
        latitude: r.lat,
        longitude: r.lng,
        municipality: r.municipality,
        ward: r.ward,
        roadName: r.roadName,
        landmark: r.landmark,
      },
    });

    // Status history mirrors the report lifecycle.
    const FLOW: Status[] = [
      Status.PENDING,
      Status.VERIFIED,
      Status.ASSIGNED,
      Status.IN_PROGRESS,
      Status.COMPLETED,
    ];
    const entries =
      r.status === Status.REJECTED
        ? [Status.PENDING, Status.REJECTED]
        : FLOW.slice(0, FLOW.indexOf(r.status) + 1);

    for (let s = 0; s < entries.length; s++) {
      await prisma.statusHistory.create({
        data: {
          reportId: report.id,
          status: entries[s] as Status,
          updatedById: s === 0 ? undefined : admin.id,
          remarks:
            entries[s] === Status.REJECTED
              ? r.rejectionReason
              : entries[s] === Status.IN_PROGRESS
                ? 'Crew dispatched to site.'
                : entries[s] === Status.COMPLETED
                  ? 'Repair verified on site.'
                  : null,
          createdAt: new Date(createdAt.getTime() + s * 60 * 60 * 1000),
        },
      });
    }

    // Assignments for reports that reached the field.
    if (
      r.status === Status.ASSIGNED ||
      r.status === Status.IN_PROGRESS ||
      r.status === Status.COMPLETED
    ) {
      const worker = workers[i % workers.length];
      if (worker) {
        await prisma.assignment.create({
          data: {
            reportId: report.id,
            userId: worker.id,
            assignedTo: worker.name,
            assignedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  // ---- Notifications --------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        userId: citizen.id,
        title: 'Welcome to RoadGuard',
        message: 'Thank you for registering. Start reporting road hazards in your community.',
        isRead: false,
        createdAt: daysAgo(2),
      },
      {
        userId: citizen.id,
        title: 'Report status updated',
        message: 'Your report "Severe pothole near Main Street intersection" is now In Progress.',
        isRead: false,
        createdAt: daysAgo(1),
      },
      {
        userId: admin.id,
        title: 'New report submitted',
        message: 'A new PENDING report was submitted by Citizen Demo.',
        isRead: false,
        createdAt: daysAgo(1),
      },
    ],
  });

  const total = await prisma.report.count();
  const users = await prisma.user.count();
  console.log(`✅ Seeded ${users} users and ${total} reports.`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
