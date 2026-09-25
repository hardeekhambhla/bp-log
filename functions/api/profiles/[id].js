import { db, json, bad, readBody, cleanName } from "../../../lib/api.js";

export async function onRequestPatch({ env, request, params }) {
  const DB = await db(env);
  const name = cleanName((await readBody(request)).name);
  if (!name) return bad("Enter a name (1–40 characters).");
  const r = await DB.prepare("UPDATE profiles SET name = ? WHERE id = ?").bind(name, params.id).run();
  return r.meta.changes ? json({ ok: true }) : bad("Profile not found.", 404);
}

export async function onRequestDelete({ env, params }) {
  const DB = await db(env);
  await DB.batch([
    DB.prepare("DELETE FROM readings WHERE profile_id = ?").bind(params.id),
    DB.prepare("DELETE FROM profiles WHERE id = ?").bind(params.id),
  ]);
  return json({ ok: true });
}
