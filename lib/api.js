const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY)",
  "CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL)",
  `CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    sys INTEGER NOT NULL, dia INTEGER NOT NULL, pulse INTEGER, note TEXT,
    ts INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_readings_profile_ts ON readings (profile_id, ts)",
];

let ready;

// Creates tables on first use, so no manual migration step.
export async function db(env) {
  if (!env.DB) throw new Error("D1 binding DB is missing");
  ready ??= env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return env.DB;
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export const bad = (error, status = 400) => json({ error }, status);

export const readBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export const cleanName = (v) => {
  const name = String(v ?? "").trim();
  return name.length >= 1 && name.length <= 40 ? name : null;
};

const int = (v) => (v === "" || v == null ? null : Number.isFinite(+v) ? Math.round(+v) : NaN);

// Returns { value } or { error }.
export function readReading(b) {
  const sys = int(b.sys), dia = int(b.dia), pulse = int(b.pulse);
  if (!(sys >= 50 && sys <= 300)) return { error: "Systolic should be 50–300." };
  if (!(dia >= 30 && dia <= 200)) return { error: "Diastolic should be 30–200." };
  if (sys <= dia) return { error: "Systolic must be higher than diastolic." };
  if (pulse !== null && !(pulse >= 20 && pulse <= 250)) return { error: "Pulse should be 20–250." };
  const ts = b.ts == null ? Date.now() : Math.round(+b.ts);
  if (!Number.isFinite(ts)) return { error: "Invalid date." };
  const note = String(b.note ?? "").trim().slice(0, 200) || null;
  return { value: { sys, dia, pulse, note, ts } };
}
