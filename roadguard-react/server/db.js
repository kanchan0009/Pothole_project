import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, 'roadguard-db.json');

// Default initial state
const defaultDbData = {
  users: [],
  reports: [],
  comments: [],
  votes: [],
  notifications: [],
  contact_messages: [],
  counters: {
    users: 1,
    reports: 1,
    comments: 1,
    votes: 1,
    notifications: 1,
    contact_messages: 1
  }
};

let dbData = { ...defaultDbData };

function saveDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

function loadDb() {
  if (fs.existsSync(dbFilePath)) {
    try {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      dbData = JSON.parse(raw);
    } catch (err) {
      console.error('Error reading database file, initializing defaults:', err);
      dbData = { ...defaultDbData };
    }
  }
}

export function initDb() {
  loadDb();

  // Seed default admin and user if empty
  if (dbData.users.length === 0) {
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const userPassword = bcrypt.hashSync('user123', 10);

    const admin = {
      id: dbData.counters.users++,
      name: 'Admin User',
      email: 'admin@roadguard.com',
      password_hash: adminPassword,
      role: 'admin',
      phone: '555-0100',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      created_at: new Date().toISOString()
    };

    const user = {
      id: dbData.counters.users++,
      name: 'Alex Johnson',
      email: 'alex@example.com',
      password_hash: userPassword,
      role: 'user',
      phone: '555-0199',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      created_at: new Date().toISOString()
    };

    dbData.users.push(admin, user);

    dbData.notifications.push(
      {
        id: dbData.counters.notifications++,
        user_id: user.id,
        title: 'Report Status Updated',
        message: 'Your reported pothole on 5th Ave status changed to In Progress.',
        type: 'success',
        is_read: 0,
        created_at: new Date().toISOString()
      },
      {
        id: dbData.counters.notifications++,
        user_id: user.id,
        title: 'Welcome to RoadGuard',
        message: 'Thank you for registering! Start reporting hazards in your community.',
        type: 'info',
        is_read: 0,
        created_at: new Date().toISOString()
      }
    );
  }

  // Seed default reports if empty
  if (dbData.reports.length === 0) {
    const initialReports = [
      {
        title: 'Severe Pothole near Main Street Intersection',
        description: 'Large, deep pothole causing severe vehicle damage and traffic slowdowns during peak hours.',
        category: 'Pothole',
        severity: 'High',
        status: 'In Progress',
        location: 'Main St & 4th Ave, Downtown',
        img_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
        votes_count: 24,
        created_at: '2026-08-01T10:30:00.000Z',
        comments: [
          { name: 'Sarah Miller', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', text: 'Damaged my tire here yesterday. Glad work is in progress!' },
          { name: 'City Works Dept', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', text: 'Repair crew assigned. Scheduled for completion tomorrow.' }
        ]
      },
      {
        title: 'Broken Traffic Light at Oak & Pine',
        description: 'Traffic signals are flashing red in all directions causing confusion.',
        category: 'Traffic Light',
        severity: 'Critical',
        status: 'Pending',
        location: 'Oak St & Pine Rd',
        img_url: 'https://images.unsplash.com/photo-1508873696983-2df515122519?w=600',
        votes_count: 42,
        created_at: '2026-08-04T14:15:00.000Z',
        comments: [
          { name: 'Mark Davis', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', text: 'Nearly had a collision here this morning. Please fix ASAP!' }
        ]
      },
      {
        title: 'Faded Crosswalk Markings near Elementary School',
        description: 'Pedestrian paint has completely worn off making it unsafe for school children.',
        category: 'Signage/Paint',
        severity: 'Medium',
        status: 'Resolved',
        location: 'Maple Ave Elementary Zone',
        img_url: 'https://images.unsplash.com/photo-1456428746267-a1756408f782?w=600',
        votes_count: 18,
        created_at: '2026-07-25T09:00:00.000Z',
        comments: [
          { name: 'City Works Dept', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', text: 'Repainting completed on July 28th.' }
        ]
      },
      {
        title: 'Blocked Drainage Causing Road Flooding',
        description: 'Storm drain clogged with debris causing water buildup across two lanes.',
        category: 'Drainage',
        severity: 'High',
        status: 'Pending',
        location: 'River Road Mile 3',
        img_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b2?w=600',
        votes_count: 15,
        created_at: '2026-08-05T11:20:00.000Z',
        comments: []
      },
      {
        title: 'Damaged Guardrail after Storm',
        description: 'Metal guardrail bent into shoulder area following recent storm damage.',
        category: 'Safety Barrier',
        severity: 'Medium',
        status: 'In Progress',
        location: 'Highland Expressway Exit 12',
        img_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600',
        votes_count: 9,
        created_at: '2026-08-02T16:45:00.000Z',
        comments: []
      }
    ];

    initialReports.forEach(r => {
      const reportId = dbData.counters.reports++;
      const reportObj = {
        id: reportId,
        user_id: 2,
        title: r.title,
        description: r.description,
        category: r.category,
        severity: r.severity,
        status: r.status,
        location: r.location,
        latitude: null,
        longitude: null,
        img_url: r.img_url,
        votes_count: r.votes_count,
        created_at: r.created_at,
        updated_at: r.created_at
      };
      dbData.reports.push(reportObj);

      r.comments.forEach(c => {
        dbData.comments.push({
          id: dbData.counters.comments++,
          report_id: reportId,
          user_id: 1,
          author_name: c.name,
          author_avatar: c.avatar,
          text: c.text,
          created_at: r.created_at
        });
      });
    });
  }

  saveDb();
  console.log('RoadGuard JSON Database initialized successfully.');
}

// Database helper functions
export const db = {
  // Users
  findUserByEmail: (email) => dbData.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findUserById: (id) => dbData.users.find(u => u.id === Number(id)),
  createUser: (user) => {
    const newUser = {
      id: dbData.counters.users++,
      created_at: new Date().toISOString(),
      ...user
    };
    dbData.users.push(newUser);
    saveDb();
    return newUser;
  },
  updateUser: (id, updates) => {
    const idx = dbData.users.findIndex(u => u.id === Number(id));
    if (idx !== -1) {
      dbData.users[idx] = { ...dbData.users[idx], ...updates };
      saveDb();
      return dbData.users[idx];
    }
    return null;
  },

  // Reports
  queryReports: ({ category, status, severity, search, page = 1, limit = 10 }) => {
    let filtered = [...dbData.reports];

    if (category && category !== 'All') {
      filtered = filtered.filter(r => r.category === category);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter(r => r.status === status);
    }
    if (severity && severity !== 'All') {
      filtered = filtered.filter(r => r.severity === severity);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(q) || 
        r.description.toLowerCase().includes(q) || 
        r.location.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return { total, reports: paginated };
  },

  findReportById: (id) => dbData.reports.find(r => r.id === Number(id)),

  createReport: (report) => {
    const newReport = {
      id: dbData.counters.reports++,
      votes_count: 0,
      status: 'Pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...report
    };
    dbData.reports.push(newReport);
    saveDb();
    return newReport;
  },

  updateReportStatus: (id, status) => {
    const report = dbData.reports.find(r => r.id === Number(id));
    if (report) {
      report.status = status;
      report.updated_at = new Date().toISOString();
      saveDb();
      return report;
    }
    return null;
  },

  // Comments
  getCommentsForReport: (reportId) => {
    return dbData.comments
      .filter(c => c.report_id === Number(reportId))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  addComment: (comment) => {
    const newComment = {
      id: dbData.counters.comments++,
      created_at: new Date().toISOString(),
      ...comment
    };
    dbData.comments.push(newComment);
    saveDb();
    return newComment;
  },

  // Votes
  hasUserVoted: (reportId, userId) => {
    return dbData.votes.some(v => v.report_id === Number(reportId) && v.user_id === Number(userId));
  },

  getUserVotedReportIds: (userId) => {
    return new Set(dbData.votes.filter(v => v.user_id === Number(userId)).map(v => v.report_id));
  },

  toggleVote: (reportId, userId) => {
    const rId = Number(reportId);
    const uId = Number(userId);
    const idx = dbData.votes.findIndex(v => v.report_id === rId && v.user_id === uId);
    const report = dbData.reports.find(r => r.id === rId);

    if (!report) return null;

    let has_voted = false;
    if (idx !== -1) {
      dbData.votes.splice(idx, 1);
      report.votes_count = Math.max(0, report.votes_count - 1);
    } else {
      dbData.votes.push({ id: dbData.counters.votes++, report_id: rId, user_id: uId, created_at: new Date().toISOString() });
      report.votes_count++;
      has_voted = true;
    }

    saveDb();
    return { votes_count: report.votes_count, has_voted };
  },

  // Notifications
  getNotificationsForUser: (userId) => {
    return dbData.notifications
      .filter(n => n.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  addNotification: (notification) => {
    const newNotif = {
      id: dbData.counters.notifications++,
      is_read: 0,
      created_at: new Date().toISOString(),
      ...notification
    };
    dbData.notifications.push(newNotif);
    saveDb();
    return newNotif;
  },

  markNotificationRead: (id, userId) => {
    const notif = dbData.notifications.find(n => n.id === Number(id) && n.user_id === Number(userId));
    if (notif) {
      notif.is_read = 1;
      saveDb();
      return notif;
    }
    return null;
  },

  // Contact
  addContactMessage: (msg) => {
    const newMsg = {
      id: dbData.counters.contact_messages++,
      created_at: new Date().toISOString(),
      ...msg
    };
    dbData.contact_messages.push(newMsg);
    saveDb();
    return newMsg;
  },

  // Dashboard stats
  getDashboardStats: () => {
    const total = dbData.reports.length;
    const resolved = dbData.reports.filter(r => r.status === 'Resolved').length;
    const in_progress = dbData.reports.filter(r => r.status === 'In Progress').length;
    const pending = dbData.reports.filter(r => r.status === 'Pending').length;
    const under_review = dbData.reports.filter(r => r.status === 'Under Review').length;

    const critical = dbData.reports.filter(r => r.severity === 'Critical').length;
    const high = dbData.reports.filter(r => r.severity === 'High').length;
    const medium = dbData.reports.filter(r => r.severity === 'Medium').length;
    const low = dbData.reports.filter(r => r.severity === 'Low').length;

    // Categories count
    const catMap = {};
    dbData.reports.forEach(r => {
      catMap[r.category] = (catMap[r.category] || 0) + 1;
    });

    const categories = Object.keys(catMap).map(c => ({ category: c, count: catMap[c] }));

    const recentActivity = [...dbData.reports]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(r => {
        const u = dbData.users.find(user => user.id === r.user_id);
        return {
          id: r.id,
          title: r.title,
          category: r.category,
          status: r.status,
          severity: r.severity,
          created_at: r.created_at,
          author_name: u ? u.name : 'Community User'
        };
      });

    return {
      overview: {
        total,
        resolved,
        in_progress,
        pending,
        under_review,
        resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0
      },
      severity: { critical, high, medium, low },
      categories,
      recentActivity
    };
  }
};

export default db;
