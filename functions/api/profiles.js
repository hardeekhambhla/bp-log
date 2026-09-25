import { db, json, bad, readBody, cleanName, validIcon, pickIcons } from "../../lib/api.js";

const SEED = ["Mom", "Dadima", "Dada", "Dad"];

const LIST = `
  SELECT p.id, p.name, p.icon,
    (SELECT COUNT(*) FROM readings r WHERE r.profile_id = p.id) AS count,
    l.sys, l.dia, l.pulse, l.ts
  FROM profiles p
  LEFT JOIN readings l ON l.id = (SELECT id FROM readings WHERE profile_id = p.id ORDER BY ts DESC LIMIT 1)
  ORDER BY p.id`;

export async function onRequestGet({ env }) {
  const DB = await db(env);
  // Seed once, ever (even if all profiles are later deleted).
  const first = await DB.prepare("INSERT OR IGNORE INTO meta (k) VALUES ('seeded')").run();
  if (first.meta.changes) {
    await DB.batch(SEED.map((n) => DB.prepare("INSERT INTO profiles (name, created_at) VALUES (?, ?)").bind(n, Date.now())));
  }
  // Give a random icon to any profile without one (seeded / pre-icon profiles).
  const { results: all } = await DB.prepare("SELECT id, icon FROM profiles").all();
  const missing = all.filter((r) => r.icon == null);
  if (missing.length) {
    const icons = pickIcons(missing.length, all.filter((r) => r.icon != null).map((r) => r.icon));
    await DB.batch(missing.map((r, i) => DB.prepare("UPDATE profiles SET icon = ? WHERE id = ?").bind(icons[i], r.id)));
  }
  return json((await DB.prepare(LIST).all()).results);
}

export async function onRequestPost({ env, request }) {
  const DB = await db(env);
  const b = await readBody(request);
  const name = cleanName(b.name);
  if (!name) return bad("Enter a name (1–40 characters).");
  const used = (await DB.prepare("SELECT icon FROM profiles WHERE icon IS NOT NULL").all()).results.map((r) => r.icon);
  const icon = validIcon(b.icon) ?? pickIcons(1, used)[0];
  const r = await DB.prepare("INSERT INTO profiles (name, created_at, icon) VALUES (?, ?, ?)").bind(name, Date.now(), icon).run();
  return json({ id: r.meta.last_row_id, name, icon, count: 0 }, 201);
}
