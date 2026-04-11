import { gsap } from "gsap";

const i18n = window.WassersportI18n;

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
if (media && ripples) {
  function setRipple(e) {
    const rect = media.getBoundingClientRect();
    const x = ((e.clientX ?? (e.touches?.[0]?.clientX || 0)) - rect.left) / rect.width * 100;
    const y = ((e.clientY ?? (e.touches?.[0]?.clientY || 0)) - rect.top) / rect.height * 100;
    ripples.style.setProperty("--x", `${x}%`);
    ripples.style.setProperty("--y", `${y}%`);
  }
  ["mousemove","touchmove"].forEach(ev => media.addEventListener(ev, setRipple, { passive: true }));
}

/* header year */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* captain banner — uses /api/captain?lang= for DeepL translation */
function renderCaptainFallback() {
  const el = document.getElementById("captain-text");
  if (el) el.textContent = i18n.t("home.banner.empty");
}

function loadCaptainText() {
  const language = i18n.getLanguage();
  const el = document.getElementById("captain-text");
  if (el) el.textContent = i18n.t("home.banner.loading");

  fetch(`/api/captain?lang=${encodeURIComponent(language)}`)
    .then((r) => {
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    })
    .then((data) => {
      const text = (data && data.text || "").trim();
      if (el) el.textContent = text || i18n.t("home.banner.empty");
    })
    .catch(renderCaptainFallback);
}

loadCaptainText();
document.addEventListener(i18n.eventName, loadCaptainText);
