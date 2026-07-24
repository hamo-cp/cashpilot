# CashPilot — مدير الميزانية الشخصية

PWA متكامل لإدارة الشؤون المالية الشخصية: دخل، مصروفات، ديون، استثمارات.

## التشغيل المحلي

```bash
# أي HTTP server — لا يعمل مع file://
npx serve .
# أو
python3 -m http.server 8080
```

ثم افتح: `http://localhost:8080`

## النشر

يعمل مباشرة على:
- **GitHub Pages** — ادفع للـ `main` branch وفعّل Pages من الإعدادات
- **Cloudflare Pages** — connect repo، build command فارغ، publish directory: `/`

## الهيكل

```
/
├── index.html
├── style.css
├── manifest.json
├── service-worker.js
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-192-maskable.png
│   └── icon-512-maskable.png
└── src/
    ├── main.js          ← نقطة الدخل
    ├── core/            ← constants, state, utils
    ├── storage/         ← LocalStorage adapter
    ├── services/        ← business logic, demo, backup, print
    ├── ui/              ← toast, modal, nav, components
    ├── charts/          ← Chart.js wrappers
    └── pages/           ← dashboard, income, expenses, debts, investments, budget, analytics, transactions
```

## ملاحظات

- البيانات تُحفظ في `localStorage` المحلي فقط
- يعمل بالكامل بدون إنترنت بعد أول تحميل
- لا يحتاج خادم أو قاعدة بيانات
