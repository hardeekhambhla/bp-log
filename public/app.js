const app = document.getElementById("app");

/* ---------- helpers ---------- */
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

const svg = (html, cls) => {
  const t = document.createElement("template");
  t.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" ${cls ? `class="${cls}"` : ""} ${html}</svg>`;
  return t.content.firstChild;
};
const CHEV = () => svg('viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m1 1 6 6-6 6"/>', "chev");
const BACK = () => svg('viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/>');
const PLUS = () => svg('viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/>');

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function dayLabel(ts) {
  const key = dayKey(ts);
  if (key === dayKey(Date.now())) return "Today";
  if (key === dayKey(Date.now() - 864e5)) return "Yesterday";
  return new Date(ts).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
const relative = (ts) => `${dayLabel(ts)}, ${fmtTime(ts)}`;
const toLocalInput = (ts) => new Date(ts - new Date(ts).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

// AHA categories -> tone (green / orange / red)
function classify(sys, dia) {
  if (sys > 180 || dia > 120) return { label: "Very high", tone: "high" };
  if (sys >= 140 || dia >= 90) return { label: "High (stage 2)", tone: "high" };
  if (sys >= 130 || dia >= 80) return { label: "High (stage 1)", tone: "warn" };
  if (sys >= 120) return { label: "Elevated", tone: "warn" };
  return { label: "Normal", tone: "ok" };
}

/* ---------- sheet (bottom modal) ---------- */
function openSheet({ title, body, saveLabel = "Save", onSave, onDelete, deleteLabel }) {
  const err = h("div", { class: "err", role: "alert" });
  const dlg = h("dialog");
  const close = () => { dlg.close(); dlg.remove(); };
  const form = h("form", { class: "sheet", novalidate: true },
    h("div", { class: "sheet-h" },
      h("button", { type: "button", onclick: close }, "Cancel"),
      h("b", {}, title),
      h("button", { type: "submit" }, saveLabel)),
    body, err,
    onDelete && h("div", { class: "gap" }),
    onDelete && h("button", { type: "button", class: "btn plain", onclick: async () => {
      if (!confirm(`${deleteLabel}? This can't be undone.`)) return;
      try { await onDelete(); close(); } catch (e) { err.textContent = e.message; }
    } }, deleteLabel));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    try { await onSave(); close(); } catch (ex) { err.textContent = ex.message; }
  });
  dlg.append(form);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener("cancel", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

const nameSheet = ({ profile, onDone }) => {
  const input = h("input", { class: "field", placeholder: "Name", value: profile?.name ?? "", maxlength: 40, autocomplete: "off", autocapitalize: "words" });
  const dlg = openSheet({
    title: profile ? "Edit Profile" : "New Profile",
    body: input,
    onSave: async () => {
      const name = input.value.trim();
      if (profile) await api(`/profiles/${profile.id}`, { method: "PATCH", body: { name } });
      else await api("/profiles", { method: "POST", body: { name } });
      onDone(name);
    },
    deleteLabel: "Delete Profile",
    onDelete: profile && (async () => { await api(`/profiles/${profile.id}`, { method: "DELETE" }); location.hash = "#/"; }),
  });
  input.focus();
  return dlg;
};

function readingSheet({ profile, reading, onDone }) {
  const num = (name, label, val, max) =>
    h("div", {}, h("label", { for: `f-${name}` }, label),
      h("input", { id: `f-${name}`, name, type: "number", inputmode: "numeric", value: val ?? "", placeholder: "–", max, autocomplete: "off" }));
  const grid = h("div", { class: "triple" }, num("sys", "Systolic", reading?.sys), num("dia", "Diastolic", reading?.dia), num("pulse", "Pulse", reading?.pulse));
  const when = h("input", { class: "field", type: "datetime-local", value: toLocalInput(reading?.ts ?? Date.now()) });
  const note = h("input", { class: "field", placeholder: "Optional", value: reading?.note ?? "", maxlength: 200 });
  const body = h("div", {}, grid,
    h("label", { class: "labeled", style: "display:block" }, h("span", {}, "Date & time"), when),
    h("label", { class: "labeled", style: "display:block" }, h("span", {}, "Note"), note));
  const dlg = openSheet({
    title: reading ? "Edit Reading" : "New Reading",
    body,
    onSave: async () => {
      const q = (n) => grid.querySelector(`[name=${n}]`).value;
      const data = { sys: q("sys"), dia: q("dia"), pulse: q("pulse"), note: note.value, ts: new Date(when.value).getTime() };
      if (reading) await api(`/readings/${reading.id}`, { method: "PATCH", body: data });
      else await api("/readings", { method: "POST", body: { ...data, profile_id: profile.id } });
      onDone();
    },
    deleteLabel: "Delete Reading",
    onDelete: reading && (async () => { await api(`/readings/${reading.id}`, { method: "DELETE" }); onDone(); }),
  });
  grid.querySelector("[name=sys]").focus();
  return dlg;
}

/* ---------- views ---------- */
async function homeView() {
  const profiles = await api("/profiles");
  const rows = profiles.map((p) => h("button", { class: "row", onclick: () => (location.hash = `#/p/${p.id}`) },
    h("div", { class: "avatar" }, p.name.trim()[0]?.toUpperCase() ?? "?"),
    h("div", { class: "grow" },
      h("div", { class: "title" }, p.name),
      h("div", { class: "sub" }, p.ts ? `${p.sys}/${p.dia} · ${relative(p.ts)}` : "No readings yet")),
    p.ts && h("span", { class: `dot ${classify(p.sys, p.dia).tone}` }),
    CHEV()));
  app.replaceChildren(
    h("div", { class: "nav" }, h("span"), h("button", { class: "plus", "aria-label": "Add profile", onclick: () => nameSheet({ onDone: route }) }, PLUS())),
    h("h1", {}, "Blood Pressure"),
    h("div", { class: "group" }, rows.length ? rows : h("div", { class: "empty" }, "No profiles yet. Tap + to add one.")));
  document.title = "Blood Pressure";
}

function chart(readings) {
  const pts = readings.slice(0, 30).reverse();
  const W = 320, H = 110, px = 6, py = 10;
  const lo = Math.min(...pts.map((r) => r.dia)) - 8, hi = Math.max(...pts.map((r) => r.sys)) + 8;
  const x = (i) => px + (i * (W - 2 * px)) / (pts.length - 1);
  const y = (v) => py + ((hi - v) * (H - 2 * py)) / (hi - lo);
  const line = (key) => pts.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r[key]).toFixed(1)}`).join("");
  const dots = (key, color) => pts.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(r[key]).toFixed(1)}" r="2.4" fill="${color}"/>`).join("");
  const grid = [0, 1, 2].map((i) => `<line x1="0" x2="${W}" y1="${py + (i * (H - 2 * py)) / 2}" y2="${py + (i * (H - 2 * py)) / 2}" stroke="var(--sep)" stroke-width=".5"/>`).join("");
  return h("div", { class: "group chart" },
    svg(`viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Trend of last ${pts.length} readings">${grid}
      <path d="${line("sys")}" stroke="var(--accent)" stroke-width="2"/>${dots("sys", "var(--accent)")}
      <path d="${line("dia")}" stroke="var(--label3)" stroke-width="2"/>${dots("dia", "var(--label3)")}`),
    h("div", { class: "legend" },
      h("span", {}, h("i", { style: "background:var(--accent)" }), "Systolic"),
      h("span", {}, h("i", { style: "background:var(--label3)" }), "Diastolic"),
      h("span", { style: "margin-left:auto" }, `Last ${pts.length}`)));
}

