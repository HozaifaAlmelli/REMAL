# دليل تشغيل Kaza Booking في الإنتاج — Kaza Booking Production Workbook

> **هذا هو أول ملف تقرأه قبل أن تغيّر أي شيء في الإنتاج (Production).**
>
> هذا الدليل مكتوب للمالك/المشغّل (Operator) — الإنسان الذي يدير الموقع — وليس لوكلاء الذكاء
> الاصطناعي فقط. لغته عربية أولًا، مع الحفاظ على المصطلحات التقنية بالإنجليزية كما هي
> (`docker`, `nginx`, `deploy`, ...) لأن تغييرها يسبب أخطاء.

## ما هذا الدليل وما ليس هو

- **هو**: قائمة تحقق عملية (Operator checklist) خطوة بخطوة تشرح *ماذا تفعل*، *ومتى*،
  *ولماذا*، *وما الذي يجب ألا تفعله*، *وأي خدمة تلمس وأيها لا تلمس*، *وكيف تتأكد من النجاح*،
  *ومتى تتوقف وتطلب المساعدة*.
- **ليس** بديلًا عن مكتبة المهارات التقنية العميقة. عندما تحتاج التفاصيل الدقيقة لكل حالة،
  ارجع إلى [`docs/ai-deployment-skills/`](ai-deployment-skills/README.md). هذا الدليل هو
  *الدليل العملي المختصر*، والمهارات هي *الكتب المرجعية العميقة (deep playbooks)*.

الترتيب الصحيح للاستخدام:
1. اقرأ هذا الدليل أولًا لتعرف نوع المشكلة والخدمة المستهدفة.
2. افتح المهارة المناسبة من المكتبة للتفاصيل الدقيقة.
3. نفّذ بأصغر نطاق ممكن، ثم تحقّق، ثم اجعل الإصلاح دائمًا في `main`.

---

## القسم 1 — خريطة الإنتاج الحالية (Current Production Map)

Kaza Booking يعمل على **VPS إنتاج مشترك (shared live VPS)** مع مشروع آخر اسمه
**Novatova**. هذا أهم شيء يجب أن تتذكره: أمر واحد خاطئ قد يُسقط Novatova أو يمسح قاعدة
بيانات Kaza.

### الدومينات وماذا يجب أن تخدم كل واحدة

| الدومين | يجب أن يخدم | الحاوية (Container) |
|---|---|---|
| `https://kaza-booking.com` | الموقع العام / المتجر (storefront) | `kaza-prod-demo` |
| `https://www.kaza-booking.com` | الموقع العام / المتجر (storefront) | `kaza-prod-demo` |
| `https://app.kaza-booking.com` | البوابة / منصة الإيجار (portal / Rental Platform) | `kaza-prod-portal` |
| `https://api.kaza-booking.com` | الـ API (الخلفية / backend) | `kaza-prod-api` |
| `https://novatova.com` | مشروع آخر — **خارج نطاقك** (safety signal فقط) | `novatova-*` |

### الحاويات (Containers) ووظيفة كل واحدة

| الحاوية | الوظيفة |
|---|---|
| `kaza-prod-api` | الـ API / الخلفية (backend) |
| `kaza-prod-demo` | الموقع العام / المتجر (main site) |
| `kaza-prod-portal` | البوابة / منصة الإيجار على `app.kaza-booking.com` |
| `kaza-prod-db` | قاعدة بيانات PostgreSQL |
| `novatova-nginx` | البروكسي العكسي المشترك (shared reverse proxy) — يملك المنفذين **80/443** للجميع |
| `novatova-*` | خدمات مشروع Novatova — **لا تلمسها أبدًا** |

### المسارات والملفات الصحيحة

| العنصر | القيمة الصحيحة |
|---|---|
| مسار المستودع الحيّ (repo path) | `/opt/apps/kaza-booking` ✅ |
| المسار القديم/الخاطئ | `/opt/kaza/app` ❌ (قديم — لا تستخدمه أبدًا في أي أمر) |
| ملف البيئة (env file) | `/opt/kaza/env/.env.production` |
| مشروع Docker Compose | `kaza-prod` |
| ملف Compose | `/opt/apps/kaza-booking/docker-compose.prod.yml` |
| قاعدة البيانات | الحاوية `kaza-prod-db` (البيانات في Docker volume/mount) |

### ترتيب الـ nginx المشترك وحدود Novatova

- يوجد **بروكسي واحد فقط** يستقبل الترافيك من الإنترنت على 80/443: `novatova-nginx`.
- Kaza **لا يملك** ولا يشغّل بروكسي خاص به على 80/443 في هذا الخادوم.
- **حدّ Novatova (Novatova boundary)**: أي شيء اسمه `novatova-*` هو ملكية مشروع آخر.
  يُسمح لك فقط بأن *تفحص* `novatova-nginx` وتختبره بـ `nginx -t` وتعيد تحميله (`reload`)
  عند الحاجة — ولا يُسمح **أبدًا** بإعادة تشغيله (`restart`) أو تعديل بلوكات Novatova فيه.

> 💡 **لماذا هذا مهم:** لأن البروكسي مشترك، أي خطأ في إعداده لا يُسقط Kaza فقط بل يُسقط
> Novatova أيضًا. تفصيل كامل في
> [shared-vps-production-safety](ai-deployment-skills/shared-vps-production-safety.md)
> و[production-inventory-and-discovery](ai-deployment-skills/production-inventory-and-discovery.md).

---

## القسم 2 — القواعد الذهبية (Golden Rules)

هذه القواعد غير قابلة للتفاوض. احفظها.

