const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(p, m = 'GET', b) {
  const r = await fetch('/api/' + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw d;
  return d;
}
const show = id => { ['#login', '#setup'].forEach(x => $(x).hidden = x !== id); };
const step = id => ['#stA', '#stB', '#stC'].forEach(x => $(x).hidden = x !== id);

const slogans = ['برای کسایی که فقط تظاهر می‌کنن برنامه دارن 😎'];
let si = 0; $('#slogan').textContent = slogans[0]; setInterval(() => $('#slogan').textContent = slogans[++si % slogans.length], 4000);

(async () => {
  try { const me = await api('me'); if (me.mustChange) { await api('logout', 'POST'); show('#login'); } else location.href = 'planner.html'; }
  catch { show('#login'); }
})();

/* ---------- ورود ---------- */
let loginPw = '';
async function login() {
  $('#le').textContent = '';
  try {
    const r = await api('login', 'POST', { username: $('#lu').value, password: $('#lp').value });
    loginPw = $('#lp').value;
    if (r.mustChange) { show('#setup'); step('#stA'); } else location.href = 'planner.html';
  } catch (e) {
    $('#mc').textContent = '🙈'; $('#lbox').classList.add('shake'); setTimeout(() => { $('#lbox').classList.remove('shake'); $('#mc').textContent = '🦥'; }, 600);
    $('#le').textContent = e.error || 'به سرور وصل نشد. سایت را از آدرس Cloudflare باز کن.';
  }
}
$('#lb').onclick = login;
$('#lp').onkeydown = e => { if (e.key === 'Enter') login(); };
$('#fg').onclick = async () => {
  $('#le').textContent = '🕵️ دارم تو پرونده‌ها می‌گردم…';
  try {
    const { hint } = await api('hint?username=' + encodeURIComponent($('#lu').value.trim()));
    $('#le').textContent = hint ? `🕵️ سرنخ: رمزت با «${hint.first}» شروع میشه و با «${hint.last}» تموم میشه` : 'سرنخی ذخیره نشده 🤷 (با رمز فعلی وارد شو؛ از همون لحظه سرنخ ذخیره میشه)';
  } catch (e) { $('#le').textContent = 'خطا: ' + (e.error || 'سرور جواب نداد 😵'); }
};

/* ---------- مرحله ۱: اسم ---------- */
let uname = '', faked = false;
const remark = v => !v ? '' : v.toLowerCase() === 'admin' ? 'Admin؟ خلاقیتت کجا رفت 😴' : v.length < 3 ? 'اینقدر کوتاه؟  🐭' : ['این مگه اسمه؟؟😏', 'این اسم یه چیزی داره، نمی‌دونم چی 🤨', 'اسم مافیایی! دوستش دارم 🕶️', 'وای، شبیه قهرمان انیمیشنه 🦸'][v.length % 4];
$('#nu').oninput = () => $('#nf').textContent = remark($('#nu').value.trim());
$('#nb').onclick = async () => {
  const v = $('#nu').value.trim(), b = $('#nb');
  if (v.length < 3) return $('#nf').textContent = 'حداقل ۳ حرف! حتی قورباغه هم اسمش ۳ حرفه 🐸';
  if (v.toLowerCase() === 'admin') return $('#nf').textContent = 'نه نه، «Admin» نمیشه. یه اسم با شخصیت بذار 😤';
  if (!faked) {
    faked = true; b.disabled = true;
    $('#nf').textContent = '⏳ در حال بررسی اسم در بایگانی اسم‌های ممنوعه…'; await sleep(1700);
    $('#nf').textContent = '😱 این اسم قبلاً توسط یک خرس قطبی در قطب شمال ثبت شده!'; await sleep(3200);
    $('#nf').textContent = 'شوخی کردم 😄 اسم آزاده. ادامه بده.'; await sleep(2000); b.disabled = false;
  }
  uname = v; step('#stB'); $('#sp').focus(); check();
};

/* ---------- مرحله ۲: بازی رمز ---------- */
const R = [
  [p => [...p].length >= 8, () => 'حداقل ۸ کاراکتر (آره، ۴ تا کافی نیست 😤)'],
  [p => /\d/.test(p), () => 'یه عدد انگلیسی داشته باشه 🔢'],
  [p => /[A-Z]/.test(p), () => 'یه حرف بزرگ انگلیسی (A تا Z) 🔠'],
  [p => p.includes('🐸'), () => 'قورباغه نگهبان رمزه: یه 🐸 توش بذار'],
  [p => /شنبه|جمعه/.test(p), () => 'اسم منم باید باشه طبیعتا'],
  [p => [...p].reduce((s, c) => s + (/\d/.test(c) ? +c : 0), 0) === 15, () => 'مجموع رقم‌های انگلیسی‌اش باید دقیقاً ۱۵ بشه 🧮'],
  [p => p.includes([...uname].reverse().join('')), () => `اسم کاربریت (${uname}) رو برعکس توش بنویس 🔁`],
];
const labels = ['رمز کوچولو 🐭', 'رمز جوجه‌ای 🐥', 'رمز گربه‌ای 🐱', 'رمز سگی 🐶', 'رمز گرگی 🐺', 'رمز شیری 🦁', 'رمز اژدها 🐉', 'رمز فولادی؛ خودت هم یادت نمیاد 🏰'];
let allOk = false;
function check() {
  const p = $('#sp').value, res = R.map(([f]) => f(p)), firstBad = res.indexOf(false), upto = firstBad < 0 ? R.length : firstBad + 1, n = res.filter(Boolean).length;
  allOk = firstBad < 0;
  $('#rl').innerHTML = R.slice(0, upto).map(([, t], i) => `<li class="${res[i] ? 'ok' : 'no'}">${res[i] ? '✅' : '❌'} ${t()}</li>`).join('');
  $('#mt').style.width = n / R.length * 100 + '%'; $('#ml').textContent = labels[n]; $('#pb').disabled = !allOk;
}
$('#sp').oninput = check;
$('#hb').onclick = () => {
  const rev = [...uname].reverse().join(''), base = `A${rev}🐸صادق`;
  let need = 15 - [...base].reduce((s, c) => s + (/\d/.test(c) ? +c : 0), 0), d = '';
  if (need < 0) { $('#se').textContent = 'اسمت رقم زیادی داره 😅 خودت دست به کار شو'; return; }
  while (need > 0) { const x = Math.min(9, need); d += x; need -= x; }
  $('#sp').value = base + d; check(); $('#se').textContent = 'بفرما، رمز آماده (بی‌شرف‌ترین راه 😂)';
};
$('#pb').onclick = async () => {
  $('#se').textContent = '';
  try { await api('account', 'POST', { current: loginPw, username: uname, password: $('#sp').value }); step('#stC'); setTimeout(() => location.href = 'planner.html', 4000); }
  catch (e) { $('#se').textContent = e.error || 'ثبت نشد'; if ((e.error || '').includes('نام کاربری')) { step('#stA'); $('#nf').textContent = e.error; } }
};
$('#go').onclick = () => location.href = 'planner.html';