async function profileView(id) {
  const [profiles, readings] = await Promise.all([api("/profiles"), api(`/readings?profile=${id}`)]);
  const profile = profiles.find((p) => p.id === id);
  if (!profile) { location.hash = "#/"; return; }
  document.title = `${profile.name} · Blood Pressure`;
  const refresh = () => route();

  const parts = [
    h("div", { class: "nav" },
      h("button", { class: "back", onclick: () => (location.hash = "#/") }, BACK(), "Profiles"),
      h("button", { onclick: () => nameSheet({ profile, onDone: refresh }) }, "Edit")),
    h("h1", {}, profile.name),
    h("button", { class: "btn", onclick: () => readingSheet({ profile, onDone: refresh }) }, "Add Reading"),
  ];

  if (readings.length) {
    const r = readings[0], c = classify(r.sys, r.dia);
    parts.push(
      h("div", { class: "section-h" }, h("span", {}, "Latest")),
      h("div", { class: "group hero" },
        h("div", { class: "big" }, `${r.sys}/${r.dia}`, h("small", {}, "mmHg")),
        h("div", { class: "meta" }, h("span", { class: `dot ${c.tone}` }), c.label,
          r.pulse && ` · ${r.pulse} bpm`, ` · ${relative(r.ts)}`)));
    if (readings.length > 1) parts.push(h("div", { class: "section-h" }, h("span", {}, "Trend")), chart(readings));
  }

  const days = new Map();
  for (const r of readings) {
    const k = dayKey(r.ts);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(r);
  }
  if (!days.size) parts.push(h("div", { class: "section-h" }, h("span", {}, "Log")), h("div", { class: "group empty" }, "No readings yet. Tap Add Reading."));
  for (const list of days.values()) {
    const avg = (k) => Math.round(list.reduce((s, r) => s + r[k], 0) / list.length);
    parts.push(
      h("div", { class: "section-h" }, h("span", {}, dayLabel(list[0].ts)), list.length > 1 && h("span", {}, `avg ${avg("sys")}/${avg("dia")}`)),
      h("div", { class: "group" }, list.map((r) => h("button", { class: "row", onclick: () => readingSheet({ profile, reading: r, onDone: refresh }) },
        h("span", { class: "time" }, fmtTime(r.ts)),
        h("div", { class: "grow" },
          h("div", { class: "val" }, `${r.sys}/${r.dia}`, r.pulse && h("small", {}, `  ♥ ${r.pulse}`)),
          r.note && h("div", { class: "note" }, r.note)),
        h("span", { class: `dot ${classify(r.sys, r.dia).tone}` })))));
  }
  app.replaceChildren(...parts);
}

/* ---------- router ---------- */
async function route() {
  const scroll = window.scrollY;
  const m = location.hash.match(/^#\/p\/(\d+)/);
  try {
    await (m ? profileView(+m[1]) : homeView());
  } catch (e) {
    app.replaceChildren(h("div", { class: "nav" }), h("h1", {}, "Blood Pressure"), h("div", { class: "group empty" }, e.message));
  }
  window.scrollTo(0, m && app.dataset.r === location.hash ? scroll : 0);
  app.dataset.r = location.hash;
}
addEventListener("hashchange", route);
route();
