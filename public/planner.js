const $ = s => document.querySelector(s);
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const fmt = (s, o) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', o).format(new Date(s + 'T12:00:00'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const weekStart = s => addDays(s, -((new Date(s + 'T12:00:00').getDay() + 1) % 7)); // شروع هفته: شنبه
const today = () => iso(new Date());
const CATS = { work: ['💼', 'کار', '#3b82f6'], personal: ['🌿', 'شخصی', '#10b981'], health: ['❤️', 'سلامت', '#ef4444'], study: ['📚', 'مطالعه', '#8b5cf6'], home: ['🏠', 'خانه', '#f59e0b'] };
const toast = t => { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 2400); };
const pick = a => a[Math.floor(Math.random() * a.length)];
function quip() {
  if (data.tasks.length && data.tasks.every(x => x.done)) return toast('🏆 همه کارا تموم! حالا با وجدان راحت می‌تونی هیچ‌کاری نکنی');
  toast(pick(['آفرین! یه کار کمتر برای فرار کردن 😎', 'معجزه شد 🎉', 'باورم نمیشه واقعاً انجامش دادی 😳', 'یه قدم تا افسانه شدن 🦸', 'تنبلی امروز یه ضربه خورد 🥊']));
}
let date = today(), data = null, timer, view = 'day', wk = weekStart(today()), wtasks = [], periods = [], filter = '';

async function api(p, m = 'GET', b) {
  const r = await fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== 'login') { showLogin(); throw d; }
  if (!r.ok) throw d;
  return d;
}
function showLogin() { location.href = 'index.html'; }
async function start() {
  try {
    const me = await api('me'); if (me.mustChange) return showLogin();
    $('#tc').innerHTML = '<option value="">بدون دسته</option>' + Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join('');
    periods = (await api('periods')).periods;
    setView(view);
  } catch { showLogin(); }
}
function setView(v) {
  view = v;
  [['day', '#vDay'], ['week', '#vWeek'], ['cycle', '#vCycle']].forEach(([k, id]) => $(id).hidden = k !== v);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#sv').textContent = '';
  if (v === 'day') load(); else if (v === 'week') lw();
  else { $('#wd').textContent = 'there will be blood :)'; $('#jd').textContent = 'ثبت و پیش‌بینی دوره‌های قاعدگی'; renderCycle(); }
}

