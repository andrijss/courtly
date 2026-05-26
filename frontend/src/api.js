export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";
export const API_ORIGIN = API_BASE.endsWith("/api") ? API_BASE.slice(0, -4) : API_BASE;

let accessToken = "";

export function setAccessToken(token) {
  accessToken = token;
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  health: () => request("/health", { headers: { Authorization: "" } }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  listCourts: () => request("/courts", { headers: { Authorization: "" } }),
  getCourt: (courtId) => request(`/courts/${courtId}`, { headers: { Authorization: "" } }),
  createCourt: (payload) => request("/courts", { method: "POST", body: JSON.stringify(payload) }),
  updateCourt: (courtId, payload) => request(`/courts/${courtId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  uploadCourtImage: (courtId, file) => {
    const body = new FormData();
    body.append("file", file);
    return request(`/courts/${courtId}/image`, { method: "POST", body });
  },
  deleteCourt: (courtId) => request(`/courts/${courtId}`, { method: "DELETE" }),
  getAvailability: (courtId, start) =>
    request(`/courts/${courtId}/availability?start=${encodeURIComponent(start)}`, {
      headers: { Authorization: "" }
    }),
  listCourtBookings: (courtId) => request(`/courts/${courtId}/bookings`, { headers: { Authorization: "" } }),
  holdBooking: (payload) => request("/bookings/hold", { method: "POST", body: JSON.stringify(payload) }),
  confirmBooking: (payload) => request("/bookings/confirm", { method: "POST", body: JSON.stringify(payload) }),
  cancelBooking: (bookingId, payload) =>
    request(`/bookings/${bookingId}/cancel`, { method: "POST", body: JSON.stringify(payload) }),
  listMyBookings: () => request("/me/bookings"),
  getMyBooking: (bookingId) => request(`/me/bookings/${bookingId}`),
  getProfile: () => request("/me/profile"),
  updateProfile: (payload) => request("/me/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  requestDataDeletion: () => request("/me/profile/request-data-deletion", { method: "POST", body: "{}" }),
  listFavorites: () => request("/me/favorites"),
  addFavorite: (payload) => request("/me/favorites", { method: "POST", body: JSON.stringify(payload) }),
  removeFavorite: (courtId) => request(`/me/favorites/${courtId}`, { method: "DELETE" }),
  createReview: (payload) => request("/me/reviews", { method: "POST", body: JSON.stringify(payload) }),
  listMyReviews: () => request("/me/reviews"),
  messageModerator: (payload) => request("/me/moderator-message", { method: "POST", body: JSON.stringify(payload) }),
  listPublicReviews: (courtId) => request(`/me/reviews/public/${courtId}`, { headers: { Authorization: "" } }),
  listAdminUsers: () => request("/admin/users"),
  createAdminUser: (payload) => request("/admin/users", { method: "POST", body: JSON.stringify(payload) }),
  updateAdminUser: (userId, payload) => request(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAdminUser: (userId) => request(`/admin/users/${userId}`, { method: "DELETE" }),
  listRoles: () => request("/admin/roles"),
  createRole: (payload) => request("/admin/roles", { method: "POST", body: JSON.stringify(payload) }),
  deleteRole: (roleId) => request(`/admin/roles/${roleId}`, { method: "DELETE" }),
  listPolicies: () => request("/admin/policies"),
  createPolicy: (payload) => request("/admin/policies", { method: "POST", body: JSON.stringify(payload) }),
  updatePolicy: (policyId, payload) => request(`/admin/policies/${policyId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePolicy: (policyId) => request(`/admin/policies/${policyId}`, { method: "DELETE" }),
  listBookings: () => request("/admin/bookings"),
  sendNotification: (payload) =>
    request("/dashboard/notifications/email", { method: "POST", body: JSON.stringify(payload) }),
  replayEventLog: () => request("/admin/event-log/replay", { method: "POST", body: "{}" })
};
