# Kiến trúc hệ thống

Monorepo `localman-next` là pnpm workspace gồm `apps/*` và `packages/*`, chạy trên Node ≥ 22 và TypeScript strict (ESM).

## Bố cục

| Thư mục | Package | Vai trò |
|---|---|---|
| `apps/web` | `@localman/web` | Dashboard React 19, Vite 7, Tailwind 4 và React Router 7. Dev server ở cổng 5173 |
| `apps/api` | `@localman/api` | Hai server Express 5 trong một process: dashboard API ở cổng 4000 và mock runtime công khai ở cổng 4100 |
| `packages/operations` | `@localman/operations` | Operation registry: một khai báo sinh route REST, MCP tool descriptor và OpenAPI 3.1. Xem [operation-registry.md](operation-registry.md) |
| `packages/shared` | `@localman/shared` | Code dùng chung cho web và api. `plan-limits.ts` là nguồn duy nhất của mọi hạn mức gói |
| `packages/design-tokens` | `@localman/design-tokens` | `tokens.css`, nơi duy nhất được chứa literal màu. Xem [design-system.md](design-system.md) |
| `apps/tunelo-server`, `packages/tunelo-cli`, `packages/tunelo-shared` | `@tunelo/server`, `tunelo`, `@tunelo/shared` | Tunelo, gộp từ repo cũ và giữ nguyên lịch sử. Xem `docs/tunelo/` |
| `scripts/` | — | Script kiểm tra cho CI (`check-mcp-coverage.ts`, `check-tokens.ts`) và script build của Tunelo (`scripts/tunelo/`) |
| `infra/tunelo/` | — | nginx, certbot, PM2 và `deploy.sh` của Tunelo |

Các internal package `@localman/*` là package chỉ có source TypeScript: `exports` trỏ thẳng vào `src/index.ts`. Vite, Vitest và tsx đọc source trực tiếp. Bản build production của api dùng esbuild bundle các package này vào `apps/api/dist/main.mjs` (`apps/api/scripts/build-api.ts`).

## Luồng request của api

```
apps/api/src/main.ts
  ├─ loadEnv()            zod validate biến môi trường, sai thì log fatal và exit 1
  ├─ connectMongo()       không kết nối được thì exit 1 (fail-fast, PM2/Compose tự restart)
  ├─ initModels()         chờ mọi model dựng xong index; index unique dựng lỗi thì exit 1
  ├─ dashboard app :4000  helmet → CSRF guard → với route có `bodyLimit`: kiểm phiên (ẩn danh 401 trước khi đọc body) rồi json theo route → json 100kb → /healthz → /auth/*, /internal/audit-events → /api/v1/openapi.json → no-store + router từ registry → 404 → error handler
  └─ mock app      :4100  helmet → json 100kb → /healthz → 404 → error handler (route mock thêm ở phase 05)
```

- Phần khung dùng chung cho hai server nằm ở `apps/api/src/http/create-base-app.ts`.
- `/healthz` luôn trả 200 kèm trạng thái kết nối DB, kể cả khi Mongo rớt giữa chừng.
- Mọi lỗi trả về dạng `{ "error": { "code", "message", "details"? } }`. Lỗi không lường trước trả 500 `INTERNAL_ERROR`, không lộ stack.
- SIGTERM/SIGINT đóng cả hai server rồi ngắt Mongo; quá 10 giây thì ép thoát.

## Đăng nhập và phiên

Localman không giữ mật khẩu. User đăng nhập ở IdP dùng chung `auth.hoandat.com` (repo `hoandat-auth`, hợp đồng ở `docs/integration-guide.md` của repo đó); Localman là client OIDC confidential `localman-web` (`apps/api/src/modules/auth/`).

