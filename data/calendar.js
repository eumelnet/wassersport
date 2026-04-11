/* ── Standalone Calendar — no external dependencies ──────────────────────── */
(function () {
  'use strict';

  const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const MONTHS = [
    "Januar","Februar","März","April","Mai","Juni",
    "Juli","August","September","Oktober","November","Dezember"
  ];

  function parseIcsDate(str) {
    if (!str) return null;
    const s = str.replace(/[TZ]/g, "");
    const y = +s.slice(0,4), mo = +s.slice(4,6)-1, d = +s.slice(6,8);
    const h = +s.slice(8,10)||0, mi = +s.slice(10,12)||0;
    return new Date(y, mo, d, h, mi);
  }

  function fmtTime(date) {
    if (!date) return "";
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function dateKey(date) {
    return date.getFullYear() + "-" +
      String(date.getMonth()+1).padStart(2,"0") + "-" +
      String(date.getDate()).padStart(2,"0");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var allEvents = [];
  var eventsByDay = {};
  var currentYear, currentMonth, selectedDay = null;

  function loadEvents(callback) {
    var params = new URLSearchParams(window.location.search);
    var lang = params.get('lang') || 'de';
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/events?lang=" + encodeURIComponent(lang), true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { allEvents = JSON.parse(xhr.responseText); } catch(e) { allEvents = []; }
      } else {
        allEvents = [];
      }
      buildIndex();
      callback();
    };
    xhr.onerror = function () {
      allEvents = [];
      buildIndex();
      callback();
    };
    xhr.send();
  }

  function buildIndex() {
    eventsByDay = {};
    for (var i = 0; i < allEvents.length; i++) {
      var ev = allEvents[i];
      var d = parseIcsDate(ev.dtstart);
      if (!d) continue;
      var k = dateKey(d);
      if (!eventsByDay[k]) eventsByDay[k] = [];
      eventsByDay[k].push(ev);
    }
  }

  function renderCalendar() {
    var grid = document.getElementById("cal-grid");
    var label = document.getElementById("cal-month-label");
    if (!grid || !label) return;

    label.textContent = MONTHS[currentMonth] + " " + currentYear;
    grid.innerHTML = "";

    for (var wi = 0; wi < WEEKDAYS.length; wi++) {
      var h = document.createElement("div");
      h.className = "cal-day-header";
      h.textContent = WEEKDAYS[wi];
      grid.appendChild(h);
    }

    var today = new Date();
    var todayKey = dateKey(today);

    var firstDay = new Date(currentYear, currentMonth, 1);
    var startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    var prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (var i = startOffset - 1; i >= 0; i--) {
      var d = new Date(currentYear, currentMonth - 1, prevMonthDays - i);
      grid.appendChild(makeDayCell(d, true, todayKey));
    }

    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(currentYear, currentMonth, day);
      grid.appendChild(makeDayCell(d, false, todayKey));
    }

    var totalCells = startOffset + daysInMonth;
    var remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (var day = 1; day <= remainder; day++) {
      var d = new Date(currentYear, currentMonth + 1, day);
      grid.appendChild(makeDayCell(d, true, todayKey));
    }
  }

  function makeDayCell(date, otherMonth, todayKey) {
    var k = dateKey(date);
    var cell = document.createElement("div");
    cell.className = "cal-day";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label",
      date.toLocaleDateString("de-DE", { day:"numeric", month:"long", year:"numeric" }));
    cell.textContent = date.getDate();

    if (otherMonth)       cell.classList.add("other-month");
    if (k === todayKey)   cell.classList.add("today");
    if (k === selectedDay) cell.classList.add("selected");
    if (eventsByDay[k])   cell.classList.add("has-event");

    (function(key) {
      cell.addEventListener("click", function() { selectDay(key); });
      cell.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDay(key); }
      });
    })(k);

    return cell;
  }

  function selectDay(key) {
    selectedDay = key;
    renderCalendar();
    renderEventsForDay(key);
  }

  function makeEventCard(ev, showDate) {
    var start = parseIcsDate(ev.dtstart);
    var end   = parseIcsDate(ev.dtend);
    var timeStr = start
      ? (end ? fmtTime(start) + " \u2013 " + fmtTime(end) + " Uhr" : fmtTime(start) + " Uhr")
      : "";
    var dateStr = (showDate && start)
      ? start.toLocaleDateString("de-DE", { weekday:"short", day:"numeric", month:"long", year:"numeric" })
      : "";

    var card = document.createElement("div");
    card.className = "cal-event-card";
    var html = "";
    if (ev.categories) html += '<span class="cal-event-category">' + escHtml(ev.categories) + '</span>';
    html += '<h3>' + escHtml(ev.summary) + '</h3>';
    if (showDate && dateStr) {
      html += '<div class="cal-event-time">\uD83D\uDCC5 ' + escHtml(dateStr) + (timeStr ? ' \u00B7 ' + escHtml(timeStr) : '') + '</div>';
    } else if (timeStr) {
      html += '<div class="cal-event-time">\uD83D\uDD50 ' + escHtml(timeStr) + '</div>';
    }
    if (ev.location)    html += '<div class="cal-event-location">\uD83D\uDCCD ' + escHtml(ev.location) + '</div>';
    if (ev.description) html += '<div class="cal-event-desc">' + escHtml(ev.description) + '</div>';
    html += '<div class="cal-event-ics"><a href="/ics/' + encodeURIComponent(ev.file) + '" download>\u2B07 Termin herunterladen (.ics)</a></div>';
    card.innerHTML = html;
    return card;
  }

  function renderEventsForDay(key) {
    var container = document.getElementById("cal-events");
    if (!container) return;
    container.innerHTML = "";

    var evs = eventsByDay[key];
    if (!evs || evs.length === 0) {
      container.innerHTML = '<p class="cal-empty">Keine Termine an diesem Tag.</p>';
      return;
    }
    for (var i = 0; i < evs.length; i++) {
      container.appendChild(makeEventCard(evs[i], false));
    }
  }

  function renderUpcoming() {
    var container = document.getElementById("cal-events");
    if (!container) return;
    container.innerHTML = "";

    var todayStr = dateKey(new Date()).replace(/-/g, "");
    var upcoming = allEvents.filter(function(ev) {
      return (ev.dtstart || "") >= todayStr;
    });

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="cal-empty">Keine bevorstehenden Termine.</p>';
      return;
    }

    var heading = document.createElement("p");
    heading.className = "cal-upcoming-label";
    heading.textContent = "N\u00E4chste Termine:";
    container.appendChild(heading);

    var limit = Math.min(upcoming.length, 5);
    for (var i = 0; i < limit; i++) {
      container.appendChild(makeEventCard(upcoming[i], true));
    }
  }

  function init() {
    var grid = document.getElementById("cal-grid");
    if (!grid) return;

    var now = new Date();
    currentYear  = now.getFullYear();
    currentMonth = now.getMonth();

    loadEvents(function() {
      renderCalendar();
      renderUpcoming();
    });

    var prevBtn = document.getElementById("cal-prev");
    var nextBtn = document.getElementById("cal-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", function() {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function() {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
