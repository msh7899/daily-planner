const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...h } });

async function hash(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
const CATS = ['work', 'personal', 'health', 'study', 'home'];
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

let schemaOk = false; // به‌روزرسانی خودکار ساختار دیتابیس (دیگر نیازی به اجرای دستی migration نیست)
async function ensureSchema(db) {
  if (schemaOk) return;
  for (const q of ["ALTER TABLE users ADD COLUMN hint_first TEXT DEFAULT ''", "ALTER TABLE users ADD COLUMN hint_last TEXT DEFAULT ''", "ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT ''"]) {
    try { await db.prepare(q).run(); } catch { /* ستون از قبل هست */ }
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS periods(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,start_date TEXT NOT NULL,end_date TEXT DEFAULT '')").run();
  schemaOk = true;
}

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  if (!db) return J({ error: 'دیتابیس D1 با نام DB متصل نشده است' }, 500);
  const path = [].concat(params.path || []).join('/');
  const m = request.method;
  const url = new URL(request.url);
  const body = ['POST', 'PUT', 'PATCH'].includes(m) ? await request.json().catch(() => ({})) : {};
  try {
    await ensureSchema(db);
    // ---- سرنخ رمز (حرف اول و آخر) ----
    if (path === 'hint' && m === 'GET') {
      const name = String(url.searchParams.get('username') || '').trim();
      let u = await db.prepare('SELECT hint_first f,hint_last l FROM users WHERE username=?').bind(name).first();
      if (!u) { const all = (await db.prepare('SELECT hint_first f,hint_last l FROM users LIMIT 2').all()).results; if (all.length === 1) u = all[0]; }
      return J({ hint: u && u.f ? { first: u.f, last: u.l } : null });
    }
    // ---- ورود ----
    if (path === 'login' && m === 'POST') {
      const c = await db.prepare('SELECT COUNT(*) n FROM users').first();
      if (!c.n) { // اولین اجرا: ساخت کاربر پیش‌فرض Admin / Admin
        const salt = rand(16);
        await db.prepare('INSERT INTO users(username,hash,salt,must_change,hint_first,hint_last) VALUES(?,?,?,1,?,?)').bind('Admin', await hash('Admin', salt), salt, 'A', 'n').run();
      }
      const u = await db.prepare('SELECT * FROM users WHERE username=?').bind(String(body.username || '').trim()).first();
      if (!u || (await hash(String(body.password || ''), u.salt)) !== u.hash) return J({ error: 'نام کاربری یا رمز عبور اشتباه است' }, 401);
      if (!u.hint_first) { const cp = [...String(body.password || '')]; await db.prepare('UPDATE users SET hint_first=?,hint_last=? WHERE id=?').bind(cp[0] || '', cp[cp.length - 1] || '', u.id).run(); }
      const token = rand(32), age = 60 * 60 * 24 * 30;
      await db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();
      await db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(token, u.id, Date.now() + age * 1000).run();
      return J({ ok: true, mustChange: !!u.must_change }, 200, { 'Set-Cookie': `s=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}` });
    }
    // ---- احراز هویت ----
    const tok = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)s=([a-f0-9]+)/)?.[1];
    const user = tok && await db.prepare('SELECT u.id,u.username,u.must_change,u.hash,u.salt,u.hint_first,u.hint_last FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').bind(tok, Date.now()).first();
    if (!user) return J({ error: 'unauthorized' }, 401);
    const uid = user.id;

    if (path === 'logout' && m === 'POST') {
      await db.prepare('DELETE FROM sessions WHERE token=?').bind(tok).run();
      return J({ ok: true }, 200, { 'Set-Cookie': 's=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (path === 'me') return J({ username: user.username, mustChange: !!user.must_change });

    // ---- تغییر نام کاربری / رمز ----
    if (path === 'account' && m === 'POST') {
      if ((await hash(String(body.current || ''), user.salt)) !== user.hash) return J({ error: 'رمز فعلی اشتباه است' }, 400);
      const nu = String(body.username || '').trim() || user.username, np = String(body.password || '');
      if (nu.length < 3) return J({ error: 'نام کاربری حداقل ۳ کاراکتر باشد' }, 400);
      if (np && np.length < 4) return J({ error: 'رمز عبور حداقل ۴ کاراکتر باشد' }, 400);
      const salt = np ? rand(16) : user.salt, h = np ? await hash(np, salt) : user.hash;
      const cp = [...np], hf = np ? cp[0] : user.hint_first, hl = np ? cp[cp.length - 1] : user.hint_last;
      try { await db.prepare('UPDATE users SET username=?,hash=?,salt=?,must_change=?,hint_first=?,hint_last=? WHERE id=?').bind(nu, h, salt, np ? 0 : user.must_change, hf, hl, uid).run(); }
      catch { return J({ error: 'این نام کاربری قبلاً استفاده شده' }, 400); }
      return J({ ok: true });
    }

    // ---- برنامه روز ----
    if (path === 'day') {
      const date = m === 'GET' ? url.searchParams.get('date') : body.date;
      if (!isDate(date)) return J({ error: 'تاریخ نامعتبر' }, 400);
      if (m === 'GET') {
        const tasks = (await db.prepare("SELECT id,title,done,priority,time,category FROM tasks WHERE user_id=? AND date=? ORDER BY done, CASE WHEN time='' THEN 1 ELSE 0 END, time, id").bind(uid, date).all()).results;
        const day = await db.prepare('SELECT p1,p2,p3,notes,mood,water FROM days WHERE user_id=? AND date=?').bind(uid, date).first()
          || { p1: '', p2: '', p3: '', notes: '', mood: 0, water: 0 };
        return J({ tasks, day });
      }
      if (m === 'PUT') {
        const d = body.day || {}, t = (v, n) => String(v ?? '').slice(0, n);
        await db.prepare(`INSERT INTO days(user_id,date,p1,p2,p3,notes,mood,water) VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id,date) DO UPDATE SET p1=excluded.p1,p2=excluded.p2,p3=excluded.p3,notes=excluded.notes,mood=excluded.mood,water=excluded.water`)
          .bind(uid, date, t(d.p1, 200), t(d.p2, 200), t(d.p3, 200), t(d.notes, 5000), +d.mood || 0, Math.min(+d.water || 0, 20)).run();
        return J({ ok: true });
      }
    }

    // ---- کارها ----
    if (path === 'tasks' && m === 'POST') {
      const title = String(body.title || '').trim().slice(0, 200);
      if (!title || !isDate(body.date)) return J({ error: 'عنوان کار خالی است' }, 400);
      const r = await db.prepare('INSERT INTO tasks(user_id,date,title,priority,time,category) VALUES(?,?,?,?,?,?)')
        .bind(uid, body.date, title, [0, 1, 2].includes(+body.priority) ? +body.priority : 1, /^\d{2}:\d{2}$/.test(body.time) ? body.time : '', CATS.includes(body.category) ? body.category : '').run();
      return J({ ok: true, id: r.meta.last_row_id });
    }
    if (path === 'carry' && m === 'POST') {
      if (!isDate(body.date)) return J({ error: 'تاریخ نامعتبر' }, 400);
      const r = await db.prepare('UPDATE tasks SET date=? WHERE user_id=? AND done=0 AND date<?').bind(body.date, uid, body.date).run();
      return J({ ok: true, moved: r.meta.changes });
    }
    const tm = path.match(/^tasks\/(\d+)$/);
    if (tm) {
      const id = +tm[1];
      if (m === 'PATCH') {
        if ('done' in body) await db.prepare('UPDATE tasks SET done=? WHERE id=? AND user_id=?').bind(body.done ? 1 : 0, id, uid).run();
        if (body.title) await db.prepare('UPDATE tasks SET title=? WHERE id=? AND user_id=?').bind(String(body.title).slice(0, 200), id, uid).run();
        return J({ ok: true });
      }
      if (m === 'DELETE') { await db.prepare('DELETE FROM tasks WHERE id=? AND user_id=?').bind(id, uid).run(); return J({ ok: true }); }
    }
    // ---- نمای هفتگی ----
    if (path === 'week' && m === 'GET') {
      const s = url.searchParams.get('start');
      if (!isDate(s)) return J({ error: 'تاریخ نامعتبر' }, 400);
      const e = new Date(s + 'T12:00:00Z'); e.setUTCDate(e.getUTCDate() + 6);
      const tasks = (await db.prepare("SELECT id,date,title,done,priority,time,category FROM tasks WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date, done, time, id").bind(uid, s, e.toISOString().slice(0, 10)).all()).results;
      const moods = (await db.prepare('SELECT date,mood FROM days WHERE user_id=? AND date BETWEEN ? AND ? AND mood>0').bind(uid, s, e.toISOString().slice(0, 10)).all()).results;
      return J({ tasks, moods });
    }
    // ---- قاعدگی ----
    if (path === 'periods') {
      if (m === 'GET') return J({ periods: (await db.prepare('SELECT id,start_date,end_date FROM periods WHERE user_id=? ORDER BY start_date DESC LIMIT 24').bind(uid).all()).results });
      if (m === 'POST') {
        if (!isDate(body.start) || (body.end && (!isDate(body.end) || body.end < body.start))) return J({ error: 'تاریخ‌ها نامعتبرند' }, 400);
        await db.prepare('INSERT INTO periods(user_id,start_date,end_date) VALUES(?,?,?)').bind(uid, body.start, body.end || '').run();
        return J({ ok: true });
      }
    }
    const pm = path.match(/^periods\/(\d+)$/);
    if (pm) {
      if (m === 'PATCH' && isDate(body.end)) { await db.prepare('UPDATE periods SET end_date=? WHERE id=? AND user_id=? AND start_date<=?').bind(body.end, +pm[1], uid, body.end).run(); return J({ ok: true }); }
      if (m === 'DELETE') { await db.prepare('DELETE FROM periods WHERE id=? AND user_id=?').bind(+pm[1], uid).run(); return J({ ok: true }); }
    }
    return J({ error: 'not found' }, 404);
  } catch (e) {
    return J({ error: 'خطای سرور: ' + e.message }, 500);
  }
}