- **Đăng nhập:** `GET /auth/login` tạo `state`, `nonce`, PKCE verifier, dựng URL tới IdP (scope `openid profile email telegram`, không `offline_access`, không `resource`, nên access token là opaque và làm được subject của token exchange), rồi mới lưu transaction ở `login_transactions` (TTL 10 phút). Trình duyệt chỉ giữ một handle ngẫu nhiên trong cookie `lm_login` (SameSite=Lax). Giới hạn 20 lần mỗi phút cho mỗi IP; vượt thì 303 về `/?authError=rate_limited`. IdP không phản hồi thì 303 về `/?authError=idp_unavailable`. Cả hai là điều hướng trình duyệt nên không trả JSON.
- **`returnTo` và link nội bộ:** chỉ nhận path bắt đầu bằng một `/`. Path được chuẩn hoá như trình duyệt (dot segment, `%2e`) rồi kiểm lại, nên `/.//evil.com` hay `/%2E%2E//evil.com` (chuẩn hoá thành `//evil.com`) bị chặn và về `/projects`. Luật này nằm ở `http/internal-path.ts`, dùng chung cho `link` của thông báo.
- **Callback:** transaction chỉ bị tiêu khi `state` của callback khớp, nên một callback giả không huỷ được lượt đăng nhập thật đang chờ. Sau đó đổi code (kiểm state, nonce, PKCE), đọc `userinfo` để upsert user (`users`, kèm chat Telegram), tạo phiên mới và đặt cookie `__Host-lm_session` (HttpOnly, Secure, SameSite=Strict, Path=/; trên http dev là `lm_session`). Lỗi thì về `/?authError=access_denied|login_expired|login_failed|idp_unavailable|rate_limited`.
- **Phiên** (collection `sessions`): `_id` là SHA-256 của giá trị cookie; `sub`, `sid` của IdP, access/refresh/ID token mã hoá chung một blob AES-256-GCM (AAD là id phiên, key từ `SESSION_ENCRYPTION_KEY` có key id để xoay vòng). Hết hạn 30 ngày không dùng, tối đa 90 ngày, giống grant của IdP. Huỷ phiên (đăng xuất, back-channel, refresh bị từ chối) thì xoá luôn các thiết bị Web Push mà phiên đó đã đăng ký.
- **Refresh:** access token còn dưới 60 giây thì refresh ngay khi xử lý request. Refresh token xoay vòng và dùng lại sẽ làm IdP thu hồi grant, nên mỗi phiên chỉ một lượt refresh: request cùng process dùng chung một promise, các process khác nhường nhau qua lease `refreshLockedUntil` trên document phiên. Refresh xong đọc lại `userinfo`. IdP trả `invalid_grant` thì xoá phiên (401).
- **Khi IdP sập (đánh đổi có chủ ý):** lỗi refresh tạm thời không xoá phiên; request vẫn chạy bằng access token cũ tới khi nó hết hạn (15 phút). Sau đó mọi API có scope trả 503 `AUTH_UNAVAILABLE` cho tới khi IdP trở lại, thay vì cho dùng tiếp một phiên mà IdP không còn xác nhận được.
- **Đăng xuất:** `POST /auth/logout` (form) xoá phiên rồi 303 tới `end_session_endpoint` với `id_token_hint`. `POST /auth/backchannel-logout` nhận logout token từ IdP, xác minh bằng JWKS (`iss`, `aud=localman-web`, `typ=logout+jwt`, `iat` trong 2 phút, sự kiện back-channel, không `nonce`, có `sid` hoặc `sub`), huỷ phiên theo `sid` (hoặc mọi phiên của `sub`) rồi mới ghi `jti` vào `logout_token_jtis`, để lượt IdP gửi lại vẫn đăng xuất được nếu bước ghi lỗi.
- **Sự kiện audit:** `POST /internal/audit-events` nhận SET (`application/secevent+jwt`, ES256, `typ: secevent+jwt`, `aud` là URL đầy đủ của endpoint `${PUBLIC_URL}/internal/audit-events`, `iat` không quá 15 phút và `exp` không quá 15 phút sau `iat`, dung sai đồng hồ 30 giây) kèm `Authorization: Basic` so khớp constant-time với `AUDIT_CLIENT_ID`/`AUDIT_CLIENT_SECRET`; thiếu hai biến này thì route trả 404. `jti` (bằng `Idempotency-Key`) lưu ở `audit_events` (30 ngày); sự kiện gửi lại được trả 202 mà không xử lý lại. `method.unlinked` với `method: "telegram"` xoá chat đã lưu ngay; `method.linked` telegram tạm dừng Telegram (`telegram.refreshPendingAt`) cho tới lần đọc `userinfo` kế tiếp (refresh hoặc đăng nhập). Sự kiện khác chỉ được ghi lại.
- **Token exchange:** `TunnelTokenExchange` đổi phiên lấy token `aud=https://tunnel.hoandat.com`, `scope=tunnels:read` (RFC 8693), cache theo phiên tới gần hết hạn. Phase 10 dùng.
- Mọi response `/api/v1/*` có `Cache-Control: no-store`; các route `/auth/*` và `/internal/*` cũng vậy.

