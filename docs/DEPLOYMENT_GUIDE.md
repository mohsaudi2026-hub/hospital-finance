# دليل النشر والترحيل للسيرفرات المحلية داخل مصر (Deployment & On-Premises Guide)
## منصة تجميع البيانات المالية — وزارة الصحة والسكان المصرية

---

## 1. استراتيجية الاستضافة والنشر (Deployment Strategy)
تم بناء المنصة وفق معايير الحوسبة السحابية والمحلية المتطابقة (Cloud & Self-Hosted Parity):
- **المرحلة الحالية (التجريبية):** تعمل المنصة على Supabase Cloud للتطوير والاختبار الميداني السريع.
- **المرحلة الإنتاجية (النهائية):** الانتقال الكامل إلى مركز بيانات وزارة الصحة والسكان (أو السيرفرات الحكومية داخل جمهورية مصر العربية) دون أي تعديل في كود الفرونت إند أو بنية البيانات.

---

## 2. بناء التطبيق الإنتاجي (Production Build)

### 2.1 التثبيت والبناء
على السيرفر المستضيف، تأكد من تثبيت **Node.js (v20+ LTS)** ثم نفذ:

```bash
# تثبيت الاعتماديات
npm ci

# بناء النسخة الإنتاجية المحسنة
npm run build

# تشغيل خادم الإنتاج
npm start
```

### 2.2 تشغيل التطبيق كخدمة دائمة (PM2 Process Manager)
يوصى بتشغيل تطبيق Next.js بواسطة `pm2` لضمان إعادة التشغيل التلقائي عند انقطاع الكهرباء أو إعادة إقلاع السيرفر:

```bash
# تثبيت PM2 عالمياً
npm install -g pm2

# تشغيل التطبيق في الخلفية
pm2 start npm --name "hospital-finance" -- start

# حفظ الخدمة لتعمل مع إقلاع النظام
pm2 save
pm2 startup
```

---

## 3. إعداد واستضافة قاعدة البيانات محلياً (Self-Hosted Supabase / Docker)

### 3.1 المتطلبات على سيرفر الوزارة
- نظام تشغيل **Ubuntu Linux 22.04 LTS** أو **24.04 LTS**.
- **Docker Engine (v24+)** و **Docker Compose (v2+)**.

### 3.2 تثبيت وتشغيل Supabase عبر Docker
```bash
# استنساخ مستودع Supabase الرسمي
git clone --depth 1 https://github.com/supabase/supabase

# الانتقال لمجلد Docker
cd supabase/docker

# نسخ ملف البيئة
cp .env.example .env

# توليد كلمات مرور ومفاتيح JWT جديدة وتحديثها في .env
# ثم تشغيل الحاويات
docker compose up -d
```

---

## 4. خطة ترحيل البيانات والـ Migrations (Data Migration Steps)

### 4.1 تصدير البيانات من النسخة التجريبية
لتصدير كافة الجداول والمستخدمين والبيانات المسجلة:

```bash
# تصدير المخطط والبيانات من السحابة
pg_dump -h db.your-supabase.co -U postgres -d postgres -F c -b -v -f hospital_finance_backup.dump
```

### 4.2 استيراد البيانات إلى السيرفر المحلي في مصر
```bash
# استعادة البيانات على قاعدة بيانات السيرفر المحلي
pg_restore -h localhost -p 5432 -U postgres -d postgres -v hospital_finance_backup.dump
```

### 4.3 تنفيذ ملفات الـ SQL Migrations بترتيبها
في حال تثبيت قاعدة بيانات جديدة من الصفر، يتم تشغيل الملفات من المجلد `supabase/migrations/` بالترتيب العددي:
- `001_phase1_auth_rbac.sql`
- `002_phase2_revenue_deductions.sql`
- `003_phase3_expenses.sql`
- ... حتى `022_secure_views.sql`.

---

## 5. إعداد خادم الويب العكسي (Nginx Reverse Proxy & SSL)

نموذج لملف تكوين Nginx لتأمين التطبيق برابط آمن `https`:

```nginx
server {
    listen 80;
    server_name finance.mohp.gov.eg;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name finance.mohp.gov.eg;

    ssl_certificate /etc/ssl/certs/mohp_finance.crt;
    ssl_certificate_key /etc/ssl/private/mohp_finance.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. خطة النسخ الاحتياطي التلقائي (Automated Daily Backups)
يتم إعداد مهمة Cron يومية على السيرفر لتوليد نسخة احتياطية يومية في تمام الساعة 02:00 صباحاً وحفظها في مجلد معزول:

```bash
# إضافة الأمر في crontab
0 2 * * * pg_dump -U postgres -d postgres | gzip > /backups/hospital_finance_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```
