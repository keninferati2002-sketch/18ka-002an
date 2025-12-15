const JAR_KEY = "jar_messages_v1";
const TIMELINE_KEY = "timeline_v1";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const defaultJar = [
  "Se sei qui, vuol dire che volevi un pensiero piccolo ma vero.",
  "Mi piaci più di quanto riesca a dire quando parlo di fretta.",
  "Oggi: non devi meritarti niente per essere amata."
];

const defaultTimeline = [
  { title: "Il giorno in cui…", date: "—", text: "Scrivi qui un ricordo breve." },
  { title: "Quella volta che…", date: "—", text: "Scrivi qui un dettaglio che solo voi capite." }
];

let jar = load(JAR_KEY, defaultJar);
let timeline = load(TIMELINE_KEY, defaultTimeline);

const tabs = document.querySelectorAll(".tab");
const sections = {
  oggi: document.getElementById("tab-oggi"),
  noi: document.getElementById("tab-noi"),
  sos: document.getElementById("tab-sos")
};

function setTab(name) {
  tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  Object.keys(sections).forEach((k) => sections[k].classList.toggle("hidden", k !== name));
}

tabs.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

function randomJarMessage() {
  if (!jar.length) return "Aggiungi un bigliettino, e poi riprova.";
  const i = Math.floor(Math.random() * jar.length);
  return jar[i];
}

const todayMsg = document.getElementById("todayMsg");
const btnAnother = document.getElementById("btnAnother");
const jarInput = document.getElementById("jarInput");
const btnAddJar = document.getElementById("btnAddJar");

todayMsg.textContent = randomJarMessage();

btnAnother.addEventListener("click", () => {
  todayMsg.textContent = randomJarMessage();
});

btnAddJar.addEventListener("click", () => {
  const v = (jarInput.value || "").trim();
  if (!v) return;
  jar = [v, ...jar];
  save(JAR_KEY, jar);
  jarInput.value = "";
  todayMsg.textContent = v;
});

const timelineList = document.getElementById("timelineList");
const tlTitle = document.getElementById("tlTitle");
const tlDate = document.getElementById("tlDate");
const tlText = document.getElementById("tlText");
const btnAddTimeline = document.getElementById("btnAddTimeline");

function renderTimeline() {
  timelineList.innerHTML = "";
  timeline.forEach((e) => {
    const card = document.createElement("div");
    card.className = "entry";

    const top = document.createElement("div");
    top.className = "entryTop";

    const strong = document.createElement("strong");
    strong.textContent = e.title;

    const date = document.createElement("span");
    date.style.opacity = "0.7";
    date.style.fontSize = "12px";
    date.textContent = e.date || "—";

    top.appendChild(strong);
    top.appendChild(date);

    const p = document.createElement("p");
    p.className = "p";
    p.textContent = e.text;

    card.appendChild(top);
    card.appendChild(p);
    timelineList.appendChild(card);
  });
}

renderTimeline();

btnAddTimeline.addEventListener("click", () => {
  const title = (tlTitle.value || "").trim();
  const date = (tlDate.value || "").trim() || "—";
  const text = (tlText.value || "").trim();

  if (!title || !text) return;

  timeline = [{ title, date, text }, ...timeline];
  save(TIMELINE_KEY, timeline);

  tlTitle.value = "";
  tlDate.value = "";
  tlText.value = "";

  renderTimeline();
});