## Proxy và IP của client

Localman deploy theo quy ước của server .65: pm2 chạy API, nginx giữ TLS và chạy **cùng máy**. Vì vậy `TRUST_PROXY` mặc định `loopback` (tương đương `127.0.0.1` và `::1`) là đúng: chỉ nginx trên máy được đặt `X-Forwarded-For`, và giới hạn theo IP (`GET /auth/login`) thấy IP thật của client. Giá trị được kiểm lúc khởi động bằng chính `proxy-addr` mà Express dùng: IP/CIDR sai làm API không khởi động. `true` luôn bị từ chối (ai cũng giả được `X-Forwarded-For`); ở production số hop cũng bị từ chối, phải ghi địa chỉ. Nếu chạy sau proxy khác (load balancer, Cloudflare Tunnel, nginx ở máy khác) thì phải đặt `TRUST_PROXY` bằng đúng địa chỉ hoặc CIDR của proxy đó, nếu không mọi request bị tính chung một IP.

## Thông báo

Không có email. `apps/api/src/modules/notifications/` gửi mỗi sự kiện tới các kênh user chọn cho loại sự kiện đó (`notification_preferences`):

- **Trong app** (mặc định bật, tắt được theo từng loại): lưu ở `notifications` (giữ 90 ngày), là dữ liệu của chuông.
- **Web Push** (mặc định tắt): VAPID (`VAPID_*`, tuỳ chọn), subscription theo thiết bị (`push_subscriptions`, endpoint duy nhất, chỉ nhận host của dịch vụ push trình duyệt), gắn với phiên đã đăng ký nó. Phiên kết thúc hoặc hết hạn thì thiết bị không nhận push nữa và bị xoá. Dịch vụ push trả 404/410 thì xoá subscription.
- **Telegram** (mặc định tắt): bot riêng của Localman (`TELEGRAM_BOT_TOKEN`, tuỳ chọn), `chatId` lấy từ `userinfo` của IdP. 429 thì gửi lại theo `retry_after` hoặc backoff luỹ thừa, tối đa 3 lượt và chờ không quá 10 giây; 403 thì đánh dấu kênh chưa kích hoạt cho tới khi chat đổi hoặc user bật lại Telegram trong tuỳ chọn.

`notify()` lưu bản trong app rồi trả về ngay; Web Push và Telegram chạy nền, lỗi chỉ ghi log. Khi tắt server, `drain()` chờ các lượt gửi nền xong. Danh mục sự kiện ở `notification-events.ts`; module khác gọi `getNotificationService().notify(sub, { type, title, body, link })`.

## Projects và giới hạn gói

Module `apps/api/src/modules/projects/`, operation `mock.*` dưới `/api/v1/projects`.

