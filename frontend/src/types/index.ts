export type Role = 'USER' | 'ADMIN';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReportStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'REMOVED';


export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}


export interface DetectionResult {
  isPothole: boolean;
  confidence: number;
  boundingBox: DetectionBox | null;
  previewUrl: string | null;
  
  severity?: Severity;
  
  classProbs?: number[];
  
  message?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Report {
  id: number;
  userId: number;
  title: string;
  description: string;
  imageUrl: string;
  roadName: string;
  municipality: string;
  ward: string;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  severity: Severity;
  status: ReportStatus;
  duplicate: boolean;
  priorityScore: number;
  confidenceScore?: number | null;
  boundingBox?: DetectionBox | null;
  detectedImageUrl?: string | null;
  aiVerified?: boolean | null;
  aiRejectedReason?: string | null;
  
  aiSeverity?: Severity | null;
  
  aiClassProbs?: number[] | null;
  
  suggestedSeverity?: Severity | null;
  
  confirmations?: number;
  completionImageUrl?: string | null;
  rejectionReason?: string | null;
  reporterName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: number;
  reportId: number;
  status: ReportStatus;
  remarks?: string | null;
  updatedBy?: string | null;
  createdAt: string;
}

export interface Assignment {
  id: number;
  reportId: number;
  userId?: number | null;
  assignedTo: string;
  assignedAt: string;
}

export interface ReportLocation {
  id: number;
  reportId: number;
  latitude: number;
  longitude: number;
}


export interface DetailHistoryEntry {
  id: number;
  reportId: number;
  status: ReportStatus;
  remarks?: string | null;
  updatedBy?: { id: number; name: string } | null;
  createdAt: string;
}

export interface ReportDetail extends Report {
  location?: ReportLocation | null;
  history?: DetailHistoryEntry[];
  assignments?: Assignment[];
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}


export interface MapCaptureDraft {
  previewUrl: string;
  latitude: number;
  longitude: number;
  roadName: string;
  municipality: string;
  ward: string;
  address: string;
  timestamp: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  reports: T[];
  pagination: Pagination;
}

export interface StatusCounts {
  total: number;
  pending: number;
  verified: number;
  assigned: number;
  inProgress: number;
  completed: number;
  rejected: number;
}

export interface NotificationList {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
}

export interface AdminLog {
  id: number;
  adminName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isWorker: boolean;
  isActive: boolean;
  latitude?: number | null;
  longitude?: number | null;
  reportCount: number;
  createdAt: string;
}

export interface Worker {
  id: number;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}


export interface PriorityQueueItem {
  rank: number;
  ref: string;
  id: number;
  title: string;
  severity: Severity;
  status: ReportStatus;
  priorityScore: number;
  confirmations: number;
  ageDays: number;
  municipality: string;
  ward: string;
  hasCoords: boolean;
}

export interface PriorityQueueSnapshot {
  items: PriorityQueueItem[];
  size: number;
  peek: PriorityQueueItem | null;
}


export interface RoutePlan {
  reachable: boolean;
  reason?: 'off-network' | 'no-route' | 'no-coordinates' | 'no-workers';
  distanceKm?: number;
  etaMinutes?: number;
  
  path?: [number, number][];
  offNetworkM?: number;
}

export interface RouteTeam {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface ReportRoute {
  reportId: number;
  route: RoutePlan;
  team: RouteTeam | null;
  teamSource: 'assigned' | 'nearest' | 'selected' | null;
}

export interface DispatchResult {
  processed: boolean;
  report: ReportDetail | null;
  route: RoutePlan | null;
  team: RouteTeam | null;
  teamSource: 'assigned' | 'nearest' | 'selected' | null;
}

export interface UserListResult {
  users: AdminUser[];
  pagination: Pagination;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface ContactMessageList {
  messages: ContactMessage[];
  pagination: Pagination;
}

export interface DashboardData {
  counts: StatusCounts;
  today: number;
  monthly: number;
  avgResolutionHours: number | null;
  recentReports: Report[];
  recentActivity: AdminLog[];
  notifications: NotificationList;
}

export interface TimeSeriesPoint {
  label: string;
  count: number;
}

export interface TopRoad {
  roadName: string;
  count: number;
}

export interface TopArea {
  municipality: string;
  ward: string;
  count: number;
}

export interface TopUser {
  userId: number;
  name: string;
  count: number;
}

export interface StatisticsData {
  period: string;
  total: number;
  status: StatusCounts;
  severity: Record<Severity, number>;
  timeSeries: TimeSeriesPoint[];
  topRoads: TopRoad[];
  topAreas: TopArea[];
  topUsers: TopUser[];
  completionRate: number;
  avgResolutionHours: number | null;
  aiAccuracy: number | null;
  heatmap: [number, number, number][];
}
