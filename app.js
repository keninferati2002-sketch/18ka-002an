/* =========================
   Storage keys
========================= */
const K = {
  SETTINGS: "gift_settings_v1",
  JAR: "gift_jar_v1",
  MICRO: "gift_micro_v1",
  MUSEUM: "gift_museum_v1",
  JOURNAL: "gift_journal_v1",
  MESSAGES: "gift_messages_v1"
};

/* =========================
   Utilities
========================= */
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

function nowISO() {
  return new Date().toISOString();
}
function dayISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function uid() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

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

function escapeText(s) {
  return (s ?? "").toString();
}

/* =========================
   IndexedDB for photos
========================= */
const DB_NAME = "gift_photos_db";
const DB_VERSION = 1;
const STORE = "photos";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutPhoto(photo) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(photo);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetPhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbDeletePhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================
   Image compression
========================= */
async function fileToCompressedBlob(file, maxW = 1280, quality = 0.82) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });

  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxW / w);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, nw, nh);

  URL.revokeObjectURL(img.src);

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  return blob;
}

/* =========================
   App state
========================= */
const defaults = {
  settings: {
    title: "Per Anna",
    subtitle: "Un posto piccolo, solo nostro.",
    toWhatsapp: "",
    toEmail: ""
  },
  jar: [
    { id: uid(), text: "Se sei qui, vuol dire che volevi un pensiero piccolo ma vero.", createdAt: nowISO() },
    { id: uid(), text: "Mi piaci più di quanto riesca a dire quando parlo di fretta.", createdAt: nowISO() },
    { id: uid(), text: "Oggi: non devi meritarti niente per essere amata.", createdAt: nowISO() }
  ],
  museum: [
    { id: uid(), date: dayISO(), title: "Il giorno in cui…", text: "Scrivi qui un ricordo breve.", photoIds: [], createdAt: nowISO(), updatedAt: nowISO() }
  ],
  journal: [
    { id: uid(), date: dayISO(), title: "Una cosa bella", text: "Scrivi qui una cosa bella che avete fatto insieme.", photoIds: [], createdAt: nowISO(), updatedAt: nowISO() }
  ],
  messages: []
};

let settings = load(K.SETTINGS, defaults.settings);
let jar = load(K.JAR, defaults.jar);
let museum = load(K.MUSEUM, defaults.museum);
let journal = load(K.JOURNAL, defaults.journal);
let messages = load(K.MESSAGES, defaults.messages);

/* =========================
   Apply settings (UI)
========================= */
function applyBrand() {
  $("#brandTitle").textContent = settings.title || "Per Anna";
  $("#brandSubtitle").textContent = settings.subtitle || "Un posto piccolo, solo nostro.";
  document.title = settings.title || "Per Anna";
}
applyBrand();

/* =========================
   Routing
========================= */
function setView(name) {
  $$(".view").forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
  $$(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
}
$$(".navbtn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.nav)));

$("#btnOpenSettings").addEventListener("click", () => setView("settings"));

/* =========================
   Oggi: jar
========================= */
function randomJarText() {
  if (!jar.length) return "Non ci sono bigliettini. Aggiungine uno.";
  const i = Math.floor(Math.random() * jar.length);
  return jar[i].text;
}

function renderToday() {
  $("#todayMsg").textContent = randomJarText();
}
renderToday();

$("#btnAnother").addEventListener("click", renderToday);

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }

$("#btnShowJar").addEventListener("click", () => {
  renderJarList();
  openModal("#modalJar");
});
$("#btnCloseJar").addEventListener("click", () => closeModal("#modalJar"));
$("#modalJar .modal__backdrop").addEventListener("click", () => closeModal("#modalJar"));

function renderJarList() {
  const list = $("#jarList");
  list.innerHTML = "";
  const items = [...jar].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  items.forEach((j) => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__title">Bigliettino</div>
        <div class="item__date">${(j.createdAt || "").slice(0,10) || "—"}</div>
      </div>
      <div class="item__text">${escapeText(j.text)}</div>
      <div class="item__actions">
        <button class="btn btn--ghost" data-act="copy" data-id="${j.id}">Copia</button>
        <button class="btn btn--ghost" data-act="delete" data-id="${j.id}">Elimina</button>
      </div>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const item = jar.find((x) => x.id === id);
      if (!item) return;

      if (act === "copy") {
        await navigator.clipboard.writeText(item.text);
      }
      if (act === "delete") {
        jar = jar.filter((x) => x.id !== id);
        save(K.JAR, jar);
        renderJarList();
      }
    });
  });
}