- **Project** (collection `projects`): `name`, `prefix`, `secret`, `owner` (`sub`), `quotaSlot`, timestamps. Zod của tên và prefix nằm ở `packages/shared/src/project-schema.ts`, web và api dùng chung. Tên bắt đầu bằng chữ hoặc số, sau đó nhận chữ mọi ngôn ngữ (có tiếng Việt, chuẩn hoá NFC), số, `_`, khoảng trắng, `-` và dấu ngoặc (để bản clone "X (copy)" sửa được mà không phải đổi tên). Prefix theo `^[\w\-/]*$` rồi chuẩn hoá thành `/x/y`, rỗng là không có prefix. Prefix trùng nhau trong cùng owner được phép như mockapi.io, vì mỗi project có subdomain riêng theo secret.
- **Secret** là nhãn DNS của mock runtime: nanoid 24 ký tự chỉ gồm `a-z0-9` (hostname không phân biệt hoa thường, `_` không hợp lệ trong hostname), khoảng 124 bit, unique index. `mockBaseUrl` = `https://{secret}.{MOCK_BASE_DOMAIN}{prefix}`; domain `localhost…` dùng `http`.
- **Phân quyền:** `project-access.ts` chỉ để lộ `can(user, action, project)` (`read`, `update`, `delete`, `clone`) và `accessibleProjectsFilter(user)` cho truy vấn danh sách. Owner làm được mọi việc; collaborator đã accept được `read` và `clone` (chưa có lời mời nào cho tới khi module collaborators lưu chúng). Không đọc được project thì 404 `NOT_FOUND` để không lộ project tồn tại; đọc được nhưng không có quyền thao tác thì 403 `FORBIDDEN`.
- **Dữ liệu phụ thuộc:** module khác đăng ký `registerProjectDependent({ kind, count, deleteAll, copy? })` ở `project-dependents.ts`. Xoá project (`dryRun` trả số lượng theo `kind`) đi ba bước, lặp lại an toàn: (1) dưới khoá project (`projects/project-lock.ts`, `inProjectTransaction`) đặt tombstone `deletingAt`; từ đó project coi như đã mất với mọi lượt đọc và ghi (404, không hiện trong danh sách), trừ `DELETE`; (2) gọi `deleteAll` (idempotent) của từng dependent; (3) xoá document project, lúc này slot hạn mức project mới được trả. Bước 2 lỗi thì tombstone ở lại, project vẫn chiếm slot, và `DELETE` lần sau dọn tiếp. Lượt ghi resource chạy đua với bước 1 hoặc commit trước (rồi bị bước 2 dọn), hoặc xung đột trên khoá, chạy lại và nhận 404, nên không còn dữ liệu mồ côi. Tombstone cũng là nền cho thùng rác 30 ngày (`trashDays`) sau này. Clone tạo project mới (secret mới, tên "X (copy)" cắt theo code point cho vừa giới hạn, tính vào hạn mức của người clone) rồi gọi `copy` của từng dependent; `copy` lỗi thì xoá bản clone dở. Dependent không có `copy` (thành viên) không đi theo bản clone.
- **Hạn mức project** (`billing/plan-guard.ts`): chỉ đếm project user sở hữu, theo `limitsFor(plan).projects`; vượt thì 403 `PLAN_LIMIT_REACHED` kèm `details: { limit: "projects", max, used }`. Pro có `planExpiresAt` đã qua thì tính như Free (cả ở `GET /users/me`). Chống tạo song song vượt hạn mức không cần transaction: mỗi project giữ một `quotaSlot`, unique index `(owner, quotaSlot)`. Lượt tạo đọc các slot đang dùng, từ chối khi đủ hạn mức, rồi lấy slot trống nhỏ nhất; các lượt đọc cùng dữ liệu chọn cùng một slot nên chỉ một lượt insert thắng, các lượt khác đọc lại và kiểm lại.
- **Bộ đếm tháng** (`billing/usage-counter-model.ts`, collection `usage_counters`): một document theo `ownerSub` + `yyyymm` (tháng theo lịch Asia/Saigon) với `mockRequests` và `proxyRequests`; `incrementUsage()` tăng nguyên tử và trả tổng mới cho mock runtime và proxy. `GET /api/v1/account/usage` trả gói đang áp dụng, project đã dùng và hai bộ đếm tháng so với hạn mức; `max: null` là không giới hạn (`Infinity` được map tường minh).
- **Gán gói tạm thời** (chưa có billing): `MONGO_URI=… pnpm --filter @localman/api set-user-plan --username <u> --plan pro --expires YYYY-MM-DD` (`--expires` tính hết ngày đó theo giờ Saigon, ngày đã qua phải thêm `--force`; `--plan free` xoá hạn). Script chỉ in `sub`, `username`, `plan`, `planExpiresAt`.

