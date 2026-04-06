import { gsap } from "gsap";

/* minimal gsap entrance */
gsap.from(".hero-copy h1", { y: 12, opacity: 0, duration: 0.6, ease: "power2.out" });
gsap.from(".hero-copy p", { y: 10, opacity: 0, duration: 0.6, delay: 0.1, ease: "power2.out" });
gsap.from(".hero-cta .btn", { y: 8, opacity: 0, duration: 0.5, delay: 0.2, stagger: 0.05, ease: "power2.out" });

/* cards on view */
const cards = document.querySelectorAll(".card");
cards.forEach((c, i) => {
  gsap.from(c, { y: 18, opacity: 0, duration: 0.5, delay: 0.1 + i * 0.05, ease: "power2.out" });
});

/* interactive ripples tracking pointer */
const media = document.querySelector(".hero-media");
const ripples = document.querySelector(".ripples");
function setRipple(e) {
  const rect = media.getBoundingClientRect();
  const x = ((e.clientX ?? (e.touches?.[0]?.clientX || 0)) - rect.left) / rect.width * 100;
  const y = ((e.clientY ?? (e.touches?.[0]?.clientY || 0)) - rect.top) / rect.height * 100;
  ripples.style.setProperty("--x", `${x}%`);
  ripples.style.setProperty("--y", `${y}%`);
}
["mousemove","touchmove"].forEach(ev => media.addEventListener(ev, setRipple, { passive: true }));

/* header year */
document.getElementById("year").textContent = new Date().getFullYear();

/* captain banner */
fetch("captain.txt").then(r => r.text()).then(t => {
  const el = document.getElementById("captain-text");
  if (el) el.textContent = t.trim() || "Keine Ankündigungen.";
}).catch(() => {
  const el = document.getElementById("captain-text");
  if (el) el.textContent = "Keine Ankündigungen.";
});

/* ── Calendar ──────────────────────────────────────────────────────────────── */

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember"
];

/** Parse ICS datetime string like 20260412T100000 → Date (local) */
function parseIcsDate(str) {
  if (!str) return null;
  const s = str.replace(/[TZ]/g, "");
  const y = +s.slice(0,4), mo = +s.slice(4,6)-1, d = +s.slice(6,8);
  const h = +s.slice(8,10)||0, mi = +s.slice(10,12)||0;
  return new Date(y, mo, d, h, mi);
}

/** Format time as HH:MM */
function fmtTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Format date key as YYYY-MM-DD */
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

let allEvents = [];       // raw events from API
let eventsByDay = {};     // { "2026-04-12": [ev, ...] }
let currentYear, currentMonth, selectedDay = null;

async function loadEvents() {
  try {
    const res = await fetch("/api/events");
    allEvents = await res.json();
  } catch {
    allEvents = [];
  }
  // Index by day
  eventsByDay = {};
  for (const ev of allEvents) {
    const d = parseIcsDate(ev.dtstart);
    if (!d) continue;
    const k = dateKey(d);
    (eventsByDay[k] = eventsByDay[k] || []).push(ev);
  }
}

function renderCalendar() {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month-label");
  if (!grid || !label) return;

  label.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

  grid.innerHTML = "";

  // Weekday headers (Mon–Sun)
  for (const wd of WEEKDAYS) {
    const h = document.createElement("div");
    h.className = "cal-day-header";
    h.textContent = wd;
    grid.appendChild(h);
  }

  const today = new Date();
  const todayKey = dateKey(today);

  // First day of month (0=Sun … 6=Sat), shift to Mon-based
  const firstDay = new Date(currentYear, currentMonth, 1);
  let startOffset = firstDay.getDay() - 1; // Mon=0
  if (startOffset < 0) startOffset = 6;

  // Days in previous month to fill
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const d = new Date(currentYear, currentMonth - 1, day);
    grid.appendChild(makeDayCell(d, true, todayKey));
  }

  // Days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    grid.appendChild(makeDayCell(d, false, todayKey));
  }

  // Fill remaining cells to complete last row
  const totalCells = startOffset + daysInMonth;
  const remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let day = 1; day <= remainder; day++) {
    const d = new Date(currentYear, currentMonth + 1, day);
    grid.appendChild(makeDayCell(d, true, todayKey));
  }
}

function makeDayCell(date, otherMonth, todayKey) {
  const k = dateKey(date);
  const cell = document.createElement("div");
  cell.className = "cal-day";
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("tabindex", "0");
  cell.setAttribute("aria-label", date.toLocaleDateString("de-DE", { day:"numeric", month:"long", year:"numeric" }));
  cell.textContent = date.getDate();

  if (otherMonth) cell.classList.add("other-month");
  if (k === todayKey) cell.classList.add("today");
  if (k === selectedDay) cell.classList.add("selected");
  if (eventsByDay[k]) cell.classList.add("has-event");

  cell.addEventListener("click", () => selectDay(k));
  cell.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") selectDay(k); });
  return cell;
}

function selectDay(key) {
  selectedDay = key;
  renderCalendar();
  renderEvents(key);
}

function renderEvents(key) {
  const container = document.getElementById("cal-events");
  if (!container) return;
  container.innerHTML = "";

  const evs = eventsByDay[key];
  if (!evs || evs.length === 0) {
    const p = document.createElement("p");
    p.className = "cal-empty";
    p.textContent = "Keine Termine an diesem Tag.";
    container.appendChild(p);
    return;
  }

  for (const ev of evs) {
    const start = parseIcsDate(ev.dtstart);
    const end   = parseIcsDate(ev.dtend);
    const timeStr = start
      ? (end ? `${fmtTime(start)} – ${fmtTime(end)} Uhr` : `${fmtTime(start)} Uhr`)
      : "";

    const card = document.createElement("div");
    card.className = "cal-event-card";
    card.innerHTML = `
      ${ev.categories ? `<span class="cal-event-category">${ev.categories}</span>` : ""}
      <h3>${ev.summary}</h3>
      ${timeStr ? `<div class="cal-event-time">🕐 ${timeStr}</div>` : ""}
      ${ev.location ? `<div class="cal-event-location">📍 ${ev.location}</div>` : ""}
      ${ev.description ? `<div class="cal-event-desc">${ev.description}</div>` : ""}
      <div class="cal-event-ics"><a href="/ics/${ev.file}" download>📅 Termin herunterladen (.ics)</a></div>
    `;
    container.appendChild(card);
  }
}

async function initCalendar() {
  await loadEvents();
  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();
  renderCalendar();

  document.getElementById("cal-prev")?.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  document.getElementById("cal-next")?.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
}

initCalendar();
