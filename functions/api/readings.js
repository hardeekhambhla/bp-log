import { db, json, bad, readBody, readReading } from "../../lib/api.js";

export async function onRequestGet({ env, request }) {
  const DB = await db(env);
  const profile = new URL(request.url).searchParams.get("profile");
  if (!profile) return bad("profile is required.");
  const { results } = await DB.prepare(
    "SELECT id, profile_id, sys, dia, pulse, note, ts FROM readings WHERE profile_id = ? ORDER BY ts DESC LIMIT 5000"
  ).bind(profile).all();
  return json(results);
}

export async function onRequestPost({ env, request }) {
  const DB = await db(env);
  const b = await readBody(request);
  const { value, error } = readReading(b);
  if (error) return bad(error);
  const exists = await DB.prepare("SELECT 1 FROM profiles WHERE id = ?").bind(b.profile_id).first();
  if (!exists) return bad("Profile not found.", 404);
  const r = await DB.prepare(
    "INSERT INTO readings (profile_id, sys, dia, pulse, note, ts) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(b.profile_id, value.sys, value.dia, value.pulse, value.note, value.ts).run();
  return json({ id: r.meta.last_row_id, profile_id: +b.profile_id, ...value }, 201);
}
