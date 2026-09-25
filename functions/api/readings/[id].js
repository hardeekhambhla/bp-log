import { db, json, bad, readBody, readReading } from "../../../lib/api.js";

export async function onRequestPatch({ env, request, params }) {
  const DB = await db(env);
  const { value, error } = readReading(await readBody(request));
  if (error) return bad(error);
  const r = await DB.prepare("UPDATE readings SET sys = ?, dia = ?, pulse = ?, note = ?, ts = ? WHERE id = ?")
    .bind(value.sys, value.dia, value.pulse, value.note, value.ts, params.id).run();
  return r.meta.changes ? json({ ok: true }) : bad("Reading not found.", 404);
}

export async function onRequestDelete({ env, params }) {
  const DB = await db(env);
  await DB.prepare("DELETE FROM readings WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
