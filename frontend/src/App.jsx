import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import logoUrl from "../logo.svg";
import { API_ORIGIN, api, setAccessToken } from "./api";

const courtVisuals = [
  "linear-gradient(135deg, rgba(199,226,29,.95), rgba(245,245,243,.7)), radial-gradient(circle at 20% 20%, #111 0 2px, transparent 3px)",
  "linear-gradient(135deg, rgba(17,17,17,.94), rgba(42,42,42,.76)), repeating-linear-gradient(90deg, transparent 0 22px, rgba(199,226,29,.42) 23px 24px)",
  "linear-gradient(135deg, rgba(236,236,232,.98), rgba(199,226,29,.46)), linear-gradient(45deg, transparent 48%, #111 49% 51%, transparent 52%)"
];

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const managerRoles = new Set(["moderator", "admin", "superuser"]);
const defaultRoleNames = ["user", "moderator", "admin", "superuser"];
const permissionEditableRoles = new Set(["user", "moderator", "admin"]);
const ACCESS_TOKEN_STORAGE_KEY = "courtly_access_token";
const defaultMapCenter = [49.8397, 24.0297];
const defaultMarkerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endpointPermissionCatalog = [
  { endpoint: "/auth/login", methods: ["create"] },
  { endpoint: "/auth/register", methods: ["create"] },
  { endpoint: "/courts", methods: ["read", "create"] },
  { endpoint: "/courts/:courtId", methods: ["read", "update", "delete"] },
  { endpoint: "/courts/:courtId/availability", methods: ["read"] },
  { endpoint: "/bookings/hold", methods: ["create"] },
  { endpoint: "/bookings/confirm", methods: ["create"] },
  { endpoint: "/bookings/:bookingId/cancel", methods: ["create"] },
  { endpoint: "/me/bookings", methods: ["read"] },
  { endpoint: "/me/bookings/:bookingId", methods: ["read"] },
  { endpoint: "/me/profile", methods: ["read", "update"] },
  { endpoint: "/me/profile/request-data-deletion", methods: ["create"] },
  { endpoint: "/me/favorites", methods: ["read", "create"] },
  { endpoint: "/me/favorites/:courtId", methods: ["delete"] },
  { endpoint: "/me/reviews", methods: ["create"] },
  { endpoint: "/me/reviews/public/:courtId", methods: ["read"] },
  { endpoint: "/me/moderator-message", methods: ["create"] },
  { endpoint: "/admin/users", methods: ["read", "create"] },
  { endpoint: "/admin/users/:userId", methods: ["update", "delete"] },
  { endpoint: "/admin/roles", methods: ["read", "create"] },
  { endpoint: "/admin/roles/:roleId", methods: ["delete"] },
  { endpoint: "/admin/policies", methods: ["read", "create"] },
  { endpoint: "/admin/policies/:policyId", methods: ["update", "delete"] },
  { endpoint: "/admin/bookings", methods: ["read"] },
  { endpoint: "/admin/event-log/replay", methods: ["create"] },
  { endpoint: "/dashboard/notifications/email", methods: ["create"] }
];

function formatMoney(value) {
  return `${value} UAH`;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMinutes(date, minutes) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() + minutes);
  return copy;
}

function displayTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displayDate(value) {
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function sameSlot(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

function isContiguous(slots) {
  if (slots.length < 2) {
    return false;
  }
  for (let index = 1; index < slots.length; index += 1) {
    const previous = new Date(slots[index - 1].starts_at).getTime();
    const current = new Date(slots[index].starts_at).getTime();
    if (current - previous !== 30 * 60 * 1000) {
      return false;
    }
  }
  return true;
}

function permissionKey(endpoint, method) {
  return `${endpoint}::${method}`;
}

function parseOwnershipCondition(policy) {
  const raw = (policy?.condition || "").toString().trim().toLowerCase();
  if (raw.includes("self")) {
    return "self";
  }
  if (raw.includes("all")) {
    return "all";
  }
  return "all";
}

function normalizePolicyFields(policy) {
  return {
    id: policy.id,
    role: policy.role || policy.role_name || policy.subject || "",
    endpoint: policy.endpoint || policy.resource || "",
    method: (policy.method || policy.action || "").toLowerCase(),
    effect: (policy.effect || "allow").toLowerCase(),
    ownership: parseOwnershipCondition(policy)
  };
}

function buildPermissionDraftMap(roleNames, policyList) {
  const normalized = policyList.map(normalizePolicyFields);
  const byRole = {};

  for (const roleName of roleNames) {
    byRole[roleName] = {};
    for (const entry of endpointPermissionCatalog) {
      for (const method of entry.methods) {
        const key = permissionKey(entry.endpoint, method);
        const existing = normalized.find(
          (policy) => policy.role === roleName && policy.endpoint === entry.endpoint && policy.method === method
        );
        byRole[roleName][key] = {
          endpoint: entry.endpoint,
          method,
          allowed: Boolean(existing && existing.effect === "allow"),
          ownership: existing?.ownership || "all",
          policyId: existing?.id || null
        };
      }
    }
  }

  return byRole;
}

function Logo() {
  return (
    <button className="logo" aria-label="Courtly home" type="button">
      <img src={logoUrl} alt="Courtly" />
    </button>
  );
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makePoint(court, index) {
  const lat = toNumber(court.latitude);
  const lng = toNumber(court.longitude);
  if (lat !== null && lng !== null) {
    return { ...court, mapLat: lat, mapLng: lng };
  }
  const offset = (index % 7) * 0.006;
  return {
    ...court,
    mapLat: defaultMapCenter[0] + offset,
    mapLng: defaultMapCenter[1] + offset / 2
  };
}

function FlyToActiveCourt({ activeCourt }) {
  const map = useMap();
  useEffect(() => {
    if (!activeCourt) {
      return;
    }
    const lat = toNumber(activeCourt.latitude);
    const lng = toNumber(activeCourt.longitude);
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
    }
  }, [activeCourt, map]);
  return null;
}

function CourtsMap({ activeCourt, courts, onSelectCourt }) {
  const points = useMemo(() => courts.map((court, index) => makePoint(court, index)), [courts]);

  return (
    <div className="map-canvas">
      <MapContainer center={defaultMapCenter} zoom={13} scrollWheelZoom className="map-embed">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((court) => (
          <Marker
            key={court.id}
            position={[court.mapLat, court.mapLng]}
            icon={defaultMarkerIcon}
            eventHandlers={{
              click: () => onSelectCourt(court.id)
            }}
          >
            <Popup>
              <strong>{court.name}</strong>
              <br />
              {court.address}
              <br />
              {formatMoney(court.price_per_hour)} / h
            </Popup>
          </Marker>
        ))}
        <FlyToActiveCourt activeCourt={activeCourt} />
      </MapContainer>
      {activeCourt ? (
        <div className="map-card">
          <span>Обраний корт</span>
          <strong>{activeCourt.name}</strong>
          <small>{activeCourt.address}</small>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const filterChipOptions = ["Поруч зі мною", "Indoor", "Open now", "4.5+ rating"];
  const [email, setEmail] = useState("superuser@courtly.example.com");
  const [password, setPassword] = useState("ChangeMeNow123!");
  const [authMode, setAuthMode] = useState("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "");
  const [view, setView] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [city, setCity] = useState("Kyiv");
  const [district, setDistrict] = useState("All districts");
  const [activeCourtFilters, setActiveCourtFilters] = useState(["Поруч зі мною"]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [courts, setCourts] = useState([]);
  const [activeCourtId, setActiveCourtId] = useState("");
  const [availability, setAvailability] = useState([]);
  const [courtBookings, setCourtBookings] = useState([]);
  const [courtReviews, setCourtReviews] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [cabinetTab, setCabinetTab] = useState("bookings");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [moderatorMessage, setModeratorMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [permissionDrafts, setPermissionDrafts] = useState({});
  const [expandedEndpoint, setExpandedEndpoint] = useState(endpointPermissionCatalog[0]?.endpoint || "");
  const [expandedMethodKey, setExpandedMethodKey] = useState("");
  const [adminBookings, setAdminBookings] = useState([]);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState(null);
  const [adminUserForm, setAdminUserForm] = useState(null);
  const [selectedAdminCourtId, setSelectedAdminCourtId] = useState("");
  const [adminCourtForm, setAdminCourtForm] = useState(null);
  const [adminTab, setAdminTab] = useState("users");
  const [dragStartSlot, setDragStartSlot] = useState(null);
  const [isDraggingSlots, setIsDraggingSlots] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    full_name: "",
    password: "ChangeMeNow123!",
    role: "user"
  });
  const [newRole, setNewRole] = useState("");
  const [newCourt, setNewCourt] = useState({
    name: "",
    city: "Kyiv",
    district: "Pechersk",
    address: "",
    surface: "Hard",
    price_per_hour: 700,
    opening_time: "07:00",
    closing_time: "22:00",
    image_url: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [log, setLog] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const profileMenuRef = useRef(null);
  const confirmResolverRef = useRef(null);

  const addLog = (title, payload) => {
    setLog((current) => [{ title, payload }, ...current].slice(0, 10));
  };

  function askForConfirmation(message, options = {}) {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
    }

    setConfirmDialog({
      title: options.title || "Підтвердження",
      message,
      confirmLabel: options.confirmLabel || "Підтвердити",
      cancelLabel: options.cancelLabel || "Скасувати",
      tone: options.tone || "warning"
    });

    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }

  function closeConfirmDialog(confirmed) {
    setConfirmDialog(null);
    if (confirmResolverRef.current) {
      confirmResolverRef.current(confirmed);
      confirmResolverRef.current = null;
    }
  }

  const isAuthed = token.length > 0;
  const isManager = profile ? managerRoles.has(profile.role) : false;
  const allRoleNames = useMemo(() => {
    const loaded = roles.map((role) => role.name).filter(Boolean);
    return [...new Set([...defaultRoleNames, ...loaded])].filter((roleName) => permissionEditableRoles.has(roleName));
  }, [roles]);
  const activeCourt = useMemo(() => courts.find((court) => court.id === activeCourtId) || courts[0] || null, [activeCourtId, courts]);
  const filteredCourts = useMemo(() => {
    return courts.filter((court) => {
      const cityMatch = city === "All cities" || court.city === city;
      const districtMatch = district === "All districts" || court.district === district;
      if (!cityMatch || !districtMatch) {
        return false;
      }

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const openingMinutes = court.opening_time
        ? Number(court.opening_time.split(":")[0]) * 60 + Number(court.opening_time.split(":")[1])
        : 0;
      const closingMinutes = court.closing_time
        ? Number(court.closing_time.split(":")[0]) * 60 + Number(court.closing_time.split(":")[1])
        : 24 * 60;
      const distanceKm = Number.parseFloat((court.distance || "").toString().replace(" km", ""));
      const rating = Number(court.rating || 0);

      if (activeCourtFilters.includes("Поруч зі мною") && Number.isFinite(distanceKm) && distanceKm > 2.5) {
        return false;
      }
      if (activeCourtFilters.includes("Indoor") && court.surface?.toLowerCase() === "grass") {
        return false;
      }
      if (activeCourtFilters.includes("Open now") && !(nowMinutes >= openingMinutes && nowMinutes < closingMinutes)) {
        return false;
      }
      if (activeCourtFilters.includes("4.5+ rating") && rating < 4.5) {
        return false;
      }

      return true;
    });
  }, [activeCourtFilters, city, courts, district]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekSlots = useMemo(() => {
    const grouped = new Map();
    for (const slot of availability) {
      const key = dateKey(new Date(slot.starts_at));
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(slot);
    }
    return grouped;
  }, [availability]);
  const selectedDuration = selectedSlots.length * 30;
  const selectedTotal = Math.round((activeCourt?.price_per_hour || 0) * (selectedDuration / 60));
  const canConfirmSelection = isContiguous(selectedSlots);
  const slotHint = canConfirmSelection ? "Можна підтверджувати." : "Обери два або більше суміжні слоти.";

  useEffect(() => {
    loadCourts();
  }, []);

  useEffect(() => {
    if (!token) {
      setAccessToken("");
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      return;
    }

    setAccessToken(token);
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    loadCabinet(true);
  }, [token]);

  useEffect(() => {
    if (activeCourtId) {
      loadAvailability(activeCourtId, weekStart);
    }
  }, [activeCourtId, weekStart]);

  useEffect(() => {
    if (view === "admin" && isAuthed && isManager) {
      loadAdmin();
    }
  }, [view, isAuthed, isManager]);

  useEffect(() => {
    if (view === "detail" && activeCourtId) {
      loadCourtInsights(activeCourtId);
    }
  }, [view, activeCourtId]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    function handleProfileMenuOutsideClick(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleProfileMenuOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleProfileMenuOutsideClick);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (!confirmDialog) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeConfirmDialog(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [confirmDialog]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const data = await api.login({ email, password });
      setToken(data.access_token);
      addLog("Login", data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Паролі не співпадають.");
      return;
    }
    if (!acceptedTerms) {
      setError("Потрібно погодитись з Privacy Policy та Terms of Service.");
      return;
    }
    try {
      const data = await api.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email,
        password
      });
      setToken(data.access_token);
      setSuccess("Акаунт створено.");
      setView("home");
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    const confirmed = await askForConfirmation("Ви дійсно хочете вийти з акаунту?", {
      title: "Вийти з акаунту",
      confirmLabel: "Вийти",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }
    setToken("");
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    setProfile(null);
      setBookings([]);
      setMyReviews([]);
      setFavorites([]);
    setAdminUsers([]);
    setRoles([]);
    setPolicies([]);
    setAdminBookings([]);
    setView("home");
  }

  async function loadCourts() {
    setError("");
    try {
      const data = await api.listCourts();
      const normalized = data.map((court, index) => ({
        ...court,
        rating: Number(court.rating_avg || 0),
        distance: `${(1.1 + index * 0.7).toFixed(1)} km`,
        nextSlot: index % 2 === 0 ? "18:00" : "19:30",
        image: courtVisuals[index % courtVisuals.length],
        tags: [court.surface, "Verified", "Fast booking"]
      }));
      setCourts(normalized);
      if (normalized.length > 0) {
        setActiveCourtId(normalized[0].id);
        if (!selectedAdminCourtId) {
          setSelectedAdminCourtId(normalized[0].id);
          setAdminCourtForm(normalized[0]);
        }
      }
      addLog("Loaded courts", data);
    } catch (err) {
      setError(`Courts API unavailable: ${err.message}`);
    }
  }

  async function loadAvailability(courtId, start) {
    try {
      const data = await api.getAvailability(courtId, start.toISOString());
      const scoped = data.filter((slot) => {
        const hour = new Date(slot.starts_at).getHours();
        return hour >= 5 && hour <= 23;
      });
      setAvailability(scoped);
      setSelectedSlots([]);
    } catch (err) {
      setAvailability([]);
      setError(`Availability API unavailable: ${err.message}`);
    }
  }

  async function loadCabinet(force = false) {
    if (!force && !isAuthed && !token) {
      return;
    }
    setError("");
    try {
      const [b, p, f, r] = await Promise.all([
        api.listMyBookings(),
        api.getProfile(),
        api.listFavorites(),
        api.listMyReviews()
      ]);
      setBookings(b);
      setProfile(p);
      setFavorites((current) => [...new Set([...current, ...f.map((item) => item.court_id)])]);
      setMyReviews(r);
      addLog("Loaded cabinet", { bookings: b, profile: p, favorites: f, reviews: r });
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadBookingDetail(bookingId) {
    try {
      const detail = await api.getMyBooking(bookingId);
      setSelectedBooking(detail);
      setReviewComment("");
      setModeratorMessage("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitCourtReview(event) {
    event.preventDefault();
    if (!selectedBooking) {
      setError("Спочатку відкрий конкретне бронювання в кабінеті.");
      return;
    }
    try {
      await api.createReview({
        booking_id: selectedBooking.id,
        court_id: selectedBooking.court_id,
        rating: Number(reviewRating),
        comment: reviewComment
      });
      setReviewComment("");
      setSuccess("Відгук додано.");
      await loadBookingDetail(selectedBooking.id);
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadCourtInsights(courtId) {
    try {
      const [bookingsData, reviewsData] = await Promise.all([api.listCourtBookings(courtId), api.listPublicReviews(courtId)]);
      setCourtBookings(bookingsData);
      setCourtReviews(reviewsData);
    } catch (err) {
      setCourtBookings([]);
      setCourtReviews([]);
      setError(err.message);
    }
  }

  async function sendModeratorMessage(event) {
    event.preventDefault();
    try {
      await api.messageModerator({
        booking_id: selectedBooking?.id || null,
        court_id: selectedBooking?.court_id || activeCourt?.id || null,
        subject: selectedBooking ? `Booking ${selectedBooking.id}` : "Court question",
        message: moderatorMessage
      });
      setModeratorMessage("");
      setSuccess("Повідомлення модератору відправлено.");
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSlot(slot) {
    if (slot.state !== "free") {
      return;
    }
    setSelectedSlots((current) => {
      const exists = current.some((item) => sameSlot(item.starts_at, slot.starts_at));
      if (exists) {
        return current.filter((item) => !sameSlot(item.starts_at, slot.starts_at));
      }
      const next = [...current, slot].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      if (next.length > 4) {
        return [slot];
      }
      return next;
    });
  }

  function selectSlotRange(startSlot, endSlot) {
    if (!startSlot || !endSlot || startSlot.state !== "free" || endSlot.state !== "free") {
      return;
    }
    const startMs = new Date(startSlot.starts_at).getTime();
    const endMs = new Date(endSlot.starts_at).getTime();
    const min = Math.min(startMs, endMs);
    const max = Math.max(startMs, endMs);
    const range = availability
      .filter((slot) => {
        const time = new Date(slot.starts_at).getTime();
        return slot.state === "free" && time >= min && time <= max;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    setSelectedSlots(range);
  }

  function startSlotDrag(slot) {
    if (slot.state !== "free") {
      return;
    }
    setDragStartSlot(slot);
    setIsDraggingSlots(true);
    setSelectedSlots([slot]);
  }

  function moveSlotDrag(slot) {
    if (!isDraggingSlots || !dragStartSlot) {
      return;
    }
    selectSlotRange(dragStartSlot, slot);
  }

  function endSlotDrag(slot) {
    if (isDraggingSlots && dragStartSlot) {
      selectSlotRange(dragStartSlot, slot);
    }
    setIsDraggingSlots(false);
    setDragStartSlot(null);
  }

  function selectCourt(courtId) {
    setActiveCourtId(courtId);
    setView("detail");
  }

  async function holdAndConfirm() {
    setError("");
    setSuccess("");
    if (!isAuthed) {
      setError("Увійди в акаунт, щоб забронювати корт.");
      setView("cabinet");
      return;
    }
    if (!activeCourt) {
      setError("Обери корт.");
      return;
    }
    if (!canConfirmSelection) {
      setError("Обери мінімум два суміжні 30-хвилинні слоти.");
      return;
    }
    try {
      const slotStarts = selectedSlots.map((slot) => slot.starts_at);
      const hold = await api.holdBooking({ court_id: activeCourt.id, slot_starts: slotStarts });
      const confirmed = await api.confirmBooking({ hold_token: hold.hold_token });
      addLog("Hold+Confirm", { hold, confirmed });
      setSuccess("Корт заброньовано. Деталі вже у твоєму кабінеті.");
      setView("success");
      await loadCabinet();
      await loadAvailability(activeCourt.id, weekStart);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadAdmin() {
    setError("");
    try {
      const [users, loadedRoles, loadedPolicies, allBookings] = await Promise.all([
        api.listAdminUsers(),
        api.listRoles(),
        api.listPolicies(),
        api.listBookings()
      ]);
      setAdminUsers(users);
      if (users.length > 0) {
        const selected = users.find((item) => item.id === selectedAdminUserId) || users[0];
        setSelectedAdminUserId(selected.id);
        setAdminUserForm({
          id: selected.id,
          full_name: selected.full_name,
          role: selected.role,
          is_active: selected.is_active
        });
      } else {
        setSelectedAdminUserId(null);
        setAdminUserForm(null);
      }
      setRoles(loadedRoles);
      setPolicies(loadedPolicies);
      setPermissionDrafts(buildPermissionDraftMap([...new Set([...defaultRoleNames, ...loadedRoles.map((role) => role.name)])], loadedPolicies));
      setAdminBookings(allBookings);
      addLog("Loaded admin data", { users, loadedRoles, loadedPolicies });
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshAdminAndCourts() {
    await Promise.all([loadAdmin(), loadCourts()]);
  }

  async function createAdminUser(event) {
    event.preventDefault();
    try {
      await api.createAdminUser(newUser);
      setNewUser({ email: "", full_name: "", password: "ChangeMeNow123!", role: "user" });
      setSuccess("User created.");
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  function openUserEditor(user) {
    setSelectedAdminUserId(user.id);
    setAdminUserForm({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active
    });
  }

  async function saveUserEditor(event) {
    event.preventDefault();
    if (!adminUserForm?.id) {
      return;
    }
    try {
      await api.updateAdminUser(adminUserForm.id, {
        full_name: adminUserForm.full_name,
        role: adminUserForm.role,
        is_active: Boolean(adminUserForm.is_active)
      });
      setSuccess("User updated.");
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRole(event) {
    event.preventDefault();
    if (!newRole.trim()) {
      return;
    }
    try {
      await api.createRole({ name: newRole.trim() });
      setNewRole("");
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  function updatePermissionDraft(roleName, endpoint, method, patch) {
    const key = permissionKey(endpoint, method);
    setPermissionDrafts((current) => ({
      ...current,
      [roleName]: {
        ...(current[roleName] || {}),
        [key]: {
          ...(current[roleName]?.[key] || {
            endpoint,
            method,
            allowed: false,
            ownership: "all",
            policyId: null
          }),
          ...patch
        }
      }
    }));
  }

  async function saveMethodPermissions(endpoint, method) {
    setError("");
    setSuccess("");

    try {
      for (const roleName of allRoleNames) {
        const key = permissionKey(endpoint, method);
        const draft = permissionDrafts[roleName]?.[key] || { allowed: false, ownership: "all" };
        const existing = policies
          .map(normalizePolicyFields)
          .find((policy) => policy.role === roleName && policy.endpoint === endpoint && policy.method === method);
          if (draft.allowed) {
            const payload = {
              role: roleName,
              resource: endpoint,
              action: method,
              effect: "allow",
              condition: `ownership:${draft.ownership || "all"}`
            };
            if (existing?.id) {
              await api.updatePolicy(existing.id, payload);
            } else {
              await api.createPolicy(payload);
            }
          } else if (existing?.id) {
            await api.deletePolicy(existing.id);
          }
      }

      setSuccess(`Permissions updated for ${endpoint} ${method.toUpperCase()}.`);
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createCourt(event) {
    event.preventDefault();
    try {
      await api.createCourt({ ...newCourt, price_per_hour: Number(newCourt.price_per_hour) });
      setNewCourt({
        name: "",
        city: "Kyiv",
        district: "Pechersk",
        address: "",
        surface: "Hard",
        price_per_hour: 700,
        opening_time: "07:00",
        closing_time: "22:00",
        image_url: ""
      });
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateCourtPrice(courtId, price) {
    try {
      await api.updateCourt(courtId, { price_per_hour: Number(price) });
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateCourtHours(courtId, openingTime, closingTime) {
    try {
      await api.updateCourt(courtId, { opening_time: openingTime, closing_time: closingTime });
      await loadCourts();
      if (courtId === activeCourtId) {
        await loadAvailability(courtId, weekStart);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateCourtImage(courtId, imageUrl) {
    try {
      await api.updateCourt(courtId, { image_url: imageUrl || null });
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadCourtImageFile(courtId, file) {
    if (!file) {
      return;
    }
    try {
      const uploaded = await api.uploadCourtImage(courtId, file);
      setAdminCourtForm((current) =>
        current && current.id === courtId ? { ...current, image_url: uploaded.image_url || current.image_url } : current
      );
      await loadCourts();
      setSuccess("Court image uploaded.");
    } catch (err) {
      setError(err.message);
    }
  }

  function openCourtEditor(court) {
    setSelectedAdminCourtId(court.id);
    setAdminCourtForm({ ...court });
  }

  function resolveCourtImageUrl(court) {
    if (!court?.image_url) {
      return "";
    }
    if (court.image_url.startsWith("http")) {
      return court.image_url;
    }
    return `${API_ORIGIN}${court.image_url}`;
  }

  async function saveCourtEditor(event) {
    event.preventDefault();
    if (!adminCourtForm?.id) {
      return;
    }
    try {
      await api.updateCourt(adminCourtForm.id, {
        name: adminCourtForm.name,
        city: adminCourtForm.city,
        district: adminCourtForm.district,
        address: adminCourtForm.address,
        surface: adminCourtForm.surface,
        price_per_hour: Number(adminCourtForm.price_per_hour),
        opening_time: adminCourtForm.opening_time,
        closing_time: adminCourtForm.closing_time,
        image_url: adminCourtForm.image_url || null
      });
      setSuccess("Court updated.");
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function triggerNotification() {
    setError("");
    try {
      const result = await api.sendNotification({
        subject: "Courtly Campaign",
        body: "System message from dashboard.",
        recipient_scope: "active_users"
      });
      addLog("Notification queued", result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function triggerReplay() {
    setError("");
    try {
      const result = await api.replayEventLog();
      addLog("Replay finished", result);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleFavorite(courtId) {
    if (!isAuthed) {
      setView("cabinet");
      setError("Увійди, щоб зберігати обране.");
      return;
    }
    const wasFavorite = favorites.includes(courtId);
    if (wasFavorite) {
      const confirmed = await askForConfirmation("Прибрати цей корт з обраного?", {
        title: "Прибрати з обраного",
        confirmLabel: "Прибрати"
      });
      if (!confirmed) {
        return;
      }
    }
    setFavorites((current) =>
      current.includes(courtId) ? current.filter((item) => item !== courtId) : [...current, courtId]
    );
    try {
      if (wasFavorite) {
        await api.removeFavorite(courtId);
      } else {
        await api.addFavorite({ court_id: courtId });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteAdminUser(userId) {
    const confirmed = await askForConfirmation("Цю дію не можна скасувати.", {
      title: "Видалити користувача?",
      confirmLabel: "Видалити",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.deleteAdminUser(userId);
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteRole(roleId) {
    const confirmed = await askForConfirmation("Роль буде остаточно видалено.", {
      title: "Видалити роль?",
      confirmLabel: "Видалити",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.deleteRole(roleId);
      await loadAdmin();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteCourt(courtId) {
    const confirmed = await askForConfirmation("Корт зникне з каталогу для всіх користувачів.", {
      title: "Видалити корт?",
      confirmLabel: "Видалити",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }
    try {
      await api.deleteCourt(courtId);
      await loadCourts();
    } catch (err) {
      setError(err.message);
    }
  }

  const nav = [
    ["home", "Головна"],
    ["search", "Корти"]
  ];
  if (isAuthed && isManager) {
    nav.push(["admin", "Дашборд"]);
  }

  function navigateTo(nextView) {
    setView(nextView);
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }

  function toggleCourtFilter(filterName) {
    setActiveCourtFilters((current) =>
      current.includes(filterName) ? current.filter((item) => item !== filterName) : [...current, filterName]
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div onClick={() => navigateTo("home")}>
          <Logo />
        </div>
        <button
          className={isMobileMenuOpen ? "burger-button active" : "burger-button"}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="nav-tabs" aria-label="Primary navigation">
          {nav.map(([id, label]) => (
            <button key={id} className={view === id ? "nav-tab active" : "nav-tab"} onClick={() => navigateTo(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          {isAuthed ? (
            <div className="profile-menu" ref={profileMenuRef}>
              <button
                className={isProfileMenuOpen ? "profile-trigger open" : "profile-trigger"}
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                type="button"
              >
                <span className="profile-avatar" aria-hidden="true">
                  {profile?.full_name?.slice(0, 1) || "U"}
                </span>
              </button>
              {isProfileMenuOpen ? (
                <div className="profile-dropdown" role="menu">
                  <button className="profile-dropdown-item" role="menuitem" onClick={() => navigateTo("cabinet")}>
                    Переглянути профіль
                  </button>
                  <button
                    className="profile-dropdown-item danger"
                    role="menuitem"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    Вийти
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button className="primary-button compact user-button" onClick={() => navigateTo("cabinet")}>
              Увійти
            </button>
          )}
        </div>
      </header>
      <div className={isMobileMenuOpen ? "mobile-menu-backdrop open" : "mobile-menu-backdrop"} onClick={() => setIsMobileMenuOpen(false)} />
      <aside className={isMobileMenuOpen ? "mobile-menu open" : "mobile-menu"} aria-label="Mobile navigation">
        <nav className="mobile-menu-nav">
          {nav.map(([id, label]) => (
            <button key={id} className={view === id ? "mobile-menu-link active" : "mobile-menu-link"} onClick={() => navigateTo(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="mobile-menu-footer">
          <button className="primary-button full" onClick={() => navigateTo("cabinet")}>
            {isAuthed ? profile?.full_name || "Account" : "Увійти"}
          </button>
          {isAuthed ? (
            <button
              className="secondary-button full"
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
            >
              Вийти
            </button>
          ) : null}
        </div>
      </aside>

      <main>
        {view === "home" ? (
          <section className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title" style={{ fontSize: "10vw", minWidth: "100%", position: "relative", top: "0", left: "0" }}>FIND YOUR COURT</h1>

              <div className="search-panel">
                <label>
                  <span>Місто</span>
                  <select value={city} onChange={(event) => setCity(event.target.value)}>
                    <option>Kyiv</option>
                    <option>All cities</option>
                  </select>
                </label>
                <label>
                  <span>Район</span>
                  <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                    <option>All districts</option>
                    <option>Pechersk</option>
                    <option>Podil</option>
                    <option>Obolon</option>
                  </select>
                </label>
                <label>
                  <span>Тиждень</span>
                  <input
                    type="date"
                    value={dateKey(weekStart)}
                    onChange={(event) => setWeekStart(startOfWeek(new Date(event.target.value)))}
                  />
                </label>
                <button className="primary-button" onClick={() => setView("search")}>
                  Знайти корт
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {view === "home" ? (
          <section className="content-section">
            <div className="section-heading compact-heading">
              <h2>Як це працює?</h2>
            </div>
            <div className="steps-grid premium-steps">
              {[
                ["01", "Обери корт", "Знайди корт поруч."],
                ["02", "Обери час", "Відміть вільний слот."],
                ["03", "Підтвердь", "Готово, бронь активна."]
              ].map(([num, title, text]) => (
                <article className="step-card" key={num}>
                  <span>{num}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "search" ? (
          <section className="product-layout">
            <div className="results-column">
              <div className="section-heading inline">
                <div>
                  <span className="eyebrow dark">Courts</span>
                  <h2>Обери корт</h2>
                </div>
              </div>

              <div className="filter-row">
                {filterChipOptions.map((chip) => (
                  <button
                    key={chip}
                    className={activeCourtFilters.includes(chip) ? "chip active" : "chip"}
                    onClick={() => toggleCourtFilter(chip)}
                    type="button"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="court-list">
                {filteredCourts.map((court) => (
                  <article
                    className={court.id === activeCourt?.id ? "court-card active" : "court-card"}
                    key={court.id}
                    onMouseEnter={() => setActiveCourtId(court.id)}
                    onClick={() => selectCourt(court.id)}
                  >
                    <button
                      className={favorites.includes(court.id) ? "favorite active" : "favorite"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(court.id);
                      }}
                      aria-label="Toggle favorite"
                    >
                      {favorites.includes(court.id) ? "В обраному" : "Зберегти"}
                    </button>
                    <div
                      className="court-image"
                      style={
                        court.image_url
                          ? {
                              backgroundImage: `url(${resolveCourtImageUrl(court)})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center"
                            }
                          : { background: court.image }
                      }
                    />
                    <div className="court-card-body">
                      <div>
                        <h3>{court.name}</h3>
                        <p>{court.address} - {court.district}</p>
                      </div>
                      <div className="meta-grid">
                        <span>{court.surface}</span>
                        <span>{court.rating} ★</span>
                        <span>{court.distance}</span>
                      </div>
                      <div className="court-card-footer">
                        <div>
                          <span className="caption">ціна</span>
                          <strong>{formatMoney(court.price_per_hour)} / h</strong>
                        </div>
                        <div>
                          <span className="caption">слот</span>
                          <strong>{court.nextSlot}</strong>
                        </div>
                        <button
                          className="primary-button small"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectCourt(court.id);
                          }}
                        >
                          Обрати
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="map-panel">
              <div className="map-top">
                <div>
                  <span className="eyebrow dark">Мапа</span>
                  <h3>Карта кортів</h3>
                </div>
              </div>
              <CourtsMap activeCourt={activeCourt} courts={filteredCourts} onSelectCourt={setActiveCourtId} />
            </aside>
          </section>
        ) : null}

        {view === "detail" && activeCourt ? (
          <section className="detail-layout calendar-wide-layout">
            <div className="detail-main">
              <div
                className="detail-hero compact-court-hero"
                style={
                  activeCourt.image_url
                    ? {
                        backgroundImage: `url(${resolveCourtImageUrl(activeCourt)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center"
                      }
                    : { background: activeCourt.image }
                }
              >
                <div className="detail-title-card">
                  <span className="eyebrow dark">Корт</span>
                  <h1>{activeCourt.name}</h1>
                  <p>{activeCourt.address} - {activeCourt.city}, {activeCourt.district}</p>
                  <div className="meta-grid compact-meta">
                    <span>{activeCourt.rating} ★</span>
                    <span>{activeCourt.surface}</span>
                    <span>{formatMoney(activeCourt.price_per_hour)} / h</span>
                    <span>{activeCourt.opening_time} - {activeCourt.closing_time}</span>
                  </div>
                </div>
              </div>

              <section className="slot-section calendar-fullbleed">
                <div className="section-heading inline">
                  <div>
                    <span className="eyebrow dark">Календар</span>
                    <h2>Тижневий календар</h2>
                  </div>
                  <div className="calendar-controls">
                    <button className="secondary-button compact" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                      Назад
                    </button>
                    <strong>
                      {displayDate(weekDays[0])} - {displayDate(weekDays[6])}
                    </strong>
                    <button className="secondary-button compact" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                      Далі
                    </button>
                  </div>
                </div>
                <div
                  className="week-calendar"
                  role="grid"
                  aria-label="Weekly availability calendar"
                  onMouseLeave={() => {
                    setIsDraggingSlots(false);
                    setDragStartSlot(null);
                  }}
                >
                  {weekDays.map((day, index) => {
                    const slots = weekSlots.get(dateKey(day)) || [];
                    return (
                      <div className="calendar-day" key={dateKey(day)}>
                        <div className="calendar-day-head">
                          <span>{dayLabels[index]}</span>
                          <strong>{displayDate(day)}</strong>
                        </div>
                        <div className="calendar-slots">
                          {slots.length === 0 ? <span className="empty-day">Немає слотів</span> : null}
                          {slots.slice(0, 24).map((slot) => {
                            const selected = selectedSlots.some((item) => sameSlot(item.starts_at, slot.starts_at));
                            return (
                              <button
                                key={slot.starts_at}
                                className={`calendar-slot ${slot.state} ${selected ? "selected" : ""}`}
                                disabled={slot.state !== "free"}
                                onClick={() => toggleSlot(slot)}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  startSlotDrag(slot);
                                }}
                                onMouseEnter={() => moveSlotDrag(slot)}
                                onMouseUp={() => endSlotDrag(slot)}
                                onTouchStart={() => startSlotDrag(slot)}
                                onTouchMove={() => moveSlotDrag(slot)}
                                onTouchEnd={() => endSlotDrag(slot)}
                              >
                                <span>{displayTime(slot.starts_at)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="reviews-section">
                <div className="section-heading inline">
                  <div>
                    <span className="eyebrow dark">Відгуки</span>
                    <h2>Що кажуть гравці</h2>
                  </div>
                </div>
                <div className="reviews-grid">
                  {courtReviews.length === 0 ? <div className="empty-state">Поки немає відгуків.</div> : null}
                  {courtReviews.map((review) => (
                    <article className="review-card" key={review.id}>
                      <strong>{review.rating} ★</strong>
                      <p>{review.comment}</p>
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="booking-summary">
              <span className="eyebrow dark">Бронювання</span>
              <h2>{activeCourt.name}</h2>
              <div className="summary-list">
                <div>
                  <span>Дата</span>
                  <strong>{selectedSlots[0] ? displayDate(selectedSlots[0].starts_at) : "Обери слот"}</strong>
                </div>
                <div>
                  <span>Час</span>
                  <strong>
                    {selectedSlots.length > 0
                      ? `${displayTime(selectedSlots[0].starts_at)} - ${displayTime(addMinutes(new Date(selectedSlots[selectedSlots.length - 1].starts_at), 30))}`
                      : "Обери слоти"}
                  </strong>
                </div>
                <div>
                  <span>Тривалість</span>
                  <strong>{selectedDuration} min</strong>
                </div>
                <div>
                  <span>Разом</span>
                  <strong>{formatMoney(selectedTotal)}</strong>
                </div>
              </div>
              <p className={canConfirmSelection ? "hint success" : "hint warning"}>{slotHint}</p>
              <button className="primary-button full" onClick={holdAndConfirm} disabled={selectedSlots.length > 0 && !canConfirmSelection}>
                {isAuthed ? "Підтвердити бронювання" : "Увійти і забронювати"}
              </button>
              <button className="secondary-button full" onClick={() => toggleFavorite(activeCourt.id)}>
                {favorites.includes(activeCourt.id) ? "Прибрати з обраного" : "Додати в обране"}
              </button>
              <div className="summary-list">
                <h3>Останні бронювання</h3>
                {courtBookings.length === 0 ? <span>Немає бронювань.</span> : null}
                {courtBookings.slice(0, 5).map((booking) => (
                  <div key={booking.id}>
                    <span>{new Date(booking.starts_at).toLocaleDateString()}</span>
                    <strong>{displayTime(booking.starts_at)} - {displayTime(booking.ends_at)}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        ) : null}

        {view === "success" ? (
          <section className="success-state">
            <div className="success-illustration">Booked</div>
            <h1>Корт заброньовано</h1>
            <p>
              {activeCourt?.name}, {selectedSlots[0] ? displayDate(selectedSlots[0].starts_at) : ""},{" "}
              {selectedSlots[0] ? displayTime(selectedSlots[0].starts_at) : ""} -{" "}
              {selectedSlots.length > 0 ? displayTime(addMinutes(new Date(selectedSlots[selectedSlots.length - 1].starts_at), 30)) : ""}
            </p>
            <div className="row-actions centered">
              <button className="primary-button" onClick={() => setView("cabinet")}>
                Переглянути мої бронювання
              </button>
              <button className="secondary-button" onClick={() => setView("search")}>
                Повернутись до пошуку
              </button>
            </div>
          </section>
        ) : null}

        {view === "cabinet" ? (
          <section className="content-section">
            {!isAuthed ? (
              <section className="auth-screen">
                <div className="auth-card">
                  <img src={logoUrl} alt="Courtly" className="auth-logo" />
                  <h2>{authMode === "signup" ? "Create an account" : "Sign in"}</h2>
                  <form className="auth-form" onSubmit={authMode === "signup" ? handleRegister : handleLogin}>
                    {authMode === "signup" ? (
                      <div className="auth-two-columns">
                        <label>
                          <span>First name</span>
                          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Vasya" required />
                        </label>
                        <label>
                          <span>Last name</span>
                          <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Pupkin" required />
                        </label>
                      </div>
                    ) : null}
                    <label>
                      <span>Email</span>
                      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" type="email" required />
                    </label>
                    <label>
                      <span>Password</span>
                      <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
                    </label>
                    {authMode === "signup" ? (
                      <>
                        <label>
                          <span>Confirm password</span>
                          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required />
                        </label>
                        <label className="terms-row">
                          <input
                            checked={acceptedTerms}
                            onChange={(event) => setAcceptedTerms(event.target.checked)}
                            type="checkbox"
                          />
                          <span>I agree to the Privacy Policy and Terms of Service</span>
                        </label>
                      </>
                    ) : null}
                    <button className="primary-button full auth-submit" type="submit">
                      {authMode === "signup" ? "Sign up" : "Sign in"}
                    </button>
                  </form>
                  <button
                    className="auth-switch"
                    onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
                    type="button"
                  >
                    {authMode === "signup" ? "Have an account? Sign in" : "No account? Sign up"}
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="section-heading inline">
                  <div>
                    <h2>Профіль</h2>
                  </div>
                  <div className="row-actions">
                    <button className="secondary-button" onClick={logout}>
                      Вийти
                    </button>
                  </div>
                </div>

                <div className="cabinet-grid">
                  <article className="profile-card">
                    <div className="avatar">{profile?.full_name?.slice(0, 1) || "C"}</div>
                    <h3>{profile?.full_name}</h3>
                    <p>{profile?.email}</p>
                    <div className="profile-meta">
                      <span>{profile?.role}</span>
                      <span>{favorites.length} favorites</span>
                    </div>
                  </article>

                  <article className="bookings-card">
                    <div className="segmented-tabs">
                      <button className={cabinetTab === "bookings" ? "active" : ""} onClick={() => setCabinetTab("bookings")}>
                        My bookings
                      </button>
                      <button className={cabinetTab === "favorites" ? "active" : ""} onClick={() => setCabinetTab("favorites")}>
                        Favorites
                      </button>
                      <button className={cabinetTab === "reviews" ? "active" : ""} onClick={() => setCabinetTab("reviews")}>
                        Reviews
                      </button>
                    </div>
                    <div className="booking-list">
                      {cabinetTab === "bookings" ? (
                        <>
                          {bookings.length === 0 ? <div className="empty-state">Поки немає бронювань.</div> : null}
                          {bookings.map((booking) => (
                            <div className="booking-row" key={booking.id}>
                              <div>
                                <strong>{booking.court_name || activeCourt?.name || booking.court_id}</strong>
                                <span>{new Date(booking.starts_at).toLocaleString()} - {booking.status}</span>
                              </div>
                              <strong>{formatMoney(booking.total_price || selectedTotal)}</strong>
                              <button className="secondary-button compact" onClick={() => loadBookingDetail(booking.id)}>
                                Деталі
                              </button>
                            </div>
                          ))}
                        </>
                      ) : null}

                      {cabinetTab === "favorites" ? (
                        <>
                          {favorites.length === 0 ? <div className="empty-state">Поки немає обраних кортів.</div> : null}
                          {favorites.map((courtId) => {
                            const court = courts.find((item) => item.id === courtId);
                            return (
                              <div className="booking-row" key={courtId}>
                                <div>
                                  <strong>{court?.name || courtId}</strong>
                                  <span>{court ? `${court.address} - ${court.district}` : "Корт"}</span>
                                </div>
                                <strong>{court ? formatMoney(court.price_per_hour) : "-"}</strong>
                                <button className="secondary-button compact" onClick={() => selectCourt(courtId)}>
                                  Відкрити
                                </button>
                              </div>
                            );
                          })}
                        </>
                      ) : null}

                      {cabinetTab === "reviews" ? (
                        <>
                          {myReviews.length === 0 ? <div className="empty-state">Поки немає відгуків.</div> : null}
                          {myReviews.map((review) => (
                            <div className="booking-row" key={review.id}>
                              <div>
                                <strong>{review.rating} ★</strong>
                                <span>{review.comment}</span>
                              </div>
                              <strong>{new Date(review.created_at).toLocaleDateString()}</strong>
                              <button className="secondary-button compact" onClick={() => selectCourt(review.court_id)}>
                                Корт
                              </button>
                            </div>
                          ))}
                        </>
                      ) : null}
                    </div>
                  </article>
                </div>

                {selectedBooking ? (
                  <section className="booking-detail-panel">
                    <div>
                      <h3>{selectedBooking.court_name}</h3>
                      <p>{selectedBooking.court_address}</p>
                    </div>
                    <div className="detail-facts">
                      <span>{displayDate(selectedBooking.starts_at)}</span>
                      <span>{displayTime(selectedBooking.starts_at)} - {displayTime(selectedBooking.ends_at)}</span>
                      <span>{selectedBooking.status}</span>
                      <span>{formatMoney(selectedBooking.total_price)}</span>
                    </div>
                    <div className="booking-actions-grid">
                      <form className="inline-form-card" onSubmit={submitCourtReview}>
                        <h4>Коментар про корт</h4>
                        <select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>{rating} ★</option>
                          ))}
                        </select>
                        <textarea
                          value={reviewComment}
                          onChange={(event) => setReviewComment(event.target.value)}
                          placeholder="Що сподобалось або що треба покращити?"
                          required
                        />
                        <button className="primary-button" type="submit">Опублікувати</button>
                      </form>
                      <form className="inline-form-card" onSubmit={sendModeratorMessage}>
                        <h4>Написати модератору</h4>
                        <textarea
                          value={moderatorMessage}
                          onChange={(event) => setModeratorMessage(event.target.value)}
                          placeholder="Питання щодо бронювання, корту або доступу..."
                          required
                        />
                        <button className="secondary-button" type="submit">Відправити</button>
                      </form>
                    </div>
                    <div className="review-list-mini">
                      {(selectedBooking.reviews || []).map((review) => (
                        <div key={review.id}>
                          <strong>{review.rating} ★</strong>
                          <span>{review.comment}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {view === "admin" && isManager ? (
          <section className="content-section admin-section">
            <div className="section-heading inline">
              <div>
                <span className="eyebrow dark">Дашборд</span>
                <h2>Admin control center</h2>
              </div>
              <button className="primary-button" onClick={refreshAdminAndCourts} disabled={!isAuthed}>
                Оновити
              </button>
            </div>

            <div className="admin-grid">
              <article className="metric-card">
                <span>Users</span>
                <strong>{adminUsers.length}</strong>
                <p>Без PII.</p>
              </article>
              <article className="metric-card">
                <span>Roles</span>
                <strong>{roles.length}</strong>
                <p>Ролі.</p>
              </article>
              <article className="metric-card">
                <span>Permissions</span>
                <strong>{policies.length}</strong>
                <p>Endpoint rules.</p>
              </article>
              <article className="metric-card">
                <span>Bookings</span>
                <strong>{adminBookings.length}</strong>
                <p>Список броней.</p>
              </article>
              <article className="metric-card">
                <span>Courts</span>
                <strong>{courts.length}</strong>
                <p>Каталог.</p>
              </article>
            </div>

            <div className="admin-tabs">
              {[
                ["users", "Users"],
                ["roles", "Roles"],
                ["permissions", "Permissions"],
                ["courts", "Courts"],
                ["bookings", "Bookings"]
              ].map(([id, label]) => (
                <button key={id} className={adminTab === id ? "active" : ""} onClick={() => setAdminTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {adminTab === "users" ? (
              <div className="admin-panel-grid courts-admin-layout">
                <form className="admin-form-card" onSubmit={createAdminUser}>
                  <h3>Create user</h3>
                  <input
                    value={newUser.email}
                    onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                    placeholder="email@example.com"
                    type="email"
                  />
                  <input
                    value={newUser.full_name}
                    onChange={(event) => setNewUser((current) => ({ ...current, full_name: event.target.value }))}
                    placeholder="Full name"
                  />
                  <input
                    value={newUser.password}
                    onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Password"
                  />
                  <select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}>
                    {["user", "moderator", "admin", "superuser"].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button className="primary-button" type="submit">
                    Create user
                  </button>
                </form>
                <div className="admin-table-card">
                  <h3>All users</h3>
                  <div className="courts-admin-content">
                    <div className="courts-admin-list">
                      {adminUsers.map((user) => (
                        <button
                          className={selectedAdminUserId === user.id ? "court-admin-item active" : "court-admin-item"}
                          key={user.id}
                          type="button"
                          onClick={() => openUserEditor(user)}
                        >
                          <strong>{user.full_name}</strong>
                          <span>#{user.id} - {user.role} - {user.is_active ? "active" : "inactive"}</span>
                        </button>
                      ))}
                    </div>
                    {adminUserForm ? (
                      <form className="court-editor-panel" onSubmit={saveUserEditor}>
                        <h4>Edit user</h4>
                        <input
                          value={adminUserForm.full_name || ""}
                          onChange={(event) => setAdminUserForm((current) => ({ ...current, full_name: event.target.value }))}
                          placeholder="Full name"
                        />
                        <select
                          value={adminUserForm.role || "user"}
                          onChange={(event) => setAdminUserForm((current) => ({ ...current, role: event.target.value }))}
                        >
                          {["user", "moderator", "admin", "superuser"].map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                        <label className="switch-cell">
                          <input
                            type="checkbox"
                            checked={Boolean(adminUserForm.is_active)}
                            onChange={(event) =>
                              setAdminUserForm((current) => ({ ...current, is_active: event.target.checked }))
                            }
                          />
                          <span>{adminUserForm.is_active ? "Active" : "Inactive"}</span>
                        </label>
                        <div className="row-actions">
                          <button className="primary-button" type="submit">Save changes</button>
                          <button className="danger-button" type="button" onClick={() => deleteAdminUser(adminUserForm.id)}>
                            Delete user
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {adminTab === "roles" ? (
              <div className="admin-panel-grid">
                <form className="admin-form-card" onSubmit={createRole}>
                  <h3>Create role</h3>
                  <input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="role_name" />
                  <button className="primary-button" type="submit">
                    Create role
                  </button>
                </form>
                <div className="admin-table-card">
                  <h3>All roles</h3>
                  <div className="pill-list">
                    {roles.map((role) => (
                      <span className="admin-pill" key={role.id}>
                        {role.name}
                        <button type="button" onClick={() => deleteRole(role.id)}>x</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {adminTab === "permissions" ? (
              <div className="permissions-layout">
                {endpointPermissionCatalog.map((entry) => (
                  <article className="permissions-role-card" key={entry.endpoint}>
                    <button
                      className="permissions-endpoint-trigger"
                      type="button"
                      onClick={() => setExpandedEndpoint((current) => (current === entry.endpoint ? "" : entry.endpoint))}
                    >
                      <strong>{entry.endpoint}</strong>
                      <span>{expandedEndpoint === entry.endpoint ? "Hide methods" : "Show methods"}</span>
                    </button>
                    {expandedEndpoint === entry.endpoint ? (
                      <div className="permissions-method-list">
                        {entry.methods.map((method) => {
                          const methodKey = `${entry.endpoint}::${method}`;
                          return (
                            <div className="permissions-method-card" key={methodKey}>
                              <button
                                className="permissions-method-trigger"
                                type="button"
                                onClick={() => setExpandedMethodKey((current) => (current === methodKey ? "" : methodKey))}
                              >
                                <strong>{method.toUpperCase()}</strong>
                                <span>{expandedMethodKey === methodKey ? "Hide roles" : "Edit roles"}</span>
                              </button>
                              {expandedMethodKey === methodKey ? (
                                <>
                                  <div className="permissions-table">
                                    <div className="permissions-row header-row">
                                      <span>Role</span>
                                      <span>Effect</span>
                                      <span>Ownership</span>
                                      <span>State</span>
                                    </div>
                                    {allRoleNames.map((roleName) => {
                                      const key = permissionKey(entry.endpoint, method);
                                      const draft = permissionDrafts[roleName]?.[key] || { allowed: false, ownership: "all" };
                                      return (
                                        <div className="permissions-row" key={`${methodKey}-${roleName}`}>
                                          <strong>{roleName}</strong>
                                          <select
                                            value={draft.allowed ? "allow" : "deny"}
                                            onChange={(event) =>
                                              updatePermissionDraft(roleName, entry.endpoint, method, {
                                                allowed: event.target.value === "allow"
                                              })
                                            }
                                          >
                                            <option value="allow">allow</option>
                                            <option value="deny">deny</option>
                                          </select>
                                          <select
                                            value={draft.ownership}
                                            disabled={!draft.allowed}
                                            onChange={(event) =>
                                              updatePermissionDraft(roleName, entry.endpoint, method, { ownership: event.target.value })
                                            }
                                          >
                                            <option value="all">all</option>
                                            <option value="self">self</option>
                                          </select>
                                          <span>{draft.allowed ? "enabled" : "blocked"}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <button className="primary-button" type="button" onClick={() => saveMethodPermissions(entry.endpoint, method)}>
                                    Save method rules
                                  </button>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}

            {adminTab === "courts" ? (
              <div className="admin-panel-grid courts-admin-layout">
                <form className="admin-form-card" onSubmit={createCourt}>
                  <h3>Create court</h3>
                  <input value={newCourt.name} onChange={(event) => setNewCourt((current) => ({ ...current, name: event.target.value }))} placeholder="Court name" />
                  <input value={newCourt.city} onChange={(event) => setNewCourt((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
                  <input
                    value={newCourt.district}
                    onChange={(event) => setNewCourt((current) => ({ ...current, district: event.target.value }))}
                    placeholder="District"
                  />
                  <input
                    value={newCourt.address}
                    onChange={(event) => setNewCourt((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Address"
                  />
                  <input
                    value={newCourt.image_url}
                    onChange={(event) => setNewCourt((current) => ({ ...current, image_url: event.target.value }))}
                    placeholder="Image URL"
                  />
                  <select value={newCourt.surface} onChange={(event) => setNewCourt((current) => ({ ...current, surface: event.target.value }))}>
                    <option>Hard</option>
                    <option>Clay</option>
                    <option>Grass</option>
                  </select>
                  <div className="auth-two-columns">
                    <input
                      value={newCourt.opening_time}
                      onChange={(event) => setNewCourt((current) => ({ ...current, opening_time: event.target.value }))}
                      type="time"
                    />
                    <input
                      value={newCourt.closing_time}
                      onChange={(event) => setNewCourt((current) => ({ ...current, closing_time: event.target.value }))}
                      type="time"
                    />
                  </div>
                  <input
                    value={newCourt.price_per_hour}
                    onChange={(event) => setNewCourt((current) => ({ ...current, price_per_hour: event.target.value }))}
                    placeholder="Price per hour"
                    type="number"
                  />
                  <button className="primary-button" type="submit">
                    Create court
                  </button>
                </form>
                <div className="admin-table-card">
                  <h3>All courts</h3>
                  <div className="courts-admin-content">
                    <div className="courts-admin-list">
                      {courts.map((court) => (
                        <button
                          className={selectedAdminCourtId === court.id ? "court-admin-item active" : "court-admin-item"}
                          key={court.id}
                          type="button"
                          onClick={() => openCourtEditor(court)}
                        >
                          <strong>{court.name}</strong>
                          <span>{court.city} - {court.district}</span>
                        </button>
                      ))}
                    </div>
                    {adminCourtForm ? (
                      <form className="court-editor-panel" onSubmit={saveCourtEditor}>
                        <h4>Edit court</h4>
                        <input value={adminCourtForm.name || ""} onChange={(event) => setAdminCourtForm((current) => ({ ...current, name: event.target.value }))} />
                        <input value={adminCourtForm.city || ""} onChange={(event) => setAdminCourtForm((current) => ({ ...current, city: event.target.value }))} />
                        <input value={adminCourtForm.district || ""} onChange={(event) => setAdminCourtForm((current) => ({ ...current, district: event.target.value }))} />
                        <input value={adminCourtForm.address || ""} onChange={(event) => setAdminCourtForm((current) => ({ ...current, address: event.target.value }))} />
                        <select value={adminCourtForm.surface || "Hard"} onChange={(event) => setAdminCourtForm((current) => ({ ...current, surface: event.target.value }))}>
                          <option>Hard</option>
                          <option>Clay</option>
                          <option>Grass</option>
                        </select>
                        <div className="auth-two-columns">
                          <input type="time" value={adminCourtForm.opening_time || "07:00"} onChange={(event) => setAdminCourtForm((current) => ({ ...current, opening_time: event.target.value }))} />
                          <input type="time" value={adminCourtForm.closing_time || "22:00"} onChange={(event) => setAdminCourtForm((current) => ({ ...current, closing_time: event.target.value }))} />
                        </div>
                        <input type="number" value={adminCourtForm.price_per_hour || 0} onChange={(event) => setAdminCourtForm((current) => ({ ...current, price_per_hour: event.target.value }))} />
                        <input
                          value={adminCourtForm.image_url || ""}
                          onChange={(event) => setAdminCourtForm((current) => ({ ...current, image_url: event.target.value }))}
                          placeholder="Image URL"
                        />
                        <label className="court-image-upload">
                          <span>Upload image file</span>
                          <input type="file" accept="image/*" onChange={(event) => uploadCourtImageFile(adminCourtForm.id, event.target.files?.[0])} />
                        </label>
                        {resolveCourtImageUrl(adminCourtForm) ? <img src={resolveCourtImageUrl(adminCourtForm)} alt="Court" className="court-editor-preview" /> : null}
                        <div className="row-actions">
                          <button className="primary-button" type="submit">Save changes</button>
                          <button className="danger-button" type="button" onClick={() => deleteCourt(adminCourtForm.id)}>Delete court</button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {adminTab === "bookings" ? (
              <div className="admin-table-card">
                <h3>All bookings</h3>
                <div className="admin-table bookings-table">
                  <div className="admin-row header-row">
                    <span>ID</span>
                    <span>User</span>
                    <span>Court</span>
                    <span>Status</span>
                    <span>Total</span>
                  </div>
                  {adminBookings.map((booking) => (
                    <div className="admin-row" key={booking.id}>
                      <span>{booking.id.slice(0, 8)}</span>
                      <span>{booking.user_id}</span>
                      <span>{booking.court_id.slice(0, 8)}</span>
                      <strong>{booking.status}</strong>
                      <span>{formatMoney(booking.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ops-panel">
              <button className="secondary-button" onClick={triggerNotification} disabled={!isAuthed}>
                Email кампанія
              </button>
              <button className="secondary-button" onClick={triggerReplay} disabled={!isAuthed}>
                Replay event log
              </button>
            </div>
          </section>
        ) : null}
      </main>
      {confirmDialog ? (
        <div className="confirm-backdrop" onClick={() => closeConfirmDialog(false)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
            <h3 id="confirm-title">{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button className="secondary-button" type="button" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel}
              </button>
              <button
                className={confirmDialog.tone === "danger" ? "danger-button" : "primary-button"}
                type="button"
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