$("#btnAddJar").addEventListener("click", () => {
  const v = ($("#jarInput").value || "").trim();
  if (!v) return;
  jar.unshift({ id: uid(), text: v, createdAt: nowISO() });
  save(K.JAR, jar);
  $("#jarInput").value = "";
  renderJarList();
  $("#todayMsg").textContent = v;
});

$("#btnQuickAdd").addEventListener("click", () => {
  // Shortcut: aggiungi una voce al Journal (la più utile)
  openEntryModal({ section: "journal" });
});

/* =========================
   Oggi: micro good
========================= */
$("#btnSaveMicro").addEventListener("click", () => {
  const v = ($("#microGood").value || "").trim();
  if (!v) return;
  save(K.MICRO, { text: v, at: nowISO() });
});
$("#btnLoadMicro").addEventListener("click", () => {
  const m = load(K.MICRO, null);
  if (!m) return;
  $("#microGood").value = m.text || "";
});

/* =========================
   Quick message (send/copy)
========================= */
$("#btnSendQuick").addEventListener("click", async () => {
  const txt = ($("#quickMsg").value || "").trim();
  if (!txt) return;
  await sendOutMessage({ from: "Anna", text: txt });
  $("#quickMsg").value = "";
});
$("#btnCopyQuick").addEventListener("click", async () => {
  const txt = ($("#quickMsg").value || "").trim();
  if (!txt) return;
  await navigator.clipboard.writeText(txt);
});

/* =========================
   Messages page
========================= */
let pendingMessagePhotoIds = [];