> 🚫 **ممنوع دائمًا (Never):**
> - **لا** تشغّل `docker compose down` أبدًا.
> - **لا** تشغّل `docker compose up -d` بمفرده (bare) بدون تحديد خدمة. أعِد إنشاء خدمة
>   واحدة فقط: `... up -d --no-deps <service>`.
> - **لا** تُشغّل `nginx`/`certbot` الخاصة بـ Kaza على المنفذين 80/443 (هي داخل
>   `profiles: ["edge"]` ويجب أن تبقى مطفأة على هذا الخادوم المشترك).
> - **لا** تُعِد تشغيل (restart) أي حاوية من `novatova-*`.
> - **لا** تلمس قاعدة البيانات بدون نسخة احتياطية (backup) مُتحقَّق منها أولًا.
> - **لا** تترك إصلاحًا حيًّا (live hotfix) على الـ VPS فقط — سيُمسح في أول deploy.

> ✅ **افعل دائمًا (Always):**
> - **اترقِ** (promote) كل إصلاح مُتحقَّق منه إلى `main` عبر PR.
> - **شغّل** `nginx -t` **قبل** أي `nginx -s reload` (reload وليس restart).
> - **احذف** أي مفتاح SSH مؤقّت بعد الانتهاء وتحقّق أن الوصول أصبح مرفوضًا.
> - **أخفِ الأسرار (redact secrets)** في كل مخرجات ولا تطبع كلمات مرور/توكنات في الشات أو
>   سجلات GitHub أو الطرفية.

التفاصيل الكاملة لكل قاعدة موجودة في
[shared-vps-production-safety](ai-deployment-skills/shared-vps-production-safety.md).

---

## القسم 3 — ماذا يحدث عندما أدمج إلى main؟ (Merge to main)

> ⚠️ **الدمج إلى `main` ليس عملية توثيق — هو عملية نشر (deploy).**

ماذا يحدث بالضبط:
1. الدمج إلى `main` يُطلق (queue) سير عمل **Deploy Production** في GitHub Actions.
2. هذا الـ deploy يسحب `main` على الـ VPS ويعيد بناء خدمات التطبيق (api/demo/portal).
3. الـ deploy يعمل **force-checkout** لـ `main` — أي أنه **يمسح أي تعديل موجود على الـ VPS
   فقط** ولم يُدمج إلى `main`.
4. لا يوجد `paths:` filter — أي أن **حتى دمج توثيق (docs) فقط يُطلق الـ deploy** (لكنه
   محميّ ببوابة موافقة يدوية / manual approval gate).

> 💡 **لماذا مراجعة الـ PR مهمة:** لأن الدمج = نشر مباشر على موقع حيّ يشاركه مشروع آخر.
> راجع الـ diff بالكامل قبل الدمج، وتأكد أنه لا يشغّل خدمات الـ edge على 80/443.

**كيف تراقب GitHub Actions:**
- افتح تبويب **Actions** في مستودع `HozaifaAlmelli/REMAL`، وابحث عن تشغيل **Deploy Production**.
- الـ deploy يتوقف عند بوابة `environment: production` بانتظار موافقتك اليدوية.

> ⛔ **متى تُلغي (cancel) الـ deploy:**
> - إذا رأيت أنه سيبني خدمة لم تقصد تغييرها.
> - إذا لم تُراجَع التغييرات بعد.
> - إذا لم تكن نافذة النشر (deploy window) مناسبة الآن.

