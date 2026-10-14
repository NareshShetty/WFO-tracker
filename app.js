"use strict";

const STORAGE_KEY = "office-days-timeline-v1";
const SETTINGS_KEY = "office-days-settings-v1";
const EXCLUSIONS_KEY = "office-days-exclusions-v1";
const MANUAL_DAYS_KEY = "office-days-manual-days-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const defaultSettings = { name: "Etamin Prestige", latitude: "", longitude: "", radius: 150 };

const elements = {
  fileInput: document.getElementById("timeline-files"),
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  officeForm: document.getElementById("office-form"),
  officeName: document.getElementById("office-name"),
  officeLat: document.getElementById("office-lat"),
  officeLon: document.getElementById("office-lon"),
  officeRadius: document.getElementById("office-radius"),
  monthPicker: document.getElementById("month-picker"),
  calendar: document.getElementById("calendar"),
  previousMonth: document.getElementById("previous-month"),
  nextMonth: document.getElementById("next-month"),
  periodTitle: document.getElementById("period-title"),
  periodSubtitle: document.getElementById("period-subtitle"),
  officeDaysCount: document.getElementById("office-days-count"),
  officeVisitsCount: document.getElementById("office-visits-count"),
  monthlyAttendance: document.getElementById("monthly-attendance"),
  monthlyAttendanceNote: document.getElementById("monthly-attendance-note"),
  attendanceToDate: document.getElementById("attendance-to-date"),
  attendanceToDateNote: document.getElementById("attendance-to-date-note"),
  selectedDateTitle: document.getElementById("selected-date-title"),
  selectedDateSummary: document.getElementById("selected-date-summary"),
  dateExclusionControls: document.getElementById("date-exclusion-controls"),
  dateExclusionStatus: document.getElementById("date-exclusion-status"),
  markHoliday: document.getElementById("mark-holiday"),
  markLeave: document.getElementById("mark-leave"),
  clearExclusion: document.getElementById("clear-exclusion"),
  manualAttendanceControls: document.getElementById("manual-attendance-controls"),
  manualAttendanceStatus: document.getElementById("manual-attendance-status"),
  toggleManualAttendance: document.getElementById("toggle-manual-attendance"),
  dayVisits: document.getElementById("day-visits"),
  dataSummary: document.getElementById("data-summary"),
  importStatus: document.getElementById("import-status"),
  emptyState: document.getElementById("empty-state"),
  dataPanel: document.querySelector(".data-panel"),
  exportData: document.getElementById("export-data"),
  clearData: document.getElementById("clear-data")
};

let visits = loadFromStorage(STORAGE_KEY, []);
let settings = { ...defaultSettings, ...loadFromStorage(SETTINGS_KEY, {}) };
if (settings.name === "My office") settings.name = defaultSettings.name;
let exclusions = loadFromStorage(EXCLUSIONS_KEY, {});
if (!exclusions || typeof exclusions !== "object" || Array.isArray(exclusions)) exclusions = {};
let manualDays = loadFromStorage(MANUAL_DAYS_KEY, []);
if (!Array.isArray(manualDays)) manualDays = [];
manualDays = new Set(manualDays.filter(isValidDateKey));
let selectedDay = null;

function isValidDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(`${key}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDateKey(date) === key;
}

function loadFromStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from browser storage.`, error);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to browser storage.`, error);
    showStatus("Browser storage is full or unavailable. Download a backup before clearing site data.", true);
    return false;
  }
}

function showStatus(message, isError) {
  elements.importStatus.textContent = message;
  elements.importStatus.classList.toggle("is-error", Boolean(isError));
}

function validCoordinatePair(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

function configuredOfficeCoordinates() {
  if (settings.latitude === "" || settings.latitude === null || settings.latitude === undefined
    || settings.longitude === "" || settings.longitude === null || settings.longitude === undefined) {
    return null;
  }
  const coordinates = { latitude: Number(settings.latitude), longitude: Number(settings.longitude) };
  return validCoordinatePair(coordinates.latitude, coordinates.longitude) ? coordinates : null;
}

function parseCoordinatePair(value) {
  if (typeof value === "string") {
    const matches = value.match(/-?\d+(?:\.\d+)?/g);
    if (matches && matches.length >= 2) {
      const latitude = Number(matches[0]);
      const longitude = Number(matches[1]);
      if (validCoordinatePair(latitude, longitude)) return { latitude, longitude };
    }
  }
  if (value && typeof value === "object") {
    const latitude = Number(value.latitude ?? value.lat);
    const longitude = Number(value.longitude ?? value.lng ?? value.lon);
    if (validCoordinatePair(latitude, longitude)) return { latitude, longitude };
  }
  return null;
}

function timestampValue(value) {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const numeric = Number(value);
    const milliseconds = numeric > 1e14 ? numeric / 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function getVisitTime(visit, parent) {
  const duration = visit.duration || parent.duration || {};
  const start = timestampValue(
    duration.startTimestamp || duration.startTimestampMs || visit.startTime || parent.startTime
  );
  const end = timestampValue(
    duration.endTimestamp || duration.endTimestampMs || visit.endTime || parent.endTime
  );
  return { start, end };
}

function getCoordinates(visit) {
  const location = visit.location || {};
  const candidates = [
    visit.topCandidate?.placeLocation?.latLng,
    visit.topCandidate?.placeLocation,
    visit.placeLocation?.latLng,
    visit.placeLocation,
    visit.location?.latLng,
    visit.location,
    location.latitudeE7 !== undefined && location.longitudeE7 !== undefined
      ? { latitude: Number(location.latitudeE7) / 1e7, longitude: Number(location.longitudeE7) / 1e7 }
      : null
  ];
  for (const candidate of candidates) {
    const coordinates = parseCoordinatePair(candidate);
    if (coordinates) return coordinates;
  }
  return null;
}

function getPlaceName(visit) {
  return visit.topCandidate?.placeName
    || visit.topCandidate?.name
    || visit.placeName
    || visit.name
    || visit.location?.name
    || visit.location?.address
    || visit.address
    || "Timeline visit";
}

function collectVisits(data) {
  const records = [];
  const addVisit = (visit, parent) => {
    if (!visit || typeof visit !== "object") return;
    const coordinates = getCoordinates(visit);
    const { start, end } = getVisitTime(visit, parent || {});
    if (!coordinates || !start) return;
    records.push({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      start,
      end: end || start,
      name: String(getPlaceName(visit)).slice(0, 160)
    });
  };

  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.visit && typeof value.visit === "object") addVisit(value.visit, value);
    if (value.placeVisit && typeof value.placeVisit === "object") addVisit(value.placeVisit, value);
    if (value.semanticSegments && Array.isArray(value.semanticSegments)) {
      value.semanticSegments.forEach(walk);
    }
    if (value.timelineObjects && Array.isArray(value.timelineObjects)) {
      value.timelineObjects.forEach(walk);
    }
    if (value.placeVisit === undefined && value.visit === undefined) {
      for (const [key, child] of Object.entries(value)) {
        if (key !== "semanticSegments" && key !== "timelineObjects") walk(child);
      }
    }
  };

  walk(data);
  const unique = new Map();
  records.forEach((record) => unique.set(visitKey(record), record));
  return [...unique.values()];
}

function visitKey(visit) {
  return [visit.start, visit.end, visit.latitude.toFixed(6), visit.longitude.toFixed(6)].join("|");
}

function distanceInMetres(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude))
    * Math.sin(longitudeDifference / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function officeVisits() {
  const office = configuredOfficeCoordinates();
  if (!office) return [];
  return visits.filter((visit) =>
    distanceInMetres(office, visit) <= Number(settings.radius || defaultSettings.radius)
  );
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateIsWeekend(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function eligibleWorkdays(year, month, endDay) {
  const days = [];
  const lastDay = Math.min(endDay, new Date(year, month + 1, 0).getDate());
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    if (!dateIsWeekend(key) && !exclusions[key]) days.push(key);
  }
  return days;
}

function dateKeyFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}

function groupedOfficeVisits() {
  const grouped = new Map();
  officeVisits().forEach((visit) => {
    const startKey = dateKeyFromTimestamp(visit.start);
    if (!startKey) return;
    const endKey = dateKeyFromTimestamp(visit.end) || startKey;
    const [year, month, day] = startKey.split("-").map(Number);
    const current = new Date(year, month - 1, day, 12);
    while (localDateKey(current) <= endKey) {
      const key = localDateKey(current);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(visit);
      current.setDate(current.getDate() + 1);
    }
  });
  manualDays.forEach((key) => {
    if (!grouped.has(key)) grouped.set(key, []);
  });
  return grouped;
}

function selectedMonth() {
  const [year, month] = elements.monthPicker.value.split("-").map(Number);
  return { year, month: month - 1 };
}

function renderCalendar() {
  const { year, month } = selectedMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const officeDays = groupedOfficeVisits();
  const monthName = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  elements.periodTitle.textContent = monthName;
  elements.periodSubtitle.textContent = `At ${settings.name || "your office"} · percentage = office days / eligible workdays`;
  elements.calendar.replaceChildren();

  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday) => {
    const cell = document.createElement("span");
    cell.className = "calendar-weekday";
    cell.textContent = weekday;
    grid.append(cell);
  });
  for (let index = 0; index < firstDay.getDay(); index += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-day is-empty";
    grid.append(blank);
  }
  const today = localDateKey(new Date());
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    const exclusion = exclusions[key];
    const dayLabel = exclusion ? `, ${exclusion}` : dateIsWeekend(key) ? ", weekend excluded" : "";
    const manualDay = manualDays.has(key);
    const officeDayLabel = officeDays.has(key) ? manualDay ? ", manually added office day" : ", office day" : "";
    button.setAttribute("aria-label", `${date.toLocaleDateString(undefined, { dateStyle: "full" })}${officeDayLabel}${dayLabel}`);
    if (officeDays.has(key)) button.classList.add("is-office", "is-clickable");
    if (manualDay) button.classList.add("is-manual");
    if (exclusion) button.classList.add("is-excluded");
    if (dateIsWeekend(key)) button.classList.add("is-weekend");
    if (key === today) button.classList.add("is-today");
    if (key === selectedDay) button.classList.add("is-selected");
    button.classList.add("is-clickable");
    button.addEventListener("click", () => {
      selectedDay = key;
      renderCalendar();
      renderSelectedDay();
    });
    grid.append(button);
  }
  elements.calendar.append(grid);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const monthOfficeDays = [...officeDays.keys()].filter((key) => key.startsWith(monthPrefix));
  const monthVisitCount = new Set(monthOfficeDays.flatMap((key) => officeDays.get(key).map(visitKey))).size;
  elements.officeDaysCount.textContent = String(monthOfficeDays.length);
  elements.officeVisitsCount.textContent = String(monthVisitCount);

  const monthWorkdays = eligibleWorkdays(year, month, daysInMonth);
  const monthOfficeWorkdays = monthWorkdays.filter((key) => officeDays.has(key));
  const now = new Date();
  const currentMonth = now.getFullYear() === year && now.getMonth() === month;
  const futureMonth = new Date(year, month, 1) > new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedThrough = currentMonth ? now.getDate() : futureMonth ? 0 : daysInMonth;
  const elapsedWorkdays = eligibleWorkdays(year, month, elapsedThrough);
  const elapsedOfficeDays = elapsedWorkdays.filter((key) => officeDays.has(key));
  const officeConfigured = Boolean(configuredOfficeCoordinates());
  const attendanceAvailable = officeConfigured || manualDays.size > 0;
  elements.monthlyAttendance.textContent = attendanceAvailable && monthWorkdays.length
    ? `${Math.round(monthOfficeWorkdays.length / monthWorkdays.length * 100)}%`
    : "—";
  elements.monthlyAttendanceNote.textContent = attendanceAvailable
    ? `${monthOfficeWorkdays.length} / ${monthWorkdays.length} eligible workdays`
    : "Set your office location or mark days manually";
  elements.attendanceToDate.textContent = attendanceAvailable && elapsedWorkdays.length
    ? `${Math.round(elapsedOfficeDays.length / elapsedWorkdays.length * 100)}%`
    : "—";
  elements.attendanceToDateNote.textContent = attendanceAvailable
    ? `${elapsedOfficeDays.length} / ${elapsedWorkdays.length} eligible workdays${futureMonth ? " (month hasn't started)" : ""}`
    : "Set your office location or mark days manually";

  if (!selectedDay || !selectedDay.startsWith(monthPrefix)) {
    selectedDay = currentMonth ? today : monthOfficeDays.sort().at(-1) || `${monthPrefix}01`;
  }
  renderSelectedDay();
}

function renderSelectedDay() {
  const grouped = groupedOfficeVisits();
  const dayVisits = selectedDay ? grouped.get(selectedDay) : null;
  elements.dayVisits.replaceChildren();
  if (!selectedDay) {
    elements.selectedDateTitle.textContent = "Select a day";
    elements.selectedDateSummary.textContent = "Choose a date to see visits or manage exclusions.";
    elements.dateExclusionControls.hidden = true;
    elements.manualAttendanceControls.hidden = true;
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty";
    empty.textContent = "No date selected yet.";
    elements.dayVisits.append(empty);
    return;
  }
  const date = new Date(`${selectedDay}T12:00:00`);
  elements.selectedDateTitle.textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const isManualDay = manualDays.has(selectedDay);
  elements.selectedDateSummary.textContent = dayVisits?.length
    ? `${dayVisits.length} ${dayVisits.length === 1 ? "visit" : "visits"} at ${settings.name || "your office"}${isManualDay ? " · also added manually" : ""}`
    : isManualDay ? "Manually added as an office day." : "No matching office visits on this date.";
  const exclusion = exclusions[selectedDay];
  elements.dateExclusionControls.hidden = false;
  elements.dateExclusionStatus.textContent = exclusion
    ? `Excluded as ${exclusion}.`
    : dateIsWeekend(selectedDay) ? "Weekend — excluded automatically." : "Workday — included in attendance calculations.";
  elements.markHoliday.disabled = exclusion === "holiday";
  elements.markLeave.disabled = exclusion === "leave";
  elements.clearExclusion.disabled = !exclusion;
  elements.manualAttendanceControls.hidden = false;
  elements.manualAttendanceStatus.textContent = isManualDay
    ? "This date is manually counted as an office day."
    : "Add a day here if Timeline data is unavailable or missing.";
  elements.toggleManualAttendance.textContent = isManualDay ? "Remove manual office day" : "Mark as office day";
  if (!dayVisits?.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty";
    empty.textContent = isManualDay ? "No Timeline visits recorded; manual attendance is counted." : "No matching visits on this date.";
    elements.dayVisits.append(empty);
    return;
  }
  dayVisits.sort((a, b) => a.start.localeCompare(b.start)).forEach((visit) => {
    const row = document.createElement("div");
    row.className = "visit-row";
    const marker = document.createElement("span");
    marker.className = "visit-marker";
    const details = document.createElement("div");
    details.className = "visit-details";
    const name = document.createElement("p");
    name.className = "visit-name";
    name.textContent = visit.name;
    const time = document.createElement("p");
    time.className = "visit-time";
    const start = new Date(visit.start);
    const end = new Date(visit.end);
    const spansDays = dateKeyFromTimestamp(visit.start) !== dateKeyFromTimestamp(visit.end);
    const timeOptions = { hour: "numeric", minute: "2-digit" };
    const dateTimeOptions = { month: "short", day: "numeric", ...timeOptions };
    const startText = start.toLocaleString(undefined, spansDays ? dateTimeOptions : timeOptions);
    const endText = end.getTime() > start.getTime()
      ? ` – ${end.toLocaleString(undefined, spansDays ? dateTimeOptions : timeOptions)}`
      : "";
    time.textContent = `${startText}${endText}`;
    details.append(name, time);
    row.append(marker, details);
    elements.dayVisits.append(row);
  });
}

function renderDataStatus() {
  const officeCount = officeVisits().length;
  const officeConfigured = Boolean(configuredOfficeCoordinates());
  elements.dataPanel.classList.toggle("has-data", visits.length > 0);
  elements.exportData.disabled = visits.length === 0 && manualDays.size === 0 && Object.keys(exclusions).length === 0 && !officeConfigured;
  elements.clearData.disabled = visits.length === 0;
  if (visits.length === 0) {
    elements.dataSummary.textContent = manualDays.size
      ? `No Timeline visits imported · ${manualDays.size} office ${manualDays.size === 1 ? "day" : "days"} added manually.`
      : "No Timeline visits imported yet. You can mark office days manually in the calendar.";
    return;
  }
  elements.dataSummary.textContent = `${visits.length.toLocaleString()} Timeline visits stored in this browser${officeConfigured ? ` · ${officeCount.toLocaleString()} match ${settings.name || "your office"}` : " · Set your office location to calculate attendance"}.`;
}

function renderAll() {
  renderCalendar();
  renderDataStatus();
}

function applySettingsToForm() {
  elements.officeName.value = settings.name;
  elements.officeLat.value = settings.latitude;
  elements.officeLon.value = settings.longitude;
  elements.officeRadius.value = settings.radius;
}

async function importFiles(files) {
  if (!files.length) return;
  showStatus("Reading Timeline files…", false);
  const imported = [];
  const failures = [];
  for (const file of files) {
    try {
      const content = await file.text();
      const data = JSON.parse(content);
      const fileVisits = collectVisits(data);
      if (fileVisits.length === 0) {
        failures.push(`${file.name}: no supported place visits found`);
      } else {
        imported.push(...fileVisits);
      }
    } catch (error) {
      console.error(`Unable to import ${file.name}.`, error);
      failures.push(`${file.name}: could not read valid JSON`);
    }
  }
  const combined = new Map(visits.map((visit) => [visitKey(visit), visit]));
  imported.forEach((visit) => combined.set(visitKey(visit), visit));
  const nextVisits = [...combined.values()];
  if (imported.length > 0 && !saveToStorage(STORAGE_KEY, nextVisits)) {
    showStatus("Import could not be saved. Free browser storage or download a backup, then try again.", true);
    return;
  }
  visits = nextVisits;
  if (imported.length > 0) {
    const message = `${imported.length.toLocaleString()} visit records read. ${visits.length.toLocaleString()} total unique visits are stored.`;
    showStatus(failures.length ? `${message} Some files were skipped: ${failures.join("; ")}.` : message, failures.length > 0);
  } else {
    showStatus(failures.join("; ") || "No visits were found in the selected files.", true);
  }
  renderAll();
}

function changeMonth(offset) {
  const [year, month] = elements.monthPicker.value.split("-").map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  elements.monthPicker.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  selectedDay = null;
  renderCalendar();
}

elements.fileInput.addEventListener("change", (event) => {
  importFiles([...event.target.files]);
  event.target.value = "";
});

elements.settingsToggle.addEventListener("click", () => {
  elements.settingsPanel.hidden = !elements.settingsPanel.hidden;
  if (!elements.settingsPanel.hidden) elements.officeName.focus();
});

elements.officeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const latitude = elements.officeLat.value.trim() ? Number(elements.officeLat.value) : Number.NaN;
  const longitude = elements.officeLon.value.trim() ? Number(elements.officeLon.value) : Number.NaN;
  const radius = Number(elements.officeRadius.value);
  if (!validCoordinatePair(latitude, longitude) || !Number.isFinite(radius) || radius < 20 || radius > 5000) {
    showStatus("Enter valid office coordinates and a radius between 20 and 5,000 metres.", true);
    return;
  }
  settings = {
    name: elements.officeName.value.trim() || defaultSettings.name,
    latitude,
    longitude,
    radius
  };
  if (!saveToStorage(SETTINGS_KEY, settings)) return;
  showStatus("Office location saved. Attendance has been recalculated.", false);
  renderAll();
});

elements.monthPicker.addEventListener("change", () => {
  selectedDay = null;
  renderCalendar();
});
elements.previousMonth.addEventListener("click", () => changeMonth(-1));
elements.nextMonth.addEventListener("click", () => changeMonth(1));

function setDateExclusion(type) {
  if (!selectedDay) return;
  const nextExclusions = { ...exclusions, [selectedDay]: type };
  if (!saveToStorage(EXCLUSIONS_KEY, nextExclusions)) return;
  exclusions = nextExclusions;
  renderAll();
}

elements.markHoliday.addEventListener("click", () => setDateExclusion("holiday"));
elements.markLeave.addEventListener("click", () => setDateExclusion("leave"));
elements.clearExclusion.addEventListener("click", () => {
  if (!selectedDay || !exclusions[selectedDay]) return;
  const nextExclusions = { ...exclusions };
  delete nextExclusions[selectedDay];
  if (!saveToStorage(EXCLUSIONS_KEY, nextExclusions)) return;
  exclusions = nextExclusions;
  renderAll();
});

elements.toggleManualAttendance.addEventListener("click", () => {
  if (!selectedDay) return;
  const nextManualDays = new Set(manualDays);
  if (nextManualDays.has(selectedDay)) {
    nextManualDays.delete(selectedDay);
  } else {
    nextManualDays.add(selectedDay);
  }
  if (!saveToStorage(MANUAL_DAYS_KEY, [...nextManualDays])) return;
  manualDays = nextManualDays;
  showStatus(manualDays.has(selectedDay)
    ? "Manual office day saved."
    : "Manual office day removed.", false);
  renderAll();
});

elements.exportData.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ visits, settings, exclusions, manualDays: [...manualDays] }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "office-days-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

elements.clearData.addEventListener("click", () => {
  if (!window.confirm("Clear all imported Timeline visits from this browser? This cannot be undone unless you downloaded a backup.")) return;
  if (!saveToStorage(STORAGE_KEY, [])) return;
  visits = [];
  selectedDay = null;
  showStatus("Timeline data cleared from this browser.", false);
  renderAll();
});

const now = new Date();
elements.monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
applySettingsToForm();
renderAll();
