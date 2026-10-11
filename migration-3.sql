-- فقط اگر دیتابیس را قبلاً ساخته‌اید، یک بار اجرا کنید (سرنخ رمز + حال و هوا)
ALTER TABLE users ADD COLUMN hint_first TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN hint_last TEXT DEFAULT '';