**ماذا تتحقق بعد الـ deploy:** نفّذ قائمة التحقق في [القسم 9](#القسم-9--قائمة-التحقق-القياسية-standard-verification-checklist).

التفاصيل الكاملة:
[github-actions-production-deploy-safety](ai-deployment-skills/github-actions-production-deploy-safety.md).

---

## القسم 4 — أي فرع (branch) أستخدم؟ (Branch Decision Guide)

اختر الفرع حسب نوع التغيير:

```
تغيير ميزة غير عاجل (feature/change not urgent)
   → افرع من dev أو feature branch → PR → main → deploy → تحقّق

إصلاح خطأ في الإنتاج (production bug)
   → افرع من main → إصلاح صغير → (اختياري) live hotfix للتجربة
     → PR إلى main → deploy → تحقّق

مشكلة حيّة طارئة (emergency live issue)
   → live hotfix فقط عند الضرورة القصوى → اختبر
     → أدخِل نفس الـ diff تمامًا إلى main → deploy → تحقّق

تغيير توثيق فقط (docs-only)
   → docs branch → PR → تحقّق هل سيُطلق الدمج deploy أم لا
     (تذكّر: لا يوجد paths filter، فالدمج يُطلق deploy مُبوَّبًا بموافقة يدوية)
```

> 💡 **القاعدة الجوهرية:** الإصلاح الحيّ (live hotfix) ليس خط النهاية أبدًا. أي شيء غير
> موجود في `main` سيُمسح في أول deploy. انظر
> [live-hotfix-to-main-durability](ai-deployment-skills/live-hotfix-to-main-durability.md).

عند التردد بين أكثر من مسار، استخدم
[deployment-decision-matrix](ai-deployment-skills/deployment-decision-matrix.md).

---

## القسم 5 — أي خدمة أُعيد بناءها؟ (Which Service to Rebuild)

حدّد الطبقة (layer) التي فيها المشكلة، ثم أعِد بناء *تلك الخدمة فقط*.

| نوع المشكلة | الخدمة / الحاوية | المهارة المرجعية |
|---|---|---|
| مشكلة في مسار API / الخلفية | `api` / `kaza-prod-api` | [api-runtime-and-health-debug](ai-deployment-skills/api-runtime-and-health-debug.md) |
| مشكلة في الموقع الرئيسي العام | `demo` / `kaza-prod-demo` | [docker-compose-scoped-deploy](ai-deployment-skills/docker-compose-scoped-deploy.md) |
| مشكلة في بوابة `app.kaza-booking.com` | `portal` / `kaza-prod-portal` | [portal-vs-demo-routing-and-build-source](ai-deployment-skills/portal-vs-demo-routing-and-build-source.md) |
| مشكلة في مخطط قاعدة البيانات (schema) | migration + backup، وربما `api` | [database-migration-production-safety](ai-deployment-skills/database-migration-production-safety.md) |
| مشكلة SSL / nginx | إعداد `novatova-nginx` / `certbot` — **بحذر شديد فقط** | [ssl-and-nginx-reverse-proxy](ai-deployment-skills/ssl-and-nginx-reverse-proxy.md) |
| مشكلة في Novatova | **خارج النطاق** إلا إن كنت تعمل على Novatova صراحةً | — |

> 🚫 **لا تفعل هذا:** لا تُعِد بناء الحزمة كاملة (`api + demo + portal + db`) لإصلاح مشكلة
> في طبقة واحدة. أصغر نطاق = أقل خطر.

---

## القسم 6 — قوالب الأوامر الآمنة (Safe Command Templates)

عرّف البيئة مرة واحدة في بداية الجلسة (على الـ VPS، بمستخدم `root`):

```bash
APP_DIR="/opt/apps/kaza-booking"        # المسار الصحيح. ليس /opt/kaza/app
ENV_FILE="/opt/kaza/env/.env.production"
PROJECT="kaza-prod"

# افشل مبكرًا إذا كان ملف البيئة مفقودًا/فارغًا (وإلا يستخدم Compose قيمًا افتراضية خاطئة)
test -s "$ENV_FILE" || { echo "FATAL: env-file missing/empty — abort"; exit 1; }

COMPOSE=(
  docker compose
  -p "$PROJECT"
  -f "$APP_DIR/docker-compose.prod.yml"
  --env-file "$ENV_FILE"
  --project-directory "$APP_DIR"
)
```

دالة إخفاء الأسرار (استخدمها مع أي أمر قد تحتوي مخرجاته أسرارًا):

```bash
redact() {
  sed -E 's/(PASSWORD|SECRET|TOKEN|KEY|CONNECTION|CONNECTIONSTRING|JWT|API_KEY|DATABASE_URL)[^=]*=.*/\1=***REDACTED***/Ig'
}
```

**إعادة بناء البوابة (portal) فقط:**

```bash
"${COMPOSE[@]}" build portal
"${COMPOSE[@]}" up -d --no-deps portal
```

**إعادة بناء الـ API فقط:**

```bash
"${COMPOSE[@]}" build api
"${COMPOSE[@]}" up -d --no-deps api
```

**إعادة بناء الموقع العام (demo) فقط:**

```bash
"${COMPOSE[@]}" build demo
"${COMPOSE[@]}" up -d --no-deps demo
```

> ✅ **النتيجة المتوقعة:** إعادة إنشاء الخدمة المستهدفة فقط. `--no-deps` يمنع إعادة إنشاء
> بقية الخدمات. قد تحدث ثوانٍ قليلة من انقطاع (blip) للخدمة المُعاد إنشاؤها فقط.

> 🚫 **ممنوع (يظهر هنا للتحذير فقط — لا تنفّذه):** أمر `docker compose up -d` المجرّد
> (بدون خدمة) يُعيد إنشاء المشروع كله، وقد يشغّل بروفايل `edge`، ويُسقط `proxy-network`.
> وكذلك `docker compose down` ممنوع تمامًا.

التفاصيل والقالب الكامل في
[command-templates.md](ai-deployment-skills/command-templates.md).

---

## القسم 7 — قائمة تحقق شبكة البروكسي (proxy-network checklist)

> 💡 **لماذا هذا مهم:** الشبكة `proxy-network` خارجية (external) وغير معرّفة داخل ملف
> Compose، لذا قد **تفقدها الحاوية عند إعادة إنشائها (recreate)**. وإذا فقدتها، لن يستطيع
> `novatova-nginx` الوصول إليها → تظهر أخطاء 502.

**افحص هل الحاوية متصلة بالشبكة:**

```bash
docker inspect -f '{{json .NetworkSettings.Networks}}' kaza-prod-portal
```

**أعِد الوصل فقط إذا كانت مفقودة (كرّر لكل حاوية Kaza أُعيد إنشاؤها):**

```bash
if ! docker inspect -f '{{json .NetworkSettings.Networks}}' kaza-prod-portal | grep -q '"proxy-network"'; then
  docker network connect proxy-network kaza-prod-portal
fi
```

**أعِد تحميل nginx بعد أي recreate (اختبر أولًا):**

```bash
docker exec novatova-nginx nginx -t          # يجب أن ينجح أولًا
docker exec novatova-nginx nginx -s reload   # يُحدّث الـ IP المخزّن للـ upstream
```

> ⚠️ **`reload` ليس `restart`:** `novatova-nginx` يخزّن عناوين الـ IP للخدمات (static
> upstreams بلا resolver)، فعند تغيّر IP الحاوية بعد recreate يجب **إعادة التحميل
> (reload)** لتحديثها. **لا تُعِد تشغيله (restart) أبدًا** — لأن ذلك يمسّ Novatova.

التفاصيل:
[proxy-network-reattach-and-nginx-reload](ai-deployment-skills/proxy-network-reattach-and-nginx-reload.md).

---

## القسم 8 — قائمة التحقق القياسية (Standard Verification Checklist)

نفّذ هذه بعد أي تغيير، وقبل أن تعتبر العمل ناجحًا:

```bash
curl -sS -I https://kaza-booking.com --max-time 15
curl -sS -I https://www.kaza-booking.com --max-time 15
curl -sS -I https://app.kaza-booking.com --max-time 15
curl -sS -i https://api.kaza-booking.com/health --max-time 15 | head -40
curl -sS -i https://api.kaza-booking.com/ --max-time 15 | head -40
curl -sS -I https://novatova.com --max-time 15
docker exec novatova-nginx nginx -t
```

> ✅ **النتيجة المتوقعة:**
> - المواقع الثلاثة (`kaza-booking.com`, `www`, `app`) تُرجع `200/301/302` مع SSL صالح.
> - `api.kaza-booking.com/health` يُرجع `200` (JSON صحّي).
> - `api.kaza-booking.com/` يُرجع `200` (حالة الخدمة).
> - `novatova.com` **ما زال** يُرجع `200/301/302` (لم يتأثر).
> - `nginx -t` يُرجع `syntax is ok` و`test is successful`.

> ⛔ **متى تتوقف:** إذا فشل `nginx -t`، أو تأثّر `novatova.com`، **توقّف فورًا** وأبلغ —
> لا تكمل.

قائمة التحقق النهائية الكاملة في
[final-verification-and-reporting](ai-deployment-skills/final-verification-and-reporting.md).

---

## القسم 9 — سير عمل البوابة (Portal Workflow)

- `app.kaza-booking.com` = **البوابة (portal)**، مصدرها مشروع **rental-platform**، الحاوية
  `kaza-prod-portal`.
- المشاكل الشائعة:
  - **التطبيق الخاطئ يُعرض** (يظهر demo بدل portal).
  - **تجمّد بعد تسجيل الدخول (post-login freeze)**.
  - **حلقات إعادة توجيه (route/dashboard loops)**.

**خطوات التشخيص:**
1. افحص الـ middleware (طبقة الحماية في الواجهة).
2. جرّب تسجيل الدخول بحسابات Admin / Owner / Client.
3. أعِد بناء `portal` فقط (انظر [القسم 6](#القسم-6--قوالب-الأوامر-الآمنة-safe-command-templates)).

> 💡 **درس سابق (post-login freeze):** كان السبب أن الـ Edge middleware يتحقق من كوكي
> `refresh_token` غير مرئي على دومين `app.` (host-only cookie عبر النطاقات الفرعية). كان
> الإصلاح الآمن **في الواجهة فقط** (middleware pass-through) بإعادة بناء `portal` فقط.

> 🚫 **لا تفعل هذا:** لا تلمس الـ API أو قاعدة البيانات لإصلاح مشكلة بوابة إلا بعد إثبات أن
> السبب فعلًا هناك.

التفاصيل:
[portal-auth-and-post-login-debug](ai-deployment-skills/portal-auth-and-post-login-debug.md)
و[portal-vs-demo-routing-and-build-source](ai-deployment-skills/portal-vs-demo-routing-and-build-source.md).

---

## القسم 10 — سير عمل الـ API (API Workflow)

- تغييرات الـ API في مشروع الخلفية (backend / API project)، الحاوية `kaza-prod-api`.
- `/health` يجب أن يُرجع دائمًا `200`.
- `/` يجب أن يُرجع حالة الخدمة (service status).
- **افحص السجلات (logs) أولًا** قبل أي تغيير:

```bash
docker logs --tail=200 kaza-prod-api
```

> 💡 **درس libgssapi:** فشل الـ API سابقًا في الاتصال بقاعدة البيانات لأن صورة التشغيل
> (runtime image) كانت تنقصها مكتبة `libgssapi-krb5-2` التي يحتاجها Npgsql. الإصلاح كان
> إضافة المكتبة (+ `ca-certificates`) في الـ Dockerfile وإضافة مسارَي `/` و`/health`.

**خطوات:**
1. افحص السجلات وابحث عن أخطاء (مثل `libgssapi` أو استثناءات بدء التشغيل).
2. أعِد بناء `api` فقط.
3. تحقّق: `api.kaza-booking.com/health` = 200، و`api.kaza-booking.com/api/projects` (أو
   نقطة جاهزية readiness) تعمل.

> 🚫 **لا تفعل هذا:** لا تضبط `ASPNETCORE_HTTPS_PORTS` (لا حاجة، ويسبب حلقة redirect). لا
> تُضِف مستخدم `USER` غير جذري بعد ذلك (الجذر يكتب على الـ bind mount الخاص بالرفع).

التفاصيل:
[api-runtime-and-health-debug](ai-deployment-skills/api-runtime-and-health-debug.md).

---

## القسم 11 — سير عمل قاعدة البيانات (Database Workflow)

- قاعدة البيانات في الحاوية `kaza-prod-db`، وبياناتها في **Docker volume/mount**.

> 🚫 **ممنوع تمامًا (لا تفعل):**
> - **لا** تحذف الـ volumes أبدًا.
> - **لا** تُشغّل SQL مدمّرًا (destructive) — لا `DROP TABLE`, لا `TRUNCATE TABLE`, لا
>   `DELETE` بلا شرط.
> - **لا** تُعدّل migration قديمة سبق تطبيقها.
> - **لا** تُعِد استخدام رقم migration (duplicate number).

> ✅ **افعل:**
> - **خذ نسخة احتياطية (backup) قبل أي كتابة على قاعدة البيانات.**
> - فضّل الـ migrations الإضافية القابلة للـ null (additive nullable).
> - استخدم الـ runner المُبوَّب (`scripts/apply-migrations.sh`) — يأخذ backup أولًا، يرفض
>   المدمّر، ويرفض الأرقام المكرّرة، ولا يعمل أثناء الـ deploy.

**قالب النسخ الاحتياطي (backup) — نفّذه قبل أي تعديل:**

```bash
# المفضّل: سكربت المستودع المُتحقَّق منه
sh /opt/apps/kaza-booking/scripts/backup-postgres.sh

# البديل اليدوي (dump مضغوط بصيغة custom في ملف محميّ للجذر فقط):
BACKUP_DIR="/opt/kaza/backups/postgres"; mkdir -p "$BACKUP_DIR"
TS="$(date +%F_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/kaza-prod-$TS.dump"
docker exec kaza-prod-db sh -lc '
  set -e
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc
' > "$BACKUP_FILE"
test -s "$BACKUP_FILE" || { echo "FATAL: backup empty — do NOT proceed"; exit 1; }
chmod 600 "$BACKUP_FILE"
```

> 💡 **درس أعمدة المالك (owner columns):** انكسر تسجيل دخول المالك (Owner) لأن قاعدة بيانات
> الإنتاج كانت تنقصها أعمدة. الإصلاح كان migration **إضافية** بعد **backup مُتحقَّق منه**،
> برقم فريد (كان الرقم `0048` مكرّرًا؛ الحل كان `0057`).

> ⛔ **متى تتوقف:** إذا فشل الـ backup أو تعذّر التحقق منه، أو كان التغيير مدمّرًا (drop /
> rename / تغيير نوع)، **توقّف** وسلّم لخطة يقودها إنسان مع اختبار backup/restore.

التفاصيل:
[database-migration-production-safety](ai-deployment-skills/database-migration-production-safety.md).

---

## القسم 12 — سير عمل حسابات الاختبار (Smoke Account Workflow)

- **بيانات dev لا تعمل في الإنتاج.** لا تحاول تسجيل الدخول ببيانات بيئة التطوير على الموقع
  الحيّ.
- استخدم **حسابات الاختبار (smoke accounts)** المخصّصة للإنتاج.
- ملف بيانات الاعتماد **للجذر فقط (root-only)** بصلاحية `chmod 600`.

> 🚫 **لا تفعل هذا أبدًا:** لا تطبع كلمات المرور في الشات أو السجلات أو الطرفية. مرّر أي
> مخرجات محتمَلة عبر `redact`.

**كيف تقرأ بيانات الاعتماد بأمان (على الـ VPS، بلا طباعة في مكان مشترك):**
- افتح الملف المحميّ محليًّا على الخادوم فقط، ولا تنسخه إلى جهازك ولا تلصقه في شات.

> ✅ **متى تُدوّر/تُعطّل حسابات الاختبار (rotate/disable):** بعد انتهاء أي مهمة اختبار
> حسّاسة، أو عند الاشتباه في تسرّب، أو دوريًّا كإجراء نظافة.

التفاصيل:
[smoke-accounts-and-secret-hygiene](ai-deployment-skills/smoke-accounts-and-secret-hygiene.md).

---

## القسم 13 — سير عمل SSL / nginx

أول خطوة: **فرّق بين نوع المشكلة** قبل أن تلمس أي شيء:

| العَرَض | التشخيص الأرجح |
|---|---|
| خطأ شهادة في المتصفح / `nginx -t` يفشل | مشكلة **SSL** حقيقية |
| رد `404` مع شهادة صالحة | مسار تطبيق مفقود (**ليست** مشكلة SSL) |
| رد `502` | الـ **upstream** لا يصل (غالبًا فقدان `proxy-network` أو حاوية متوقفة) |

**فحوصات آمنة (قراءة فقط):**

```bash
# هل الشهادة تغطّي الدومين؟ (SAN check)
docker exec novatova-nginx sh -lc 'openssl x509 -in /etc/letsencrypt/live/kaza-booking.com/fullchain.pem -noout -text' | grep -A1 'Subject Alternative Name'

# اختبر الإعداد قبل أي reload
docker exec novatova-nginx nginx -t
```

> 🚫 **لا تفعل هذا:**
> - **لا** تلمس بلوكات Novatova في إعداد nginx.
> - **لا** تحذف `/etc/letsencrypt` (ممنوع `rm -rf /etc/letsencrypt`).
> - **لا** تُشغّل `certbot delete`.
> - **لا** تُضِف `server_name` مكرّرًا — عدّل البلوك القائم في مكانه.

> ✅ **القاعدة الحديدية:** `nginx -t` **قبل** `nginx -s reload` دائمًا، و`reload` وليس
> `restart`.

التفاصيل:
[ssl-and-nginx-reverse-proxy](ai-deployment-skills/ssl-and-nginx-reverse-proxy.md).

---

## القسم 14 — سير عمل GitHub Actions

- سير عمل النشر: `.github/workflows/deploy-production.yml`، ينفّذ
  `scripts/deploy-production.sh`.
- يُطلق عند **push إلى `main`** أو `workflow_dispatch`، ومحميّ ببوابة `environment:
  production` (موافقة يدوية).

**ما يجب أن يفعله سير العمل الآمن:**
- **لا** `docker compose up -d` مجرّد أبدًا — نشر **مُقيَّد بالخدمة (service-scoped)**.
- استخدام المسار الصحيح `/opt/apps/kaza-booking`.
- استبعاد خدمات الـ edge (`nginx`/`certbot`) عبر بروفايل `edge`.
- إعادة وصل `proxy-network` بعد إعادة الإنشاء.
- `nginx -t` قبل أي reload، وفحوصات صحّة (health checks) بعد النشر.

> ⛔ **إذا فشل الـ deploy:** لا تُصلح على الـ VPS يدويًّا بشكل مرتجل. اقرأ سجل التشغيل في
> Actions، حدّد الخطوة التي فشلت، أصلح في فرع → PR → أعِد النشر. **ألغِ (cancel)** التشغيل
> إذا كان سيبني ما لم تقصده أو قبل المراجعة.

التفاصيل:
[github-actions-production-deploy-safety](ai-deployment-skills/github-actions-production-deploy-safety.md).

---

## القسم 15 — سير عمل ديمومة الإصلاح الحيّ (Live Hotfix Durability)

> ⚠️ **الإصلاح الحيّ مؤقّت.** الـ deploy يعمل force-checkout لـ `main`، فأي تعديل على الـ
> VPS فقط **يُمسح**.

الخطوات لجعل الإصلاح دائمًا:
1. طبّق الإصلاح حيًّا (عند الضرورة) واختبره.
2. أدخِل **نفس الـ diff تمامًا** إلى فرع مفروع من `main`.
3. افتح **PR** إلى `main`.
4. بعد الدمج، شغّل الـ deploy (بموافقة يدوية).
5. **نظّف شجرة العمل (working tree) على الـ VPS** بعد أن يهبط الإصلاح في `main`.
6. **تحقّق من الـ SHA المنشور** (deployed SHA) أنه يطابق الالتزام (commit) الذي يحوي إصلاحك.

> ✅ **النتيجة المتوقعة:** إصلاحك موجود في `main` وفي الصورة المنشورة، فلن يُمسح في أي deploy
> قادم.

التفاصيل:
[live-hotfix-to-main-durability](ai-deployment-skills/live-hotfix-to-main-durability.md).

---

## القسم 16 — سير عمل وصول SSH المؤقّت (Temporary SSH Access)

- **متى تسمح** بوصول SSH مؤقّت لوكيل: فقط عند الحاجة لتشخيص تفاعلي متعدد الخطوات. للأمر أو
  الأمرين، اجعل إنسانًا يلصقهما بدل تركيب مفتاح.
- **كيف تُضيف** المفتاح: بتعليق (comment) واضح يميّزه، مثل `claude-kaza-debug`.
- **كيف تحذف** المفتاح بعد الانتهاء:

```bash
sed -i '/claude-kaza-debug/d' ~/.ssh/authorized_keys
```

- **كيف تتحقق** أن الوصول أصبح مرفوضًا (من جهازك، النتيجة المتوقعة `Permission denied`):

```bash
# ssh -i ./that_key -o BatchMode=yes root@<VPS> true   # يجب أن يفشل
```

> 🚫 **لا تفعل هذا:** لا تترك أي مفتاح SSH مؤقّت مركّبًا بعد المهمة أبدًا.

التفاصيل:
[temporary-ssh-access-hygiene](ai-deployment-skills/temporary-ssh-access-hygiene.md).

---

## القسم 17 — كتب الطوارئ (Emergency Playbooks)

كل حالة: *فحوصات أولى → ما لا تفعله → إجراء آمن تالٍ → متى تتوقف*.

### 17.1 تطبيق Kaza متوقف (Kaza app down)
- **فحوصات أولى:** `docker ps` لحالة الحاويات؛ فحص الدومينات ([القسم 8](#القسم-8--قائمة-التحقق-القياسية-standard-verification-checklist)).
- **لا تفعل:** `docker compose down`؛ ولا إعادة بناء الحزمة كاملة.
- **إجراء آمن:** أعِد إنشاء الخدمة المتوقفة فقط (`up -d --no-deps <service>`) ثم أعِد وصل الشبكة و`reload` nginx.
- **توقّف إذا:** تطلّب الحلّ لمس Novatova أو `down`.

### 17.2 API يُرجع 500
- **فحوصات أولى:** `docker logs --tail=200 kaza-prod-api`؛ ابحث عن استثناء أو خطأ اتصال DB.
- **لا تفعل:** تعديل قاعدة البيانات قبل تأكيد أن السبب فيها.
- **إجراء آمن:** إن كان السبب عمودًا ناقصًا → backup ثم migration إضافية ([القسم 11](#القسم-11--سير-عمل-قاعدة-البيانات-database-workflow)).
- **توقّف إذا:** لزم تغيير مدمّر في قاعدة البيانات.

### 17.3 API يُرجع 502
- **فحوصات أولى:** هل الحاوية شغّالة؟ هل فقدت `proxy-network`؟ ([القسم 7](#القسم-7--قائمة-تحقق-شبكة-البروكسي-proxy-network-checklist)).
- **لا تفعل:** `restart` لـ `novatova-nginx`.
- **إجراء آمن:** أعِد وصل `proxy-network` للحاوية، ثم `nginx -t` و`nginx -s reload`.
- **توقّف إذا:** فشل `nginx -t`.

### 17.4 خطأ SSL
- **فحوصات أولى:** هل هي مشكلة شهادة حقيقية أم 404/502؟ ([القسم 13](#القسم-13--سير-عمل-ssl--nginx))؛ افحص SAN و`nginx -t`.
- **لا تفعل:** حذف `/etc/letsencrypt` أو `certbot delete` أو لمس بلوكات Novatova.
- **إجراء آمن:** عدّل البلوك القائم في مكانه، `nginx -t` ثم `reload`.
- **توقّف إذا:** لزم تجديد/إصدار شهادة يمسّ الإعداد المشترك بشكل غير واضح.

### 17.5 فشل الـ deploy
- **فحوصات أولى:** سجل التشغيل في تبويب Actions؛ حدّد الخطوة الفاشلة.
- **لا تفعل:** إصلاحات يدوية مرتجلة على الـ VPS تُمسح لاحقًا.
- **إجراء آمن:** أصلح في فرع → PR → أعِد النشر؛ أو ألغِ التشغيل إن لزم.
- **توقّف إذا:** كان الإصلاح يتطلب أوامر ممنوعة.

### 17.6 Novatova متوقف
- **فحوصات أولى:** `curl -sS -I https://novatova.com`.
- **لا تفعل:** أي إجراء على `novatova-*` — **هذا خارج نطاقك**.
- **إجراء آمن:** إن تزامن مع عملك على Kaza، تراجع فورًا وأبلغ مالك Novatova.
- **توقّف إذا:** دائمًا — هذه ليست خدمتك.

### 17.7 خطأ في migration لقاعدة البيانات
- **فحوصات أولى:** هل يوجد backup حديث مُتحقَّق منه؟ ما رقم الـ migration؟ هل مكرّر؟
- **لا تفعل:** تعديل migration قديمة، أو أوامر مدمّرة، أو استرجاع فوق قاعدة حيّة بلا CONFIRM.
- **إجراء آمن:** أوقف، خذ/تحقّق من backup، خطّط استرجاعًا يقوده إنسان.
- **توقّف إذا:** الـ ledger فارغ أو غير مؤكّد (الـ runner يرفضه لسبب وجيه).

### 17.8 تجمّد بعد تسجيل الدخول (login freeze)
- **فحوصات أولى:** جرّب Admin/Owner/Client؛ افحص الـ middleware ([القسم 9](#القسم-9--سير-عمل-البوابة-portal-workflow)).
- **لا تفعل:** تغيير كوكي في الخلفية قبل إثبات الحاجة.
- **إجراء آمن:** إصلاح واجهة فقط (middleware pass-through) وإعادة بناء `portal`.
- **توقّف إذا:** لزم تغيير مصادقة يمسّ كل المستخدمين → مراجعة كاملة.

### 17.9 التطبيق الخاطئ على app.kaza-booking.com
- **فحوصات أولى:** هل `app.` يخدم demo بدل portal؟ افحص مصدر البناء (build source).
- **لا تفعل:** تعديل الـ API أو قاعدة البيانات — هذه مشكلة توجيه/بناء.
- **إجراء آمن:** أعِد بناء `portal` من المصدر الصحيح؛ صحّح upstream في nginx إن لزم ثم `reload`.
- **توقّف إذا:** التبس مصدر البناء ([portal-vs-demo-routing-and-build-source](ai-deployment-skills/portal-vs-demo-routing-and-build-source.md)).

---

## القسم 18 — قوالب أوامر (Prompts) لوكلاء الذكاء الاصطناعي مستقبلًا

انسخ الـ prompt المناسب والصقه للوكيل. كل قالب يفرض: قواعد الأمان، النطاق، الملفات المتوقعة،
الأفعال الممنوعة، التحقق، والتقرير النهائي.

### 18.1 إصلاح الـ API

```
Task: Fix a Kaza Booking API issue (container kaza-prod-api) on the SHARED VPS that also
hosts Novatova. Read docs/ai-deployment-skills/api-runtime-and-health-debug.md first.
Scope: API only. Expected files: RentalPlatform.API/** (e.g. Dockerfile, Program.cs).
Forbidden: no docker compose down; no bare docker compose up -d (use up -d --no-deps api);
never touch Novatova; never start Kaza nginx/certbot on 80/443; never print secrets; never
edit the DB without a verified backup.
Verify: api.kaza-booking.com/health = 200, api.kaza-booking.com/ = 200, no libgssapi error
in logs, novatova.com still up, nginx -t OK.
Final report: what changed, files, container recreated, curl results, and a reminder that
a human must merge to main for durability.
```

### 18.2 إصلاح البوابة فقط (portal-only)

```
Task: Fix a portal issue on app.kaza-booking.com (container kaza-prod-portal, source
rental-platform). Read docs/ai-deployment-skills/portal-auth-and-post-login-debug.md and
portal-vs-demo-routing-and-build-source.md.
Scope: portal frontend only. Do NOT touch API or DB unless proven necessary.
Forbidden: no docker compose down; recreate only with up -d --no-deps portal; never touch
Novatova; never print secrets.
Verify: login works for Admin/Owner/Client, no post-login freeze/redirect loop, app.
serves portal (not demo), nginx -t OK, novatova.com still up.
Final report: root cause, files changed, portal rebuilt, verification, main-durability note.
```

### 18.3 هجرة قاعدة البيانات (DB migration)

```
Task: Apply an ADDITIVE production DB migration for Kaza (container kaza-prod-db). Read
docs/ai-deployment-skills/database-migration-production-safety.md.
Scope: one additive, nullable migration with a UNIQUE number, via scripts/apply-migrations.sh.
Forbidden: no DROP/TRUNCATE/DELETE; no editing old migrations; no duplicate numbers; no
volume deletion; do NOT proceed without a verified backup first.
Verify: backup exists and is non-empty, migration applied via the gated runner, affected
endpoint returns 200.
Final report: backup path, migration number, what changed, verification, main-durability note.
```

### 18.4 إصلاح خط أنابيب النشر (deploy pipeline)

```
Task: Fix the Kaza deploy pipeline. Read
docs/ai-deployment-skills/github-actions-production-deploy-safety.md.
Scope: .github/workflows/deploy-production.yml and/or scripts/deploy-production.sh (repo
edits only; do NOT run a production deploy).
Forbidden: never introduce a bare docker compose up -d; must stay service-scoped; edge
services (nginx/certbot) excluded via the edge profile; correct path /opt/apps/kaza-booking;
never trigger the deploy without human approval.
Verify: workflow lints/validates; deploy stays service-scoped; health checks present.
Final report: files changed, why safe, and that no deploy was triggered.
```

### 18.5 تشخيص SSL / nginx

```
Task: Diagnose an SSL/nginx issue for Kaza on the SHARED proxy novatova-nginx. Read
docs/ai-deployment-skills/ssl-and-nginx-reverse-proxy.md.
Scope: read-only diagnosis first; distinguish SSL vs 404 vs 502.
Forbidden: never rm -rf /etc/letsencrypt; never certbot delete; never touch Novatova server
blocks; never restart novatova-nginx (reload only, after nginx -t).
Verify: cert SAN covers the domain, nginx -t OK, endpoints return expected codes, novatova
.com still up.
Final report: the actual cause (SSL vs upstream), any config change, verification.
```

### 18.6 ترقية إصلاح حيّ إلى main (live hotfix → main)

```
Task: Make a Kaza live hotfix durable. Read
docs/ai-deployment-skills/live-hotfix-to-main-durability.md.
Scope: capture the exact live diff into a branch off main, open a PR to main.
Forbidden: do NOT leave the fix only on the VPS; no force-push to main; no auto-merge.
Verify: the same diff is in the PR, working tree on VPS is clean, deployed SHA matches after
merge+deploy.
Final report: branch, commit hashes, PR link, and confirmation the fix is in main.
```

### 18.7 التحقق النهائي (final verification)

```
Task: Run final verification after a Kaza production action. Read
docs/ai-deployment-skills/final-verification-and-reporting.md.
Scope: read-only checks only.
Forbidden: no changes of any kind during verification; never print secrets.
Verify: all three web hosts 200/301/302 with valid SSL, api /health and / = 200, nginx -t
OK, novatova.com still up, no Novatova container restarted.
Final report: the 13-point verification result and the final deployed SHA.
```

### 18.8 تشخيص تجمّد ما بعد الدخول (post-login freeze)

```
Task: Diagnose a post-login freeze / redirect loop on app.kaza-booking.com. Read
docs/ai-deployment-skills/portal-auth-and-post-login-debug.md.
Scope: frontend/middleware analysis first; prefer a frontend-only fix (portal rebuild).
Forbidden: no backend cookie-Domain change unless proven and reviewed; never touch Novatova;
never print secrets/tokens.
Verify: login completes without freeze/loop for Admin/Owner/Client, nginx -t OK.
Final report: root cause, the smallest fix applied, verification, main-durability note.
```

---

## القسم 19 — قائمة تحقق المشغّل النهائية (Final Operator Checklist)

صفحة واحدة تلخّص كل شيء.

**قبل العمل (Before):**
- [ ] حدّدتُ الخدمة المستهدفة (api / demo / portal / db / nginx).
- [ ] أكّدتُ الفرع الصحيح (feature / from main / docs).
- [ ] قدّرتُ خطر النشر (هل الدمج إلى main سيُطلق deploy؟).
- [ ] إن كان العمل على قاعدة البيانات: أخذتُ backup مُتحقَّقًا منه.
- [ ] أكّدتُ حدّ Novatova (لن ألمس `novatova-*`).

**أثناء العمل (During):**
- [ ] أوامر مُقيَّدة بالخدمة (`up -d --no-deps <service>`).
- [ ] لا `docker compose up -d` مجرّد، ولا `docker compose down`.
- [ ] لا أفعال مدمّرة على قاعدة البيانات.
- [ ] لا طباعة أسرار (استخدمتُ `redact`).

**بعد العمل (After):**
- [ ] فحصتُ نقاط النهاية (endpoints) — [القسم 8](#القسم-8--قائمة-التحقق-القياسية-standard-verification-checklist).
- [ ] راجعتُ السجلات (logs).
- [ ] `nginx -t` ناجح.
- [ ] `novatova.com` ما زال يعمل.
- [ ] رقّيتُ الإصلاح إلى `main` (PR) — الديمومة.
- [ ] حذفتُ أي مفتاح SSH مؤقّت وتحققتُ من رفض الوصول.
- [ ] سجّلتُ الـ SHA النهائي المنشور.

---

## المراجع (مكتبة المهارات التقنية العميقة)

- الفهرس: [`docs/ai-deployment-skills/README.md`](ai-deployment-skills/README.md)
- الأوامر الآمنة: [`command-templates.md`](ai-deployment-skills/command-templates.md)
- قواعد الوكلاء: [`AGENTS.md`](../AGENTS.md)

| الموضوع | المهارة |
|---|---|
| الأساس الأمني المشترك | [shared-vps-production-safety](ai-deployment-skills/shared-vps-production-safety.md) |
| اكتشاف البيئة الحقيقية | [production-inventory-and-discovery](ai-deployment-skills/production-inventory-and-discovery.md) |
| SSL / nginx | [ssl-and-nginx-reverse-proxy](ai-deployment-skills/ssl-and-nginx-reverse-proxy.md) |
| نشر مُقيَّد بالخدمة | [docker-compose-scoped-deploy](ai-deployment-skills/docker-compose-scoped-deploy.md) |
| إعادة وصل الشبكة + reload | [proxy-network-reattach-and-nginx-reload](ai-deployment-skills/proxy-network-reattach-and-nginx-reload.md) |
| ديمومة الإصلاح الحيّ | [live-hotfix-to-main-durability](ai-deployment-skills/live-hotfix-to-main-durability.md) |
| أمان GitHub Actions | [github-actions-production-deploy-safety](ai-deployment-skills/github-actions-production-deploy-safety.md) |
| تشخيص الـ API والصحّة | [api-runtime-and-health-debug](ai-deployment-skills/api-runtime-and-health-debug.md) |
| أمان هجرة قاعدة البيانات | [database-migration-production-safety](ai-deployment-skills/database-migration-production-safety.md) |
| حسابات الاختبار والأسرار | [smoke-accounts-and-secret-hygiene](ai-deployment-skills/smoke-accounts-and-secret-hygiene.md) |
| تشخيص ما بعد الدخول | [portal-auth-and-post-login-debug](ai-deployment-skills/portal-auth-and-post-login-debug.md) |
| توجيه portal مقابل demo | [portal-vs-demo-routing-and-build-source](ai-deployment-skills/portal-vs-demo-routing-and-build-source.md) |
| نظافة وصول SSH المؤقّت | [temporary-ssh-access-hygiene](ai-deployment-skills/temporary-ssh-access-hygiene.md) |
| التحقق والتقرير النهائي | [final-verification-and-reporting](ai-deployment-skills/final-verification-and-reporting.md) |
| مصفوفة قرارات النشر | [deployment-decision-matrix](ai-deployment-skills/deployment-decision-matrix.md) |

> ⛔ **قاعدة التوقف العامة:** في أي لحظة يتطلب فيها الحل لمس Novatova، أو تشغيل خدمة على
> 80/443، أو `docker compose down`، أو `docker compose up -d` مجرّد، أو فشل `nginx -t`، أو
> غياب backup قبل كتابة على قاعدة البيانات، أو طباعة سرّ — **توقّف، وثّق ما رأيته (مُخفى
> الأسرار)، وسلّم لإنسان.** التوقّف الآمن أفضل من التخمين الخطير.