## Resources và dữ liệu mock

Module `apps/api/src/modules/resources/`, operation `mock.*` dưới `/api/v1/projects/:projectId/resources` (cộng `GET /api/v1/faker-methods`). Zod, whitelist Faker và template nằm ở `packages/shared`, web và api dùng chung.

- **Resource** (collection `resources`): `projectId`, `parentId` (cây cha–con), `name` (một đoạn path: `^[A-Za-z0-9][\w-]*$`, tối đa 64), `schema[]`, `template` (object template hoặc `null`), `endpoints[]` (đúng 5 endpoint `GET /:res`, `GET /:res/:id`, `POST /:res`, `PUT /:res/:id` dùng chung cho PATCH, `DELETE /:res/:id`, mỗi cái `enabled` và `response`), `count`, `nextId`, `ownerSub`, `quotaSlot`. Unique `(projectId, parentId, name)`: tên chỉ cần khác giữa các anh em. Cây sâu tối đa `MAX_RESOURCE_DEPTH` (10) tầng.
- **Schema:** field `{ name: /^[\w\-.]+$/, type, fakerMethod?, childId? }`, tối đa 50 field, không được tên `__proto__`, `constructor`, `prototype` (cùng danh sách `FORBIDDEN_KEYS` với key JSON). `id` (Object ID) và `{parent}Id` (Parent ID, `parentKeyOf(tên cha)`: `users` → `userId`) là field hệ thống, không nằm trong `schema`; field schema hay key cấp một của object template trùng tên với chúng bị từ chối (giá trị sẽ bị giá trị sinh ra che mất). Đổi tên cha mà bản ghi con đã có key trùng `{parent}Id` mới thì 409 `FIELD_CONFLICT`. `Parent Resource` và `Child Resource` là field quan hệ: không lưu vào record, mock runtime phân giải khi trả lời. Mặc định khi tạo: `createdAt` (`date.past`), `name` (`name.fullName`), `avatar` (`image.avatar`).
- **Record** (collection `records`): `resourceId`, `projectId`, `id` (chuỗi), `parentRecordId`, `data`. `id` và `parentRecordId` là cột riêng, không nằm trong `data`, nên đổi tên hay đổi cha không phải viết lại record; `toRecordView` ghép thành `{ id, {parent}Id, ...data }`. Unique `(resourceId, id)`, index `(resourceId, parentRecordId)`; thứ tự là thứ tự chèn (`_id`).
- **Whitelist Faker** (`faker-method-catalog.ts` cho danh sách id, `faker-methods.ts` cho hàm chạy, import qua `@localman/shared/faker-methods` để web không kéo Faker vào bundle): 249 method theo 21 nhóm, id giữ tên của nguồn (Faker 5: `name.*`, `address.*`, `datatype.*`) và map sang API Faker 10. Mỗi id là một hàm gọi tĩnh; tra cứu bằng `Map`, nên `constructor`, `__proto__` hay `helpers.fake` không gọi được gì. Kết quả luôn là JSON (ngày thành chuỗi ISO). Faker 10 bỏ LoremFlickr, nên các id ảnh theo chủ đề của nguồn (`image.cats`, `image.urlLoremFlickr`…) trả URL ảnh chung.
- **JSON template** (`json-template.ts`): chỉ thay khi **cả chuỗi** là một biến: `"$mockData"`, `"$count"` (chỉ trong custom response) hoặc `"$category.method"`. Chuỗi dài hơn như `"Giá $5"` giữ nguyên. Lúc lưu, tham chiếu lạ bị 400 (bắt lỗi gõ như `$mockdata` và `$constructor.constructor`); lúc render, tham chiếu lạ giữ nguyên chữ, không bao giờ chạy. Object được dựng lại bằng `Object.fromEntries` nên key `__proto__` không chạm prototype; key `__proto__`, `constructor`, `prototype` bị từ chối ở đầu vào (mongoose âm thầm bỏ `__proto__`). Giới hạn lúc lưu: template sâu 10, 2.000 giá trị, tối đa `MAX_METHOD_REFERENCES` (200) lời gọi Faker. Lúc render (`json-template-render.ts`) đầu ra được đo **trong khi** sinh, theo số giá trị (50.000) và theo byte (`maxBytes`, ước lượng JSON gọn); vượt là dừng ngay với `TEMPLATE_TOO_LARGE`, nên template quá lớn chỉ tốn tối đa một ngân sách công sức.
- **Sinh dữ liệu:** `POST …/:resourceId/generate { count: 0..100 }` thay toàn bộ dữ liệu (0 là reset), id lại từ "1". Field Faker gọi whitelist, `String` ra `"<tên> <số thứ tự>"`, `Number` ra số thứ tự, `Boolean` ngẫu nhiên, `Object` `{}`, `Array` `[]`, `Date` một ngày trong quá khứ (giống nguồn). Có `template` thì dùng template thay schema. Resource con chia ngẫu nhiên N bản ghi cho các bản ghi cha; cha chưa có dữ liệu thì 409 `PARENT_HAS_NO_DATA` (message tiếng Anh, client dịch theo mã). `generate_all` vẫn nguyên tử (một transaction) nhưng sinh và chèn **từng resource** theo thứ tự cha trước con, nên bộ nhớ chỉ giữ dữ liệu của một resource (`count` tuỳ chọn; không có thì giữ số hiện tại, resource rỗng nhận 10 như prototype). `reset_all` xoá mọi bản ghi, giữ schema.
- **Sửa dữ liệu thô:** `PUT …/:resourceId/data { data: [...] }` (registry chỉ nhận body là object, nên mảng nằm trong `data`; riêng route này nhận body tới 2,5 MB, các route khác giữ 100 KB), tối đa `MAX_RECORDS_PER_RESOURCE` (1000, cũng là trần POST của mock runtime; generator dừng ở `MAX_GENERATE_COUNT` = 100) object. `id` tuỳ chọn, duy nhất, là số nguyên không âm hoặc chuỗi an toàn cho URL có ít nhất một chữ hoặc số (chặn `.`, `..`); thiếu thì đánh số tiếp sau id số lớn nhất không quá 10^9. Với resource con, `{parent}Id` phải trỏ tới bản ghi cha có thật (`null` bị từ chối), thiếu thì gán ngẫu nhiên. Lỗi JSON trả đúng `path` của giá trị hỏng.
- **Trần kích thước** (`MAX_RECORD_BYTES` 32 KB mỗi record, `MAX_RESOURCE_BYTES` 2 MB mỗi resource, trong `plan-limits.ts`, áp cho mọi gói): kiểm khi sinh (template dừng sớm theo byte, tổng đo dần), khi `PUT data`, trong `writeRecords` và khi clone; vượt thì 413 `DATA_TOO_LARGE` với `details: { limit: "record" | "resource", maxBytes, actualBytes, resourceId, name }` (`actualBytes` là ước lượng; `generate_all` cũng nêu resource gây lỗi). Lúc lưu, object template được ước lượng record xấu nhất từ bảng trần kích thước từng method Faker (`faker-method-sizes.ts`, đo hàng nghìn lần rồi nhân đôi; test đo lại để bắt khi nâng Faker) cộng phần chữ cố định; vượt 32 KB thì 400 `TEMPLATE_TOO_LARGE` (`details: { maxBytes, estimatedBytes }`).
- **Nhất quán cha–con** (chi tiết ở [ADR-0001](decisions/0001-resource-data-in-project-transactions.md)): mọi thao tác ghi resource hoặc record của dashboard chạy trong transaction Mongo, giữ khoá cây của project rồi kiểm project còn tồn tại và không có `deletingAt` (không thì 404). Sau khi dữ liệu cha bị thay, bản ghi con trỏ tới id cha còn tồn tại được giữ, bản ghi con mồ côi được gán ngẫu nhiên một bản ghi cha mới; cha rỗng thì cả cây con bị reset. Đổi cha (`PUT …/:resourceId/parent`) reset dữ liệu của resource đó và mọi resource dưới nó, bỏ field quan hệ không còn hợp lệ. Xoá resource xoá cả cây con và record, và bỏ field `Child Resource` trỏ tới nó.
- **Hạn mức resource:** `limitsFor(plan).resources` tính trên **mọi resource của mọi project user sở hữu** (tên field không có hậu tố `Per…` như `membersPerWorkspace`), không tính project được chia sẻ. Resource bị tính cho chủ project (`ownerSub`). Chống race giống project: unique `(ownerSub, quotaSlot)`, slot trống nhỏ nhất (`billing/quota-slots.ts`). Clone project tính toàn bộ resource của bản sao vào hạn mức người clone; vượt thì 403 `PLAN_LIMIT_REACHED` (`limit: "resources"`) và bản clone bị xoá. Custom response và object template mở cho mọi gói.
- **Phân quyền:** đọc cần `can(read)`, ghi cần `can(update)` của project; không đọc được project thì 404, resource không thuộc project cũng 404. Thao tác xoá hoặc thay dữ liệu (`delete`, `parent`, `generate`, `generate_all`, `reset_all`, `PUT data`) là destructive và nhận `?dryRun=true` để xem trước danh sách `changes` (`countBefore` → `countAfter`).
- **Project dependents:** `resources` (đếm resource; xoá resource, record và khoá cây; clone chép cả cây, schema, template, endpoint và record trong một transaction giữ cả khoá project nguồn, nên đọc một snapshot nhất quán và chép record từng resource; map id resource cũ sang mới, giữ `id` và `parentRecordId` của record) và `records` (chỉ đếm và xoá).
- **Ghi chú cho mock runtime:** key bắt đầu bằng `$` hoặc chứa `.` hợp lệ trong dữ liệu và luôn nằm dưới `data`; không bao giờ dựng đường dẫn filter hay update Mongo từ key dữ liệu (lọc, sắp xếp, merge làm trong bộ nhớ hoặc thay cả `data`). Tên resource anh em phân biệt hoa thường (`Side` và `side` cùng tồn tại được), nên router mock phải so khớp tên phân biệt hoa thường. Lượt ghi record của runtime nên dùng `inProjectTransaction` khi đụng nhiều document (xoá dây chuyền).

