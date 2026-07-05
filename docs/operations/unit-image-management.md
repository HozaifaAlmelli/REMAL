# إدارة صور الوحدات — Unit Image Management

هذا الدليل يشرح طريقة إدارة صور الوحدات من بوابة الإدارة:
`Admin -> Units -> Unit details -> Images`.

## الإضافة برابط مباشر

1. ارفع الصورة على أي استضافة عامة أو CDN.
2. انسخ direct image URL للصورة نفسها، مثل:
   `https://cdn.example.com/units/unit-photo.webp`.
3. افتح تبويب **Images** للوحدة.
4. اختر **رابط مباشر**.
5. الصق الرابط في **رابط الصورة المباشر**.
6. اختر **اجعلها صورة الغلاف** إذا كانت الصورة الرئيسية.
7. اضغط **إضافة الصورة**.

النظام يخزن الرابط كـ image reference فقط. لا يتم نسخ الملف إلى الـ VPS في هذا المسار.

## الرفع من الجهاز

1. افتح تبويب **Images** للوحدة.
2. اختر **رفع من الجهاز**.
3. اختر الصورة أو اسحبها داخل منطقة الرفع.
4. الأنواع المسموحة: JPG, PNG, WebP, AVIF.
5. الحد الأقصى: 5MB.
6. اختر **اجعلها صورة الغلاف** إذا كانت الصورة الرئيسية.
7. اضغط **رفع وإضافة الصورة**.

بعد نجاح الرفع:

- الـ API يحفظ الملف داخل container على `/app/uploads/units/...`.
- في الإنتاج، هذا المسار bind-mounted من الـ VPS host:
  `/opt/kaza/uploads`.
- الـ DB يخزن relative `fileKey` فقط، مثل:
  `units/<unitId>/20260705/<guid>.webp`.
- الرابط العام يكون:
  `https://api.kaza-booking.com/uploads/units/...`.

## الممنوعات

- لا تستخدم `docker cp` كطريقة production لإضافة الصور. مسموح فقط كتشخيص أو طوارئ
  يدوية مؤقتة، وليس workflow تشغيل.
- لا تخزن صور production داخل container فقط؛ أي ملف داخل container بدون bind mount
  يضيع مع rebuild/recreate.
- لا ترفع صور ضخمة غير مضغوطة.
- لا تستخدم SVG لصور الوحدات؛ الرفع يقبل صيغ raster فقط.
- لا تخزن filesystem paths أو base64 داخل قاعدة البيانات.

## أفضل الممارسات

- WebP هو الخيار الأفضل غالبًا للحجم والجودة.
- استهدف أقل من 300KB للصورة عندما يكون ذلك ممكنًا.
- استخدم أبعاد مناسبة للويب بدل صور كاميرا خام كبيرة.
- حافظ على صورة cover واحدة واضحة.
- رتّب الصور بعناية؛ أول صورة تؤثر على الانطباع الأول في storefront.

## التشغيل والنسخ الاحتياطي

- VPS host path: `/opt/kaza/uploads`.
- API container path: `/app/uploads`.
- public API path: `/uploads/**`.
- النسخ الاحتياطي إلزامي: يجب أن يدخل `/opt/kaza/uploads` في خطة backup.
- يجب أخذ backup للـ DB والـ uploads معًا. الـ DB references تصبح بلا قيمة إذا ضاعت
  الملفات من `/opt/kaza/uploads`.
- ممنوع حذف مجلد uploads في أي cleanup.
- متابعة مساحة الديسك الخاصة بـ `/opt/kaza/uploads` متابعة تشغيلية مهمة، لكنها
  follow-up منفصل عن ميزة الرفع نفسها.

## ملاحظات deploy

- لا توجد DB migration لهذه الميزة.
- لا تعدّل `.env.production` لهذه الميزة؛ defaults تغطي مسار الرفع.
- في shared VPS، لا تشغل Kaza `nginx`/`certbot`.
- عند النشر بعد الدمج، أعد بناء `api` و`portal` فقط. لا حاجة لإعادة بناء `demo`.
- إذا كان `novatova-nginx` لا يحتوي `client_max_body_size 6m;` لبلوك
  `api.kaza-booking.com`، فالصور الأكبر من 1MB قد تفشل بـ 413 قبل الوصول للـ API.
  أي تعديل حيّ في `novatova-nginx` يحتاج موافقة صريحة، backup للملف، ثم `nginx -t`
  قبل reload.
