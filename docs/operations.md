# تشغيل CashPilot وإغلاق الإصدار

هذا السجل يوضح إعدادات التشغيل التي لا توجد في كود التطبيق، وكيفية التحقق منها. الإصدار المعلن في `package.json` هو `1.0.0`.

## المصدر والنشر

- المستودع: [hamo-cp/cashpilot](https://github.com/hamo-cp/cashpilot).
- مشروع Cloudflare Pages: `cashpilot`.
- Production: <https://cashpilot-72m.pages.dev/>؛ الدفع إلى `master` يشغّل النشر التلقائي.
- لا يوجد build command أو Pages Functions في الإصدار الحالي؛ يُنشر جذر المستودع.
- النسخ التجريبية محمية بـCloudflare Access. نجاح النشر لا يغني عن فحص التطبيق بعد تسجيل الدخول.
- مصدر التطبيق هو `index.html` و`style.css` واعتماديات `src/main.js`، مع `manifest.json` و`service-worker.js` والأيقونات والمكتبة المحلية في `vendor/`.

## قاعدة الأرشيف المتقاعد في Cloudflare

أُزيل `files/cashpilot.zip` من Git، لكن فحص Production في 2026-09-05 وجد نسخة تاريخية في CDN cache. أُضيف تحويل للرابط التالي وتم التحقق من الاستجابة الفعلية. هذه معالجة للتوجيه، وليست عملية حذف أو تفريغ للكاش.

| الإعداد | القيمة |
| --- | --- |
| النوع | Account-level Bulk Redirect |
| اسم القاعدة | `CashPilot retired archive` |
| Rule ID | `fe41164ee75c4e45bd82b5941daf0317` |
| اسم القائمة | `cashpilot_retired_archive` |
| List ID | `5590216851bd4e94bb1529250480b465` |
| عدد الروابط | رابط واحد |
| المصدر | `https://cashpilot-72m.pages.dev/files/cashpilot.zip` |
| الوجهة | `https://cashpilot-72m.pages.dev/` |
| HTTP status | `302` |
| Include subdomains | معطّل |
| Subpath matching | معطّل |
| Preserve path suffix | معطّل |
| Preserve query string | معطّل |
| الحالة المطلوبة | Enabled / Active |

تُدار القاعدة في Cloudflare Dashboard → Delivery & performance → Bulk Redirects. هذا الملف توثيق للإعداد؛ لا ينشئ القاعدة تلقائيًا. إعدادات Git وحدها لا تكفي لإعادة بناء سلوك الرابط المتقاعد. توثّق Cloudflare [Bulk Redirects مع Pages](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/) و[الاحتفاظ بالأصول في الكاش](https://developers.cloudflare.com/pages/configuration/serving-pages/).

أبقِ القاعدة مفعّلة. رمز `302` مؤقت من منظور HTTP، لكنه لا يضع تاريخ انتهاء للقاعدة. لا تُزلها اعتمادًا على مرور الوقت وحده؛ راجع أثر الإزالة وتحقق من عدم عودة الأرشيف أولًا. تعطيل هذه القاعدة قد يعيد كشف محتوى قديم من الكاش.

## التحقق بعد النشر

ابدأ بتحديد SHA المنشور من Cloudflare ومطابقته مع `master` ونتائج CI. افحص الاستجابة الأصلية دون اتباع التحويل تلقائيًا:

```powershell
curl.exe -sS --max-time 20 -D - -o NUL https://cashpilot-72m.pages.dev/files/cashpilot.zip
curl.exe -sS --max-time 20 -D - -o NUL "https://cashpilot-72m.pages.dev/files/cashpilot.zip?release-check=1"
curl.exe -sS --max-time 20 -D - -o NUL https://cashpilot-72m.pages.dev/
curl.exe -sS --max-time 20 -D - -o NUL -X POST -H "Content-Type: application/json" --data '{}' https://cashpilot-72m.pages.dev/api/gemini
```

النتائج المطلوبة:

- طلبا الأرشيف يعيدان `302` مع `Location: https://cashpilot-72m.pages.dev/`؛ لا تُقبل استجابة ZIP تبدأ بتوقيع `PK`.
- الرئيسية تعيد `200` وتعرض التطبيق؛ صفحة تسجيل دخول أو fallback لا تُعدّ دليلًا على صحة الملف المطلوب.
- `POST /api/gemini` يعيد `405`؛ الكود الحالي لا يستدعي نموذجًا من هذا المسار.
- `manifest.json` وService Worker وChart.js والأيقونات الأربعة تطابق Git blobs الخاصة بـSHA المنشور. المقاسان الفعليان للأيقونات هما `192x192` و`512x512`.
- Cloudflare قد يضيف مقطع Pages Analytics إلى HTML. سجّل الفرق المحدد ولا تدّعِ تطابق HTML حرفيًا عند وجوده. في تحقق 2026-09-05 كان هذا هو الفرق الوحيد في الصفحة الرئيسية.

عند فشل أي تحقق، سجّل الرابط وSHA ورمز HTTP ورؤوس الكاش والبصمة قبل المعالجة. لا تستخدم رابطًا يحمل query string لإخفاء فشل الرابط الأصلي. لا تفترض أن مسح Build cache يفرغ CDN cache.

## إزالة Gemini والأسرار

- المصدر التنفيذي الحالي لا يتضمن تكامل Gemini أو Pages Function له. لا يحتاج الإصدار الحالي إلى مفتاح Gemini.
- في 2026-09-07 حُذف إعداد Production المتقاعد باسم `Gemini API Key` وحُفظ التغيير، ثم تحقق غيابه بعد إعادة تحميل اللوحة. أُعيد التحقق أيضًا من خلو Preview من المتغيرات. لم تُعرض قيمة السر أو تُنسخ أثناء المعالجة.
- أكد مالك المشروع في 2026-09-06 أن المفتاح أُبطل عند Google. هذا تأكيد من المالك، وليس اختبارًا مستقلًا لصلاحية المفتاح.
- حذف نسخة الإعداد من Cloudflare لا يُعدّ إبطالًا للمفتاح عند مزوده. لا تُدرج قيم مفاتيح أو ملفات `.env` أو cookies في المستودع أو أدلة الإصدار.

## أدلة الإصدار وحدودها

مرجع تغييرات CI والأيقونات: [PR #1](https://github.com/hamo-cp/cashpilot/pull/1)، المدمج عند `730288b68dab7ca55ce138e051d2250cd7cbc540`. شجرة هذا الدمج طابقت شجرة commit الاختبار `43f5aa5e62097ad505cbc8eb1d9731f6e2d87d81`.

- [CI على master](https://github.com/hamo-cp/cashpilot/actions/runs/33974517476): ثلاث مهام ناجحة؛ Node 24 على Ubuntu وWindows واختبار Chrome على Ubuntu.
- `npm test`: نجحت 60 حالة، إضافة إلى فحوص الحسابات والترجمة وإجراءات الواجهة.
- اختبار المتصفح يغطي العربية والإنجليزية والخصوصية والعمليات الأساسية والعمل دون اتصال والأيقونات ومقاسات 320 و390 بكسل. سجلات CI وصوره تُحفظ كـartifact لمدة سبعة أيام؛ روابط التشغيل ليست ضمانًا لبقاء الملفات بعد مدة الاحتفاظ.
- فحص Preview بعد تسجيل الدخول شمل الإقلاع واللغة بعد reload والتحليلات وفتح النموذج وإغلاقه والأيقونات وسجل Console. لم تُكرر اختبارات offline أو المقاسات الدقيقة عليه؛ محاولة ضبط مقاس المتصفح المضمن لم تحقق المقاس المطلوب.
- فحص Production أثبت الأصول المنشورة والإقلاع وتحديث الأيقونة بعد reload واستجابات المسارات المتقاعدة. لا يُقدّم ذلك ادعاءً بتغطية كل المتصفحات أو قارئات الشاشة أو جميع نقاط CDN.

للاختبارات التي تكتب بيانات، استخدم أصلًا محليًا وملف متصفح معزولين وبيانات صناعية. أمر `test:browser` يمسح تخزين أصل الاختبار؛ لا توجهه إلى ملف المتصفح الذي يحتوي بيانات مالية حقيقية.

## تثبيت Tag وRelease

اربط الـTag بـSHA محدد تم التحقق منه، ولا تنقل Tag منشورًا إلى commit آخر. تتضمن ملاحظات GitHub Release ملخص التغييرات، روابط CI، اعتماد تحويل الأرشيف على Cloudflare، وحالة إزالة إعداد Gemini وحدود التحقق. لا ترفق أرشيف `files/cashpilot.zip` المتقاعد؛ أرشيفات المصدر التي ينشئها GitHub للـTag تختلف عنه.
