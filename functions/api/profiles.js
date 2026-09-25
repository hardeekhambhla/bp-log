import { db, json, bad, readBody, cleanName } from "../../lib/api.js";

const SEED = ["Mom", "Dadima", "Dada", "Dad"];

const LIST = `
  SELECT p.id, p.name,
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
  return json((await DB.prepare(LIST).all()).results);
}

export async function onRequestPost({ env, request }) {
  const DB = await db(env);
  const name = cleanName((await readBody(request)).name);
  if (!name) return bad("Enter a name (1–40 characters).");
  const r = await DB.prepare("INSERT INTO profiles (name, created_at) VALUES (?, ?)").bind(name, Date.now()).run();
  return json({ id: r.meta.last_row_id, name, count: 0 }, 201);
}
