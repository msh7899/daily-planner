# برنامه‌ریز روزانه (Cloudflare Workers + D1)

## ساختار
```
public/index.html + home.js   صفحه ورود و پرنک اولین ورود
public/planner.html + planner.js + planner.css   خود پلنر (داشبورد پاستلی)
src/worker.js    ورودی Worker؛ مسیرهای /api را به api.js می‌دهد و بقیه را از public سرو می‌کند
src/api.js       منطق API (ورود، کارها، هفته، قاعدگی)
schema.sql       ساختار دیتابیس D1
wrangler.toml    تنظیمات Cloudflare
```

## راه‌اندازی
1. **دیتابیس:** Cloudflare → Storage & Databases → D1 → Create با نام `planner-db`.
   `database_id` را کپی کنید و در `wrangler.toml` به‌جای `PUT-YOUR-D1-DATABASE-ID-HERE` بگذارید.
2. **ساخت جدول‌ها:** در همان صفحه D1 → تب Console → محتوای `schema.sql` را اجرا کنید.
   (اگر نسخه اول را قبلاً اجرا کرده‌اید، به‌جای آن `migration-2.sql` را اجرا کنید.)
3. تغییرات را در گیت‌هاب commit/push کنید. Workers Builds خودکار با دستور `npx wrangler deploy` دیپلوی می‌کند.
   - Build command: خالی
   - Deploy command: `npx wrangler deploy`
4. سایت روی آدرس `*.workers.dev` بالا می‌آید. ورود پیش‌فرض: **Admin / Admin** (فوراً عوضش کنید).

## اجرای لوکال
```
npx wrangler d1 execute planner-db --local --file=schema.sql
npx wrangler dev
```
سپس آدرسی که wrangler نشان می‌دهد (معمولاً `http://localhost:8787`) را باز کنید.

## فراموشی رمز
در کنسول D1 دستور `DELETE FROM users;` را اجرا کنید؛ ورود بعدی دوباره Admin/Admin می‌سازد.

## به‌روزرسانی‌ها
- دیتابیس قدیمی: `migration-3.sql` را یک بار اجرا کنید (سرنخ حرف اول و آخر رمز).
- سرنخ فقط حرف اول و آخر رمز را نگه می‌دارد؛ خود رمز همچنان هش می‌شود و قابل بازیابی نیست.
