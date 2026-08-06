// Centralized API client for RoadGuard Backend

const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('roadguard_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('roadguard_token', token);
  } else {
    localStorage.removeItem('roadguard_token');
  }
}

export function getCurrentUser() {
  const user = localStorage.getItem('roadguard_user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('roadguard_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('roadguard_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = options.headers || {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred');
  }

  return data;
}

export const api = {
  // Auth
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getProfile: () => request('/auth/me'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Reports
  getReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/reports${query ? `?${query}` : ''}`);
  },
  getReportById: (id) => request(`/reports/${id}`),
  createReport: (formData) => request('/reports', { method: 'POST', body: formData }),
  updateReportStatus: (id, status) => request(`/reports/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  voteReport: (id) => request(`/reports/${id}/vote`, { method: 'POST' }),
  addComment: (id, text) => request(`/reports/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Dashboard & Stats
  getDashboardStats: () => request('/dashboard/stats'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),

  // Contact
  sendContact: (data) => request('/contact', { method: 'POST', body: JSON.stringify(data) })
};