/* ---------- روز ---------- */
async function load() {
  data = await api('day?date=' + date);
  $('#wd').textContent = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' }).format(new Date(date + 'T12:00:00'));
  $('#jd').textContent = fmt(date, { day: 'numeric', month: 'long', year: 'numeric' }) + (date === today() ? ' — امروز' : '') + (data.day.mood ? ' ' + MOODS[data.day.mood - 1] : '');
  ['p1', 'p2', 'p3'].forEach(k => $('#' + k).value = data.day[k]);
  $('#nt').value = data.day.notes;
  const n = cycleNote(date); $('#cn').hidden = !n; $('#cn').textContent = n || '';
  renderTasks(); renderWater(); renderMood();
}
function renderTasks() {
  const all = data.tasks, done = all.filter(x => x.done).length, pc = all.length ? Math.round(done / all.length * 100) : 0;
  $('#pc').textContent = fa(pc) + '٪'; $('#pf').style.width = pc + '%';
  $('#pt').textContent = all.length ? ` ${fa(done)} از ${fa(all.length)} کار انجام شد` : '';
  const used = Object.keys(CATS).filter(k => all.some(x => x.category === k));
  if (filter && !used.includes(filter)) filter = '';
  $('#ch').hidden = !used.length;
  $('#ch').innerHTML = used.length ? [['', 'همه']].concat(used.map(k => [k, CATS[k][0] + ' ' + CATS[k][1]])).map(([k, l]) => `<button data-k="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('') : '';
  const t = filter ? all.filter(x => x.category === filter) : all;
  $('#tl').innerHTML = t.length ? t.map(x => `<li class="${x.done ? 'done' : ''}" data-id="${x.id}">
    <input type="checkbox" ${x.done ? 'checked' : ''} aria-label="انجام شد">
    <span class="t">${esc(x.title)}</span>${x.time ? `<span class="tm">${fa(x.time)}</span>` : ''}
    ${CATS[x.category] ? `<span class="cat" style="background:${CATS[x.category][2]}">${CATS[x.category][1]}</span>` : ''}
    <span class="dot p${x.priority}" title="اهمیت"></span><button class="del" aria-label="حذف">×</button></li>`).join('')
    : '<li class="empty">هیچ کاری نداری؟ مشکوکه 🤨 یه چیزی اضافه کن.</li>';
}
function renderWater() { $('#wt').innerHTML = [...Array(8)].map((_, i) => `<button data-n="${i + 1}" class="${i < data.day.water ? 'on' : ''}" aria-label="لیوان ${fa(i + 1)}">💧</button>`).join(''); }
function renderMood() { $('#md').innerHTML = ['😞', '😕', '😐', '🙂', '😄'].map((e, i) => `<button data-n="${i + 1}" class="${data.day.mood === i + 1 ? 'on' : ''}">${e}</button>`).join(''); }
function saveDay() {
  clearTimeout(timer); $('#sv').textContent = 'در حال ذخیره…';
  timer = setTimeout(async () => {
    ['p1', 'p2', 'p3'].forEach(k => data.day[k] = $('#' + k).value); data.day.notes = $('#nt').value;
    try { await api('day', 'PUT', { date, day: data.day }); $('#sv').textContent = 'ذخیره شد'; } catch { $('#sv').textContent = 'ذخیره نشد؛ اتصال را بررسی کنید'; }
  }, 600);
}
const move = n => { date = addDays(date, n); load(); };

/* ---------- هفته ---------- */
const lw = () => loadWeek().catch(e => { $('#wsum').textContent = 'خطا در بارگذاری هفته: ' + (e.error || e.message || 'نامشخص'); });
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const PAL = ['#f6a8c4', '#a9d4f0', '#f8dc82', '#a8dca9', '#cbb4ee', '#f9b98a', '#8fd8d0'], DARK = ['#e0508a', '#3b8fd0', '#d9a400', '#3e9e45', '#8052d0', '#e8742a', '#2aa59a'];
const ring = (p, c, sz = 60) => { const L = 2 * Math.PI * 26; return `<svg viewBox="0 0 64 64" width="${sz}" height="${sz}"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="8"/><circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${L * p / 100} ${L}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${fa(p)}٪</text></svg>`; };
async function loadWeek() {
  const wr0 = await api('week?start=' + wk); wtasks = wr0.tasks || []; const wm = Object.fromEntries((wr0.moods || []).map(m => [m.date, m.mood]));
  const days = [...Array(7)].map((_, i) => addDays(wk, i));
  const wdn = (d, o) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', o).format(new Date(d + 'T12:00:00'));
  const st = days.map(d => { const t = wtasks.filter(x => x.date === d), dn = t.filter(x => x.done).length; return { d, t, pc: t.length ? Math.round(dn / t.length * 100) : 0 }; });
  const all = wtasks.length, done = wtasks.filter(x => x.done).length, tp = all ? Math.round(done / all * 100) : 0;
  $('#wd').textContent = 'داشبورد هفته';
  $('#jd').textContent = $('#wr').textContent = fmt(days[0], { day: 'numeric', month: 'long' }) + ' تا ' + fmt(days[6], { day: 'numeric', month: 'long' });
  $('#wsum').textContent = all ? `${fa(done)} از ${fa(all)} کار انجام شد` + (tp === 100 ? ' — افسانه‌ای! 🏆' : tp < 30 ? ' — هنوز وقت داری... یا نه 😅' : '') : 'این هفته هیچ کاری ثبت نشده. تنبلی یا نبوغ؟ 🤔';
  $('#wdonut').innerHTML = ring(tp, '#2f7d4f', 92);
  $('#wc').innerHTML = st.map((s, i) => `<button class="b ${s.d === today() ? 'now' : ''}" data-d="${s.d}"><span class="v">${fa(s.pc)}٪</span><span class="col"><i style="height:${s.t.length ? Math.max(s.pc, 4) : 0}%;background:${PAL[i]}"></i></span><span class="l">${wdn(s.d, { weekday: 'short' })}</span></button>`).join('');
  $('#wrings').innerHTML = st.map((s, i) => `<button class="rg ${s.d === today() ? 'now' : ''} ${wm[s.d] >= 1 && wm[s.d] <= 2 ? 'bad' : ''}" data-d="${s.d}" style="background:${PAL[i]}66">${ring(s.pc, DARK[i])}<b>${wdn(s.d, { weekday: 'short' })}</b><span>${wdn(s.d, { day: 'numeric', month: 'short' })}</span><span>${wm[s.d] ? MOODS[wm[s.d] - 1] : '·'}</span></button>`).join('');
  const logged = st.filter(s => wm[s.d]), bad = st.filter(s => wm[s.d] >= 1 && wm[s.d] <= 2), rest = st.filter(s => wm[s.d] > 2 && s.t.length);
  const avgP = a => a.length ? Math.round(a.reduce((x, s) => x + s.pc, 0) / a.length) : 0;
  const join = a => a.length > 1 ? a.slice(0, -1).join('، ') + ' و ' + a[a.length - 1] : a[0];
  let ins = '';
  if (!logged.length) ins = 'هنوز حالت رو ثبت نکردی. از تب «امروز» حال و هوات رو انتخاب کن.';
  else {
    ins = bad.length ? `😞 روزهای بد: ${join(bad.map(s => wdn(s.d, { weekday: 'long' })))}` : '🎉 این هفته هیچ روز بدی نداشتی';
    ins += ` — میانگین حال هفته: ${MOODS[Math.round(logged.reduce((x, s) => x + wm[s.d], 0) / logged.length) - 1]}`;
    const badT = bad.filter(s => s.t.length);
    if (badT.length && rest.length) ins += `. روزهای بد ${fa(avgP(badT))}٪ کار کردی، روزهای دیگه ${fa(avgP(rest))}٪` + (avgP(badT) < avgP(rest) ? ' (حال بد، بهره‌وری بد 🫠)' : ' (حتی تو روز بد هم کار کردی، افسانه‌ای 💪)');
  }
  $('#wmood').innerHTML = `<h2>حال و هوای هفته</h2><div class="ms">${st.map(s => `<div><span>${wm[s.d] ? MOODS[wm[s.d] - 1] : '·'}</span>${wdn(s.d, { weekday: 'short' })}</div>`).join('')}</div><p class="muted">${ins}</p>`;
  const rows = Object.entries(CATS).concat([['', ['📌', 'بدون دسته', '#6b7788']]]).map(([k, v]) => {
    const t = wtasks.filter(x => (x.category || '') === k); if (!t.length) return '';
    const p = Math.round(t.filter(x => x.done).length / t.length * 100);
    return `<div class="cr"><span>${v[0]} ${v[1]}</span><div class="bar"><i style="width:${p}%;background:${v[2]}"></i></div><span>${fa(p)}٪</span></div>`;
  }).join('');
  $('#wcat').innerHTML = rows || '<p class="empty">هنوز داده‌ای نیست.</p>';
  $('#wdays').innerHTML = st.map((s, i) => `<section class="wday ${s.d === today() ? 'now' : ''} ${wm[s.d] >= 1 && wm[s.d] <= 2 ? 'bad' : ''}" style="border-top:6px solid ${PAL[i]}"><button data-d="${s.d}"><span>${wdn(s.d, { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="muted">${wm[s.d] ? MOODS[wm[s.d] - 1] + ' ' : ''}${fa(s.pc)}٪</span></button>
    <ul>${s.t.map(x => `<li class="${x.done ? 'done' : ''}">${x.done ? '✅' : '⬜'} ${esc(x.title)}${x.time ? ' · ' + fa(x.time) : ''}</li>`).join('') || '<li class="muted">بدون کار (مشکوک 🤨)</li>'}</ul></section>`).join('');
}

/* ---------- قاعدگی ---------- */
function cycleStats() {
  const p = [...periods].sort((a, b) => a.start_date < b.start_date ? -1 : 1);
  const gaps = p.slice(1).map((x, i) => diff(p[i].start_date, x.start_date)).filter(g => g >= 15 && g <= 60).slice(-6);
  const cyc = gaps.length ? Math.round(gaps.reduce((a, b) => a + b) / gaps.length) : 28;
  const lens = p.filter(x => x.end_date).map(x => diff(x.start_date, x.end_date) + 1).filter(l => l > 0 && l < 15).slice(-6);
  const len = lens.length ? Math.round(lens.reduce((a, b) => a + b) / lens.length) : 5;
  return { cyc, len, last: p[p.length - 1] };
}
function phase(d) {
  const { cyc, len, last } = cycleStats(); if (!last) return null;
  const day = diff(last.start_date, d) + 1; if (day < 1) return null;
  const next = addDays(last.start_date, cyc), ovul = addDays(next, -14);
  const inPeriod = last.end_date ? d <= last.end_date : day <= len;
  return { day, cyc, len, next, until: diff(d, next), inPeriod, fertile: d >= addDays(ovul, -5) && d <= addDays(ovul, 1), ovul, last };
}
function cycleNote(d) {
  const f = phase(d); if (!f) return '';
  if (f.inPeriod) return `🌸 روز ${fa(f.day)} قاعدگی`;
  if (d !== today()) return '';
  if (f.until >= 0 && f.until <= 3) return `🌸 قاعدگی بعدی حدود ${fa(f.until)} روز دیگر`;
  return f.fertile ? '🌱 بازه باروری احتمالی' : '';
}
function renderCycle() {
  const f = phase(today());
  if (!f) { $('#cs').innerHTML = '<h2>هنوز دوره‌ای ثبت نشده</h2><p class="muted">اولین دوره را پایین ثبت کنید تا پیش‌بینی شروع شود.</p>'; }
  else {
    const status = f.inPeriod ? `روز ${fa(f.day)} قاعدگی` : f.until >= 0 ? `${fa(f.until)} روز تا قاعدگی بعدی` : `${fa(-f.until)} روز تأخیر نسبت به پیش‌بینی`;
    const fs = addDays(f.ovul, -5), fe = addDays(f.ovul, 1), d = s => fmt(s, { day: 'numeric', month: 'long' });
    $('#cs').innerHTML = `<p class="big">${status}</p><div class="bar"><i style="width:${Math.min(100, Math.round(f.day / f.cyc * 100))}%;background:#e8789a"></i></div>
    <div class="cs-row"><span>قاعدگی بعدی (تقریبی)</span><b>${d(f.next)}</b></div>
    <div class="cs-row"><span>بازه باروری احتمالی</span><b>${d(fs)} تا ${d(fe)}</b></div>
    <div class="cs-row"><span>میانگین طول دوره</span><b>${fa(f.cyc)} روز</b></div>
    <div class="cs-row"><span>میانگین مدت قاعدگی</span><b>${fa(f.len)} روز</b></div>`;
  }
  $('#ps').value = $('#ps').value || today();
  $('#pl').innerHTML = periods.length ? periods.map(p => `<li data-id="${p.id}"><span>${fmt(p.start_date, { day: 'numeric', month: 'long' })}${p.end_date ? ' تا ' + fmt(p.end_date, { day: 'numeric', month: 'long' }) : ' — ادامه دارد'}</span>
    <span>${p.end_date ? '' : '<button class="pill" data-a="end">امروز تمام شد</button>'}<button class="del" data-a="del" aria-label="حذف">×</button></span></li>`).join('')
    : '<li class="empty">سابقه‌ای ثبت نشده.</li>';
}
async function reloadPeriods() { periods = (await api('periods')).periods; renderCycle(); }

/* ---------- رویدادها ---------- */
$('#pv').onclick = () => move(-1); $('#nx').onclick = () => move(1);
$('#td').onclick = () => { date = today(); load(); };
$('#wp').onclick = () => { wk = addDays(wk, -7); lw(); };
$('#wn').onclick = () => { wk = addDays(wk, 7); lw(); };
$('#wnow').onclick = () => { wk = weekStart(today()); lw(); };
$('#vWeek').onclick = e => { const b = e.target.closest('[data-d]'); if (b) { date = b.dataset.d; setView('day'); } };
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setView(b.dataset.v));
['p1', 'p2', 'p3', 'nt'].forEach(k => $('#' + k).oninput = saveDay);
$('#wt').onclick = e => { const n = +e.target.dataset?.n; if (!n) return; data.day.water = data.day.water === n ? n - 1 : n; renderWater(); saveDay(); };
$('#md').onclick = e => { const n = +e.target.dataset?.n; if (!n) return; data.day.mood = data.day.mood === n ? 0 : n; renderMood(); saveDay();
  $('#jd').textContent = $('#jd').textContent.replace(/ [😞😕😐🙂😄]$/u, '') + (data.day.mood ? ' ' + MOODS[data.day.mood - 1] : '');
  if (data.day.mood) toast(['روز سخت؟ اول کارای سبک‌تر رو بزن، بقیه بمونه برای فردا 🫂', 'کم‌کم درست میشه، یه چای بخور ☕', 'روز معمولی؛ بهترین حالت برای عقب‌افتادن از برنامه 😅', 'حالت خوبه! از فرصت استفاده کن 💪', 'وای چه روزی! برو کارای سخت رو بزن 🔥'][data.day.mood - 1]); };
$('#ch').onclick = e => { if (e.target.dataset.k === undefined) return; filter = e.target.dataset.k; renderTasks(); };
$('#tf').onsubmit = async e => {
  e.preventDefault();
  await api('tasks', 'POST', { date, title: $('#tt').value, time: $('#tm').value, priority: +$('#tp').value, category: $('#tc').value });
  $('#tt').value = ''; $('#tm').value = ''; await load();
};
$('#tl').onclick = async e => {
  const li = e.target.closest('li[data-id]'); if (!li) return; const id = li.dataset.id;
  if (e.target.type === 'checkbox') {
    const t = data.tasks.find(x => x.id == id); t.done = e.target.checked ? 1 : 0; renderTasks(); if (t.done) quip();
    await api('tasks/' + id, 'PATCH', { done: !!t.done }); load();
  } else if (e.target.classList.contains('del')) { await api('tasks/' + id, 'DELETE'); load(); }
};
$('#cr').onclick = async () => { const r = await api('carry', 'POST', { date }); await load(); $('#sv').textContent = r.moved ? `${fa(r.moved)} کار منتقل شد` : 'کار نیمه‌تمامی از روزهای قبل نمانده'; };
$('#pa').onclick = async () => {
  $('#pr2').textContent = '';
  try { await api('periods', 'POST', { start: $('#ps').value, end: $('#pe').value }); $('#pe').value = ''; await reloadPeriods(); }
  catch (e) { $('#pr2').textContent = e.error || 'ثبت نشد'; }
};
$('#pl').onclick = async e => {
  const li = e.target.closest('li[data-id]'), a = e.target.dataset.a; if (!li || !a) return;
  if (a === 'del') await api('periods/' + li.dataset.id, 'DELETE'); else await api('periods/' + li.dataset.id, 'PATCH', { end: today() });
  reloadPeriods();
};

function openAccount(name, forced) {
  $('#an').hidden = !forced; $('#au').value = name || ''; $('#ac').value = ''; $('#ap').value = ''; $('#ae').textContent = '';
  $('#dlg').showModal();
}
$('#sb').onclick = async () => openAccount((await api('me')).username, false);
$('#ax').onclick = () => $('#dlg').close();
$('#lo').onclick = async () => { await api('logout', 'POST'); $('#dlg').close(); showLogin(); };
$('#as').onclick = async () => {
  try { await api('account', 'POST', { current: $('#ac').value, username: $('#au').value, password: $('#ap').value }); $('#dlg').close(); $('#sv').textContent = 'اطلاعات حساب ذخیره شد'; }
  catch (e) { $('#ae').textContent = e.error || 'ذخیره نشد'; }
};
start();
