-- فقط اگر قبلاً schema.sql نسخه اول را اجرا کرده‌اید، این فایل را یک بار اجرا کنید
ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS periods(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,start_date TEXT NOT NULL,end_date TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS i_periods ON periods(user_id,start_date);