## Form quan tâm gói Pro

Module `apps/api/src/modules/feedback/` (collection `feedback`, field `type`; giờ chỉ có `pro_interest`). Không có mail server: form chỉ lưu email để owner liên hệ sau.

- `POST /api/v1/feedback/pro-interest` công khai; có phiên thì gắn `userSub`. Thứ tự kiểm:
  - Rate limit: theo IP (IPv6 gộp theo /64, IPv4-mapped tính như IPv4) 5 lần mỗi 10 phút; người đã đăng nhập còn bị giới hạn theo tài khoản 3 lần mỗi 10 phút (cả hai phải qua). Đếm trong Mongo `rate_limit_windows` theo hash của khoá, tự hết hạn theo cửa sổ.
  - Honeypot `website`: có giá trị thì trả 201 như thật nhưng không lưu, không báo.
  - Cloudflare Turnstile cho khách khi `TURNSTILE_*` được cấu hình (production bắt buộc). Token phải được giải trên đúng host của `PUBLIC_URL` (bỏ qua với secret thử nghiệm của Cloudflare) và, nếu widget khai `action`, đúng `pro_interest`. Siteverify quá 5 giây hoặc lỗi 5xx thì 503 `TURNSTILE_UNAVAILABLE` (chặn chứ không cho qua); token thiếu hoặc sai thì 400 `TURNSTILE_FAILED`. Bắt buộc `consent: true`.