function renderMessages() {
  const list = $("#messagesList");
  list.innerHTML = "";
  const items = [...messages].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  items.forEach((m) => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__title">${escapeText(m.from || "—")}</div>
        <div class="item__date">${(m.createdAt || "").slice(0,16).replace("T"," ")}</div>
      </div>
      <div class="item__text">${escapeText(m.text)}</div>
      <div class="thumbs" data-thumbs="msg" data-id="${m.id}"></div>
      <div class="item__actions">
        <button class="btn btn--ghost" data-act="share" data-id="${m.id}">Invia di nuovo</button>
        <button class="btn btn--ghost" data-act="copy" data-id="${m.id}">Copia</button>
        <button class="btn btn--ghost" data-act="delete" data-id="${m.id}">Elimina</button>
      </div>
    `;
    list.appendChild(el);
  });

  // thumbs
  items.forEach(async (m) => {
    const wrap = list.querySelector(`[data-thumbs="msg"][data-id="${m.id}"]`);
    if (!wrap) return;
    wrap.innerHTML = "";
    for (const pid of (m.photoIds || [])) {
      const p = await dbGetPhoto(pid);
      if (!p) continue;
      const url = URL.createObjectURL(p.blob);
      const t = document.createElement("div");
      t.className = "thumb";
      t.innerHTML = `<img src="${url}" alt="foto">`;
      t.addEventListener("click", () => openPhoto(url));
      wrap.appendChild(t);
    }
  });

  // actions
  list.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const m = messages.find((x) => x.id === id);
      if (!m) return;

      if (act === "copy") await navigator.clipboard.writeText(m.text);
      if (act === "share") await sendOutMessage({ from: m.from, text: m.text });
      if (act === "delete") {
        // delete related photos too
        for (const pid of (m.photoIds || [])) await dbDeletePhoto(pid);
        messages = messages.filter((x) => x.id !== id);
        save(K.MESSAGES, messages);
        renderMessages();
      }
    });
  });
}
renderMessages();

function renderPendingMessagePhotoPreview() {
  const wrap = $("#messagePhotoPreview");
  wrap.innerHTML = "";
  pendingMessagePhotoIds.forEach(async (pid) => {
    const p = await dbGetPhoto(pid);
    if (!p) return;
    const url = URL.createObjectURL(p.blob);
    const t = document.createElement("div");
    t.className = "thumb";
    t.innerHTML = `<img src="${url}" alt="foto">`;
    t.addEventListener("click", () => openPhoto(url));
    wrap.appendChild(t);
  });
}

$("#messagePhoto").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  for (const f of files) {
    const blob = await fileToCompressedBlob(f);
    const id = uid();
    await dbPutPhoto({ id, blob, mime: "image/jpeg", createdAt: nowISO() });
    pendingMessagePhotoIds.push(id);
  }

  e.target.value = "";
  renderPendingMessagePhotoPreview();
});

$("#btnClearMessagePhoto").addEventListener("click", async () => {
  for (const pid of pendingMessagePhotoIds) await dbDeletePhoto(pid);
  pendingMessagePhotoIds = [];
  renderPendingMessagePhotoPreview();
});

$("#btnSendMessage").addEventListener("click", async () => {
  const from = ($("#fromName").value || "").trim() || "Anna";
  const text = ($("#messageText").value || "").trim();
  if (!text && !pendingMessagePhotoIds.length) return;

  // Save local message
  const msg = { id: uid(), from, text, photoIds: pendingMessagePhotoIds, createdAt: nowISO() };
  messages.unshift(msg);
  save(K.MESSAGES, messages);
  renderMessages();

  // Send out via share/wa/email
  await sendOutMessage({ from, text });

  // Reset composer but keep local message photos linked (do not delete)
  pendingMessagePhotoIds = [];
  renderPendingMessagePhotoPreview();
  $("#messageText").value = "";
});

$("#btnCopyMessage").addEventListener("click", async () => {
  const from = ($("#fromName").value || "").trim() || "Anna";
  const text = ($("#messageText").value || "").trim();
  const payload = formatOutgoing(from, text);
  if (!payload.trim()) return;
  await navigator.clipboard.writeText(payload);
});

/* =========================
   Outgoing message helpers
========================= */
function formatOutgoing(from, text) {
  const t = (text || "").trim();
  const stamp = dayISO();
  if (!t) return "";
  return `[${stamp}] ${from}: ${t}`;
}

async function sendOutMessage({ from, text }) {
  const payload = formatOutgoing(from, text);
  if (!payload) return;

  // 1) Native share if possible
  if (navigator.share) {
    try {
      await navigator.share({ text: payload, title: "Messaggio" });
      return;
    } catch {
      // fall through
    }
  }

  // 2) WhatsApp link if configured
  const wa = (settings.toWhatsapp || "").trim();
  if (wa) {
    const url = `https://wa.me/${encodeURIComponent(wa)}?text=${encodeURIComponent(payload)}`;
    window.open(url, "_blank");
    return;
  }

  // 3) Email if configured
  const em = (settings.toEmail || "").trim();
  if (em) {
    const subject = encodeURIComponent("Messaggio");
    const body = encodeURIComponent(payload);
    window.location.href = `mailto:${encodeURIComponent(em)}?subject=${subject}&body=${body}`;
    return;
  }

  // 4) Fallback: copy to clipboard
  await navigator.clipboard.writeText(payload);
}

/* =========================
   Museum + Journal render
========================= */
function normalizeDate(d) {
  const v = (d || "").trim();
  if (!v) return "—";
  return v;
}