- `source` thuộc danh sách cố định `PRO_INTEREST_SOURCES` trong `packages/shared`; giá trị lạ được lưu thành `other`.
- Gộp theo email đã chuẩn hoá (unique index một phần trên `type: "pro_interest"`). Mọi lượt gửi được thêm vào `submissions[]` (giữ 20 lượt gần nhất, có cờ `applied`). Câu trả lời của bản ghi chỉ đổi khi cùng danh tính: bản ghi đã gắn tài khoản thì chỉ chính tài khoản đó sửa được (`userSub` không bao giờ bị thay); bản ghi chưa gắn thì khách khác ghi đè được (không phân biệt được khách), còn user đăng nhập chỉ nhận bản ghi đó khi email trùng email đã xác minh ở IdP. `emailMatchesAccount` ghi lại điều kiện xác minh này.
- Sau khi lưu, bot Telegram của Localman báo nền về `OWNER_TELEGRAM_CHAT_ID` (mới, cập nhật hay chỉ lưu lịch sử; nhu cầu, quy mô, nguồn, email che dạng `ng***@gm***.com`; không có tên, ghi chú hay email đầy đủ). Tối đa 10 tin mỗi giờ; tin vượt được đếm và cộng thành "và X lượt khác" vào tin đầu tiên của cửa sổ kế tiếp.
- Admin (`admin.*`, `guard: ownerOnly` theo `OWNER_SUBS`, `GET /users/me` có `isOwner`): thống kê, danh sách lọc theo nguồn, nhu cầu, đã liên hệ, đoạn email, phân trang (item có `emailMatchesAccount` và `submissions`); xuất CSV trả JSON `{ filename, csv }` (registry chỉ trả JSON, và agent MCP cũng đọc được), UTF-8 có BOM, ô bắt đầu bằng `= + - @`, tab hoặc CR được thêm `'` để chống formula injection; đánh dấu đã liên hệ; xoá theo yêu cầu (`dryRun`).

## Cấu hình sản phẩm

Ngoài biến nền tảng, `apps/api/src/config/feature-env.ts` đọc `MOCK_BASE_DOMAIN`, `OWNER_SUBS`, `OWNER_TELEGRAM_CHAT_ID`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_VERIFY_URL` (xem `.env.example`). Operation được khai báo tĩnh nên đọc các giá trị này qua `config/runtime-settings.ts`, do `main.ts` cài khi khởi động.

## Dữ liệu

MongoDB 7 chạy dạng single-node replica set (`rs0`), vì dữ liệu resource được thay trong transaction. File `docker-compose.yml` dựng sẵn và tự `rs.initiate` ở lần chạy đầu. Test dùng `MongoMemoryReplSet` một node (wiredTiger) chung cho cả lượt chạy, mỗi file test một database.

## Domain

| Domain | Thành phần |
|---|---|
| `localman.hoandat.com` | Web và dashboard API |
| `{secret}.localman.hoandat.com` | Mock runtime công khai |
| `auth.hoandat.com` | IdP dùng chung (plan `261008-1325-central-auth-idp`) |
| `*.tunnel.hoandat.com` | Tunelo (plan `261008-1156-tunelo-accounts-and-tunnel-list`) |