function matchesSearch(entry, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (entry.title || "").toLowerCase().includes(s) ||
    (entry.text || "").toLowerCase().includes(s) ||
    (entry.date || "").toLowerCase().includes(s)
  );
}

async function renderEntryList(type) {
  const isMuseum = type === "museo";
  const listEl = isMuseum ? $("#museumList") : $("#journalList");
  const q = (isMuseum ? $("#museumSearch").value : $("#journalSearch").value || "").trim();
  const sortMode = isMuseum ? "desc" : $("#journalSort").value;

  let items = isMuseum ? [...museum] : [...journal];
  items = items.filter((e) => matchesSearch(e, q));

  // journal ordered by date; museum just by updatedAt
  if (!isMuseum) {
    items.sort((a, b) => {
      const ad = (a.date || "0000-00-00");
      const bd = (b.date || "0000-00-00");
      return sortMode === "asc" ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
  } else {
    items.sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  }

  listEl.innerHTML = "";
  for (const e of items) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item__top">
        <div class="item__title">${escapeText(e.title || "—")}</div>
        <div class="item__date">${escapeText(normalizeDate(e.date))}</div>
      </div>
      <div class="item__text">${escapeText(e.text || "")}</div>
      <div class="thumbs" data-thumbs="${type}" data-id="${e.id}"></div>
      <div class="item__actions">
        <button class="btn btn--ghost" data-act="edit" data-type="${type}" data-id="${e.id}">Modifica</button>
        <button class="btn btn--ghost" data-act="copy" data-type="${type}" data-id="${e.id}">Copia</button>
      </div>
    `;
    listEl.appendChild(el);

    // thumbs render
    const wrap = el.querySelector(".thumbs");
    wrap.innerHTML = "";
    for (const pid of (e.photoIds || [])) {
      const p = await dbGetPhoto(pid);
      if (!p) continue;
      const url = URL.createObjectURL(p.blob);
      const t = document.createElement("div");
      t.className = "thumb";
      t.innerHTML = `<img src="${url}" alt="foto">`;
      t.addEventListener("click", () => openPhoto(url));
      wrap.appendChild(t);
    }
  }

  // actions
  listEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const t = btn.dataset.type;
      const act = btn.dataset.act;
      const arr = (t === "museo") ? museum : journal;
      const entry = arr.find((x) => x.id === id);
      if (!entry) return;

      if (act === "edit") openEntryModal({ section: t, entryId: id });
      if (act === "copy") {
        const txt = `${entry.date || ""}\n${entry.title || ""}\n\n${entry.text || ""}`.trim();
        await navigator.clipboard.writeText(txt);
      }
    });
  });
}

$("#museumSearch").addEventListener("input", () => renderEntryList("museo"));
$("#journalSearch").addEventListener("input", () => renderEntryList("journal"));
$("#journalSort").addEventListener("change", () => renderEntryList("journal"));

$("#btnAddMuseum").addEventListener("click", () => openEntryModal({ section: "museo" }));
$("#btnAddJournal").addEventListener("click", () => openEntryModal({ section: "journal" }));

renderEntryList("museo");
renderEntryList("journal");

/* =========================
   Entry modal (add/edit) + photos
========================= */
let entryModalState = {
  section: "journal",
  entryId: null,
  photoIds: []
};

function openEntryModal({ section, entryId = null }) {
  entryModalState.section = section;
  entryModalState.entryId = entryId;

  const isEdit = Boolean(entryId);
  $("#entryModalTitle").textContent = isEdit ? "Modifica voce" : "Nuova voce";
  $("#entrySection").value = section;

  const arr = (section === "museo") ? museum : journal;
  const entry = isEdit ? arr.find((x) => x.id === entryId) : null;

  $("#entryDate").value = entry?.date || dayISO();
  $("#entryTitle").value = entry?.title || "";
  $("#entryText").value = entry?.text || "";
  entryModalState.photoIds = [...(entry?.photoIds || [])];

  $("#btnDeleteEntry").style.display = isEdit ? "inline-flex" : "none";

  renderEntryThumbs();
  openModal("#modalEntry");
}

function closeEntryModal() {
  closeModal("#modalEntry");
  $("#entryPhotos").value = "";
}

$("#btnCloseEntry").addEventListener("click", closeEntryModal);
$("#modalEntry .modal__backdrop").addEventListener("click", closeEntryModal);

async function renderEntryThumbs() {
  const wrap = $("#entryThumbs");
  wrap.innerHTML = "";
  for (const pid of entryModalState.photoIds) {
    const p = await dbGetPhoto(pid);
    if (!p) continue;
    const url = URL.createObjectURL(p.blob);
    const t = document.createElement("div");
    t.className = "thumb";
    t.innerHTML = `<img src="${url}" alt="foto">`;
    t.title = "Click per vedere. Doppio click per rimuovere.";
    t.addEventListener("click", () => openPhoto(url));
    t.addEventListener("dblclick", async () => {
      // remove from entry but keep photo in DB? we delete to keep clean
      entryModalState.photoIds = entryModalState.photoIds.filter((x) => x !== pid);
      await dbDeletePhoto(pid);
      renderEntryThumbs();
    });
    wrap.appendChild(t);
  }
}

$("#entryPhotos").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  for (const f of files) {
    const blob = await fileToCompressedBlob(f);
    const id = uid();
    await dbPutPhoto({ id, blob, mime: "image/jpeg", createdAt: nowISO() });
    entryModalState.photoIds.push(id);
  }

  e.target.value = "";
  renderEntryThumbs();
});

$("#btnClearEntryPhotos").addEventListener("click", async () => {
  for (const pid of entryModalState.photoIds) await dbDeletePhoto(pid);
  entryModalState.photoIds = [];
  renderEntryThumbs();
});

$("#btnSaveEntry").addEventListener("click", () => {
  const section = $("#entrySection").value;
  const date = ($("#entryDate").value || "").trim() || dayISO();
  const title = ($("#entryTitle").value || "").trim();
  const text = ($("#entryText").value || "").trim();

  if (!title && !text && !entryModalState.photoIds.length) return;

  const arrName = (section === "museo") ? "museum" : "journal";
  let arr = (section === "museo") ? museum : journal;

  const isEdit = Boolean(entryModalState.entryId);
  if (isEdit) {
    const idx = arr.findIndex((x) => x.id === entryModalState.entryId);
    if (idx >= 0) {
      arr[idx] = {
        ...arr[idx],
        date, title, text,
        photoIds: [...entryModalState.photoIds],
        updatedAt: nowISO()
      };
    }
  } else {
    arr.unshift({
      id: uid(),
      date, title, text,
      photoIds: [...entryModalState.photoIds],
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }

  if (arrName === "museum") {
    museum = arr;
    save(K.MUSEUM, museum);
  } else {
    journal = arr;
    save(K.JOURNAL, journal);
  }

  entryModalState.entryId = null;
  closeEntryModal();
  renderEntryList("museo");
  renderEntryList("journal");
});

$("#btnDeleteEntry").addEventListener("click", async () => {
  const section = $("#entrySection").value;
  const id = entryModalState.entryId;
  if (!id) return;

  const arr = (section === "museo") ? museum : journal;
  const entry = arr.find((x) => x.id === id);
  if (!entry) return;

  for (const pid of (entry.photoIds || [])) await dbDeletePhoto(pid);

  if (section === "museo") {
    museum = museum.filter((x) => x.id !== id);
    save(K.MUSEUM, museum);
  } else {
    journal = journal.filter((x) => x.id !== id);
    save(K.JOURNAL, journal);
  }

  closeEntryModal();
  renderEntryList("museo");
  renderEntryList("journal");
});

/* =========================
   Photo viewer modal
========================= */
function openPhoto(url) {
  $("#photoViewImg").src = url;
  openModal("#modalPhoto");
}
function closePhoto() {
  $("#photoViewImg").src = "";
  closeModal("#modalPhoto");
}
$("#btnClosePhoto").addEventListener("click", closePhoto);
$("#modalPhoto .modal__backdrop").addEventListener("click", closePhoto);

/* =========================
   Settings page
========================= */
function renderSettingsForm() {
  $("#toWhatsapp").value = settings.toWhatsapp || "";
  $("#toEmail").value = settings.toEmail || "";
  $("#setTitle").value = settings.title || "";
  $("#setSubtitle").value = settings.subtitle || "";
}
renderSettingsForm();

$("#btnSaveSettings").addEventListener("click", () => {
  settings.toWhatsapp = ($("#toWhatsapp").value || "").trim();
  settings.toEmail = ($("#toEmail").value || "").trim();
  settings.title = ($("#setTitle").value || "").trim() || "Per Anna";
  settings.subtitle = ($("#setSubtitle").value || "").trim() || "Un posto piccolo, solo nostro.";

  save(K.SETTINGS, settings);
  applyBrand();
});

$("#btnResetApp").addEventListener("click", async () => {
  // Reset all localStorage keys
  localStorage.removeItem(K.SETTINGS);
  localStorage.removeItem(K.JAR);
  localStorage.removeItem(K.MICRO);
  localStorage.removeItem(K.MUSEUM);
  localStorage.removeItem(K.JOURNAL);
  localStorage.removeItem(K.MESSAGES);

  // Best-effort: delete photos DB (recreate on next open)
  try {
    indexedDB.deleteDatabase(DB_NAME);
  } catch {}

  // Reload
  location.reload();
});

/* =========================
   Export / Import backup
========================= */
async function blobToBase64(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}
async function base64ToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

$("#btnExport").addEventListener("click", async () => {
  // collect photos referenced in museum/journal/messages
  const photoIds = new Set();
  museum.forEach((e) => (e.photoIds || []).forEach((id) => photoIds.add(id)));
  journal.forEach((e) => (e.photoIds || []).forEach((id) => photoIds.add(id)));
  messages.forEach((m) => (m.photoIds || []).forEach((id) => photoIds.add(id)));

  const photos = [];
  for (const id of photoIds) {
    const p = await dbGetPhoto(id);
    if (!p) continue;
    const b64 = await blobToBase64(p.blob);
    photos.push({ id: p.id, mime: p.mime || "image/jpeg", createdAt: p.createdAt || nowISO(), dataUrl: b64 });
  }

  const payload = {
    version: 1,
    exportedAt: nowISO(),
    settings,
    jar,
    museum,
    journal,
    messages,
    photos
  };

  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `gift-backup-${dayISO()}.json`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("#btnImport").addEventListener("change", async (e) => {
  const file = (e.target.files || [])[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // restore main stores
    settings = data.settings || defaults.settings;
    jar = data.jar || defaults.jar;
    museum = data.museum || defaults.museum;
    journal = data.journal || defaults.journal;
    messages = data.messages || [];

    save(K.SETTINGS, settings);
    save(K.JAR, jar);
    save(K.MUSEUM, museum);
    save(K.JOURNAL, journal);
    save(K.MESSAGES, messages);

    // restore photos
    const photos = data.photos || [];
    for (const p of photos) {
      if (!p?.id || !p?.dataUrl) continue;
      const blob = await base64ToBlob(p.dataUrl);
      await dbPutPhoto({ id: p.id, blob, mime: p.mime || "image/jpeg", createdAt: p.createdAt || nowISO() });
    }

    applyBrand();
    renderSettingsForm();
    renderToday();
    renderMessages();
    renderEntryList("museo");
    renderEntryList("journal");
  } catch {
    // ignore
  } finally {
    e.target.value = "";
  }
});

/* =========================
   UX small touches
========================= */
// Default view
setView("oggi");
