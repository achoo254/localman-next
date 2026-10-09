# Audit bảo mật Localman, phase 09 (T4)

- Ngày: 2026-10-09 (Asia/Saigon)
- Người audit: code-reviewer
- Phạm vi: code đã commit tới `3c96ab2` cộng thay đổi chưa commit (request log, project activity, tombstone sweeper, cleanup script, CI, e2e). Gồm `apps/api`, `apps/web`, `packages/shared`, `packages/operations`.
- Ngoài phạm vi: `infra/localman/**` (review riêng), Tunelo (`apps/tunelo-server`, `packages/tunelo-*`).
- Cách làm: đọc code, đối chiếu với `docs/system-architecture.md` và `docs/operation-registry.md`, chạy `pnpm audit`. Theo chỉ dẫn, không chạy test, không sửa code, không ssh. Các finding được xác minh bằng cách đọc code; chưa có test tái hiện.

## Tóm tắt

| Mức | Số lượng |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 8 |

`pnpm audit --prod`: **0 advisory** (255 package production). Bản audit đầy đủ (gồm dev) có 2 critical và 5 moderate, đều thuộc toolchain dev; xem L6.

Hai finding High phải sửa ở T5 trước khi lên production: H1 (một user Free đọc một route mock là làm cạn bộ nhớ của process chung) và H2 (owner xoá thành viên nhưng thành viên đó vào lại được qua magic link).

---

## High

### H1. Field quan hệ trùng lặp khiến một request mock nạp hàng trăm MB, làm hết bộ nhớ của process chung

- **File:**
  - `apps/api/src/modules/mock-runtime/relation-fields.ts:113-121`: mỗi field `Child Resource` hoặc `Parent Resource` chạy một truy vấn riêng, song song bằng `Promise.all`. Không gộp các field trỏ cùng một nguồn.
  - `apps/api/src/modules/mock-runtime/relation-fields.ts:76-83`: `childResolver` nạp **mọi** bản ghi con của các bản ghi trong trang. Không có `limit` thì trang là toàn bộ collection.
  - `packages/shared/src/resource-schema.ts:85-97` và `apps/api/src/modules/resources/resource-rules.ts:75-79`: schema nhận tới 50 field. Không có luật nào cấm nhiều field `Child Resource` cùng `childId`, hay nhiều field `Parent Resource`.
  - `apps/api/src/modules/mock-runtime/render-response.ts:128`: response chỉ bị đo (422 khi quá 2 MB) **sau khi** mọi thứ đã được nạp và dựng thành object JS.
- **Kịch bản khai thác:** Attacker đăng ký tài khoản Free (miễn phí) và tạo resource `users` có resource con `posts`. Họ dùng `PUT …/data` đổ vào `posts` 1000 bản ghi, tổng gần 2 MB (`MAX_RESOURCE_BYTES`), tất cả trỏ vào bản ghi cha. Sau đó họ thêm vào `users` 50 field kiểu `Child Resource`, tên khác nhau nhưng cùng `childId` là `posts`. Mỗi lượt `GET https://{secret}.localman.hoandat.com/users` (hoặc `/users/1`) khi đó chạy 50 truy vấn song song, mỗi truy vấn trả khoảng 2 MB, tức khoảng 100 MB BSON. Dữ liệu này thành vài trăm MB heap (`lean` cộng `toRecordView` cộng `Object.fromEntries`) rồi mới bị trả 422. Giới hạn 30 request/s mỗi IP cho phép hàng chục request như vậy cùng lúc, đủ làm OOM process. Dashboard và mock runtime chạy chung một process (PM2 fork, `instances: 1`), nên mọi tenant đều mất dịch vụ cho tới khi PM2 khởi động lại, rồi attacker lặp lại. Hạn mức 10.000 request/tháng của gói Free không chặn được, vì vài chục request là đủ.
- **Cách sửa (nên làm cả hai):**
  1. Validation: lúc lưu schema, từ chối quá một field `Parent Resource` và quá một field `Child Resource` cho mỗi `childId` (400 `VALIDATION_ERROR`). Thêm vào `definitionProblem` ở `resource-rules.ts`, và dùng chung với zod ở `packages/shared` để web báo lỗi sớm.
  2. Runtime: trong `withRelations`, gom field theo nguồn (`parent`, `child:<id>`) để mỗi nguồn chỉ truy vấn một lần. Trước khi truy vấn, cộng `dataBytes` của các resource nguồn với số byte của trang. Nếu tổng vượt `MAX_RESPONSE_BYTES` thì trả 422 `RESPONSE_TOO_LARGE` mà không nạp gì. Resource cũ chưa có `dataBytes` thì coi như ở mức trần.
  3. Test hồi quy: resource có 50 field `Child Resource` cùng một con 2 MB phải bị từ chối khi lưu. Dữ liệu cũ đã lưu như vậy phải nhận 422 mà không nạp (kiểm số truy vấn hoặc số document đọc về, giống `bench:mock-writes`).

### H2. Thành viên bị owner xoá tham gia lại ngay bằng magic link

- **File:**
  - `apps/api/src/modules/collaborators/collaborator-service.ts:103`: xoá thành viên chỉ là `deleteOne` dòng collaborator. Không ghi lại rằng người này đã bị owner xoá.
  - `apps/api/src/modules/collaborators/invite-eligibility.ts:186-196`: với magic link, điều kiện duy nhất là link còn sống và còn chỗ.
  - `apps/api/src/modules/collaborators/invite-acceptance.ts:102-154`: `joinWithMagicLink` tạo lại dòng `accepted` cho bất kỳ ai đã đăng nhập.
  - `apps/web/src/features/collaborators/member-confirm-modal.tsx`: modal báo "Họ sẽ mất quyền truy cập project ngay".
- **Kịch bản khai thác:** Owner tạo magic link (hạn 7 ngày) và gửi cho nhóm. B tham gia qua link. Owner xoá B vì B phá dữ liệu. Link vẫn nằm trong lịch sử chat của B, nên B mở lại `/invite/<token>` và bấm chấp nhận. `ineligibility` không thấy B là thành viên, link chưa hết hạn, còn chỗ, nên B trở lại với quyền `editResources`: xoá resource, thay dữ liệu, `generate_all`, `reset_all` và đọc `secret`. Hành động xoá của owner vô hiệu cho tới khi owner tự nghĩ tới việc thu hồi magic link. UI không gợi ý việc đó; `RotateSecretHint` chỉ nhắc đổi URL mock.
- **Cách sửa (khuyến nghị phương án 1):**
  1. Khi owner xoá một thành viên đã accept, giữ lại một dòng chặn (ví dụ `status: "removed"`, `inviteeUserId`, `removedAt`) thay vì xoá hẳn. `joinWithMagicLink` và `ineligibility` từ chối dòng này bằng 403 với mã riêng, ví dụ `REMOVED_BY_OWNER`. Chỉ một lời mời đích danh mới của owner gỡ được dòng chặn. Đếm chỗ (`memberSeats`) và danh sách phải bỏ qua `removed`. Thành viên tự rời (leave) thì vẫn xoá hẳn.
  2. Phương án thay thế, đơn giản hơn nhưng ảnh hưởng người khác: tự thu hồi magic link mỗi khi owner xoá thành viên, và báo owner rằng link cũ đã ngừng.
  3. Cách tối thiểu (không đủ để hạ mức): modal xoá nhắc owner thu hồi hoặc đổi magic link khi link đang `active`.

  Phương án 1 thay đổi hành vi mà user khác thấy (một mã lỗi mới trên trang mời), nên lead cần chốt với user trước khi làm.

---

## Medium

### M1. API dashboard đã đăng nhập không có rate limit cho các thao tác nặng

- **File:** `apps/api/src/dashboard-server.ts:96-115`: router registry không có limiter nào ngoài login, lời mời và form công khai. Các thao tác nặng: `apps/api/src/modules/resources/resource-data-operations.ts:32-90` (`generate`, `generate_all`), `:156-190` (`PUT data`, body 2,5 MB), và `mock.cloneProject` (`apps/api/src/modules/projects/project-operations.ts:144-162`).
- **Kịch bản khai thác:** Một tài khoản Free có 3 project, mỗi project 10 resource, mỗi resource có object template gồm chuỗi literal khoảng 20 KB. Script gọi song song và liên tục `POST …/resources/generate_all` (`count: 100`) trên cả 3 project. Mỗi lượt sinh khoảng 20 MB và ghi trong một transaction Mongo. Ngoài ra còn `PUT …/data` 2,5 MB, hoặc vòng clone rồi xoá project. CPU của process chung (render Faker, đo JSON) và replica set bị chiếm, mock runtime của mọi user chậm theo. Lập thêm tài khoản ở IdP là cách nhân tải lên.
- **Cách sửa:** Thêm limiter theo tài khoản, dùng lại `takeRateLimitSlot` có sẵn (Mongo, cửa sổ cố định). Gắn nó qua `guard` hoặc một bước chung trong `createRouteHandler` cho các operation `annotations.destructive` và operation có `bodyLimit`, ví dụ 30 lượt mỗi phút mỗi `sub` và 429 `RATE_LIMITED`. Thêm semaphore trong process (ví dụ tối đa 2 `generate_all` hay clone cùng lúc mỗi user) để chặn chạy song song.

### M2. Lời mời qua email bị gắn vào tài khoản chưa xác minh email

- **File:** `apps/api/src/modules/collaborators/invitee-lookup.ts:79-91` (`accountByEmail` lấy tài khoản chưa xác minh khi chỉ có đúng một tài khoản như vậy) và `apps/api/src/modules/collaborators/invite-eligibility.ts:151-152` (lời mời đã gắn `inviteeUserId` thì không kiểm email nữa).
- **Kịch bản khai thác:** Attacker biết owner sắp mời `lan@congty.vn`. Họ đăng ký trước ở IdP một tài khoản dùng email đó mà không xác minh. Owner gõ email, lời mời được gắn vào tài khoản của attacker, attacker nhận thông báo trong app kèm link, rồi accept mà không cần chứng minh sở hữu email. Họ vào project với quyền `editResources` và thấy `secret`. Thứ duy nhất ngăn lại là owner để ý dấu "email chưa xác minh" trên thẻ tài khoản (`collaborator-row.tsx:174`). Agent gọi `mock.inviteCollaborator` qua MCP thì không thấy UI này.
- **Ghi chú:** đây là đánh đổi có chủ ý, đã ghi trong `docs/system-architecture.md` (mục Cộng tác viên), nên lead phải hỏi lại user trước khi đổi.
  - Đánh đổi: mời bằng email nhanh với người đã có tài khoản nhưng chưa xác minh, đổi lại rủi ro chiếm lời mời.
  - Phương án khuyến nghị: không gắn `inviteeUserId` khi email chưa xác minh. Lời mời chỉ gắn email, và người nhận phải xác minh email ở IdP mới accept được; luật này đã có sẵn ở `addresseeProblem`.
  - Phương án nhẹ hơn: giữ cách gắn hiện tại, nhưng lúc accept vẫn bắt `emailVerified` khi dòng có cả `inviteeEmail` lẫn `inviteeUserId` mà lúc mời tài khoản chưa xác minh.

### M3. API lắng nghe trên mọi interface

- **File:** `apps/api/src/main.ts:46`: `app.listen(port)` không truyền host, nên cổng 4000 và 4100 bind vào `::` hoặc `0.0.0.0`.
- **Kịch bản khai thác:** Trên server .65 dùng chung (pm2 + nginx cùng máy), nếu firewall không chặn 4000 và 4100, attacker gọi thẳng `http://<ip>:4100/m/<secret>/…`. Như vậy họ vượt qua `limit_req` và `limit_conn` của nginx (lớp chặn dò secret hàng loạt mà plan đang trông cậy), không qua TLS, và không để lại access log nginx. Rate limit trong process vẫn chạy theo IP thật nên không bị vô hiệu hoàn toàn. Mức nghiêm trọng phụ thuộc firewall, phần này cần kiểm ở review infra.
- **Cách sửa:** Thêm biến `LISTEN_HOST` vào `env.ts`, production mặc định `127.0.0.1`, rồi truyền vào `app.listen(port, host)`. Khi review infra, kiểm bằng `ss -ltnp | grep -E ':4000|:4100'`.

---

## Low

| # | File:dòng | Vấn đề và kịch bản | Cách sửa |
|---|---|---|---|
| L1 | `apps/api/src/modules/mock-runtime/mock-records.ts:72-78`, `mock-endpoints.ts:52-57` | Mọi lượt GET list nạp cả collection (tới 2 MB) rồi mới lọc trong bộ nhớ. Ngân sách byte (`MOCK_RESPONSE_BYTES_PER_SECOND`) chỉ tính byte của response, nên `?search=khong-co` trả mảng rỗng nhưng vẫn tốn 2 MB đọc và decode mỗi request: 30 req/s mỗi IP ra khoảng 60 MB/s decode. Hạn mức tháng của gói Free hạn chế được phần nào; gói Pro không giới hạn. | Tính `resource.dataBytes` (số byte đã đọc) vào ngân sách byte của secret, thay vì chỉ byte trả về. Hoặc cache bản ghi theo `resourceId` trong vài giây. |
| L2 | `apps/api/src/modules/collaborators/invitee-lookup.ts:101-108`, `users/user-model.ts:51` | `users.username` không unique (bản sao từ IdP có thể cũ, so khớp không phân biệt hoa thường), và `findOne({ username })` lấy một bản ghi bất kỳ. Mời `@alice` có thể gắn vào một tài khoản cũ cùng tên. | Khi có nhiều hơn một kết quả thì trả 409 `AMBIGUOUS_USERNAME` (`.limit(2)` như nhánh email), hoặc ưu tiên bản ghi có `updatedAt` mới nhất. |
| L3 | `apps/web/src/pages/accept-invite-page.tsx:65-72` | Token mời nằm trong path `/invite/<token>` và trong `returnTo` của `/auth/login?returnTo=%2Finvite%2F<token>`. Nó bị ghi vào access log nginx, vào lịch sử trình duyệt và vào `login_transactions`. Ai đọc được log là có token magic link còn sống (7 ngày). API không bao giờ ghi query, nên rủi ro nằm ở nginx. | Ở nginx, không ghi `$request_uri` cho `/invite/` và `/auth/login` (dùng `log_format` riêng). Hoặc chuyển token sang fragment (`/invite#<token>`), vì fragment không gửi lên server. |
| L4 | `apps/api/src/modules/auth/auth-routes.ts:99-169`, `backchannel-logout-route.ts:44`, `audit/audit-events-route.ts:69` | `/auth/callback`, `/auth/backchannel-logout` và `/internal/audit-events` không có rate limit. Mỗi lượt callback giả tốn một `findOneAndDelete`. Endpoint audit nhận thử Basic không giới hạn (secret ít nhất 32 ký tự nên brute force không khả thi). | Dùng `loginRateLimit` cho callback. Giới hạn theo IP cho hai endpoint server-to-server, hoặc ở nginx chỉ cho IP của IdP gọi `/internal/` và `/auth/backchannel-logout`. |
| L5 | `packages/operations/src/query-coercion.ts:45-48` | `coerced[name] = …` ghi key do user gửi vào một object literal. `?__proto__=a&__proto__=b` đổi prototype của chính object đó thành mảng. Không lan ra prototype toàn cục, và lượt spread sau đó bỏ prototype, nên chưa khai thác được; đây là vấn đề vệ sinh code. | Dựng bằng `Object.fromEntries(...)` hoặc `Object.create(null)`. |
| L6 | `package.json` (devDependencies), `pnpm-lock.yaml` | `pnpm audit` đầy đủ: **critical** tinypool ≤2.1.1 (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr, prototype pollution dẫn tới RCE) đi qua `vitest@3.2.7`; **moderate** vitest/@vitest/mocker (GHSA-82fw-gwwq-j7x9), uuid 8.3.2 qua autocannon (dev); **low** esbuild 0.27.7 (chỉ Windows). Tất cả là dev, không vào bundle production. Ngoài phạm vi Localman: `react-router@6.30.6` (2 moderate) nằm trong UI inspector của Tunelo CLI và được bundle vào bản publish. | Nâng `vitest` lên ≥4.1.11 (major) và `esbuild` lên ≥0.28.1. Báo team Tunelo nâng `react-router-dom` lên ≥7.18. |
| L7 | `apps/web/vite.config.ts:66-76`, `apps/web/index.html` | Bản build có **ba** script inline (theme, xoá markup prerender, loader trì hoãn app) nhưng plan bước 3 chỉ nêu hai. Hash của loader đổi theo mỗi build (vì chứa tên asset). CSP thiếu hash này thì app không tải, còn nếu ai đó "chữa" bằng `'unsafe-inline'` thì mất lớp chống XSS. | Ở review infra, sinh CSP từ `dist/index.html` sau mỗi build cho cả ba script, và sửa câu "cả hai" trong plan. |
| L8 | `.github/workflows/ci.yml:23-55` | Action được ghim bằng tag (`@v4`), không ghim SHA. `permissions: contents: read` đã đúng. | Ghim SHA cho `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` và `actions/upload-artifact`. |

Ghi chú về quyền riêng tư, không tính là finding: `mock.lookupInvitee` cho phép bất kỳ owner nào tra từ email ra username, tên và avatar (20 lượt mỗi giờ mỗi owner, tạo thêm tài khoản thì được thêm lượt). Docs ghi đây là chủ ý để owner nhận ra tài khoản giả. Nếu cần siết, chỉ trả thẻ tài khoản khi email đã xác minh.

---

## Phụ thuộc hạ tầng (kiểm khi review `infra/localman/**`)

Code đúng nhưng chỉ an toàn khi hạ tầng làm đúng các điểm sau:

1. **Real IP sau Cloudflare:** `localman.hoandat.com` chạy qua proxy Cloudflare. nginx phải có `set_real_ip_from` (dải IP Cloudflare) với `real_ip_header CF-Connecting-IP`, và gửi `X-Forwarded-For $remote_addr`. Nếu thiếu, giới hạn `/auth/login` (20/phút), form góp ý (5 lượt mỗi 10 phút) và lời mời đều đếm chung theo IP edge của Cloudflare, nên một người có thể khoá cả hệ thống.
2. **Header bảo mật cho SPA tĩnh:** helmet chỉ phủ response của API. HTML của web (do nginx phục vụ) cần CSP (`frame-ancestors 'none'`, hash ba script inline, Turnstile ở `script-src` và `frame-src`), HSTS và `X-Content-Type-Options`. `*.tunnel.hoandat.com` cùng site và chứa HTML tuỳ ý của người dùng Tunelo, nên thiếu `frame-ancestors` là mở đường clickjacking từ một site cùng site.
3. `proxy_set_header X-Forwarded-Host ""` (hoặc `$host`) cho mock runtime; `limit_req` và `limit_conn` cho `*.localman` và `/m/`; định tuyến `/m/` tới cổng 4100.
4. Firewall đóng 4000 và 4100 từ bên ngoài, hoặc làm M3.
5. Access log không chứa token mời (L3).

---

## Đã kiểm, không có vấn đề

**Template engine (`packages/shared/src/json-template*.ts`, `json-value.ts`, `resource-templates.ts`, `faker-methods.ts`)**
- Chỉ thay khi **cả chuỗi** là một tham chiếu, không có nội suy. Biến tra bằng `Map` do caller truyền vào, method Faker tra bằng `Map` whitelist (`faker-methods.ts:46-58`), nên `$constructor`, `$__proto__.x` và `$helpers.fake` không gọi được gì. Lúc lưu, tham chiếu lạ bị 400; lúc render, nó giữ nguyên chữ.
- Object được dựng lại bằng `Object.fromEntries`. `checkJson` từ chối `__proto__`, `constructor`, `prototype` ở mọi tầng và chỉ nhận plain object.
- DoS đã được chặn: lúc lưu, độ sâu tối đa 10, tối đa 2.000 node, tối đa 200 tham chiếu Faker, và record xấu nhất được ước lượng ≤ 32 KB. Lúc render, byte được đo ngay trong khi sinh, có trần độ sâu, và trần 2 MB cho response (`render-response.ts:134-147`). `$mockData` lặp nhiều lần vẫn bị tính đủ byte.
- Các runner Faker gọi tĩnh với tham số cố định (`helpers.multiple` chỉ dùng hằng).

**Query engine (`mock-runtime/query-engine.ts`, `query-match.ts`)**
- Key bắt đầu bằng `$`, chứa `.`, `[` hoặc `]`, các key `__proto__`/`constructor`/`prototype` và giá trị lặp đều bị 400 trước khi chạm DB. Tên trong `sortBy` qua cùng bộ lọc. Đọc field dùng `Object.hasOwn`. Filter chỉ nhận field có trong schema.
- Truy vấn Mongo chỉ dựng từ cột hệ thống (`resourceId`, `parentRecordId`, `id` dạng chuỗi lấy từ path). Ghi bằng driver với cả `data` (`crud-handlers.ts:85-122`), nên key người dùng không thành toán tử hay đường dẫn.
- Regex `NUMERIC_TEXT`, `HEADER_NAMES`, `RECORD_ID_PATTERN` và `CONTACT_EMAIL_PATTERN` đều tuyến tính, không có ReDoS. Express 5 dùng query parser "simple".

**Auth và OIDC (`modules/auth/*`, `http/cookies.ts`, `http/internal-path.ts`, `http/csrf-guard.ts`)**
- Có `state`, `nonce` và PKCE S256 (`oidc-client.ts:116-151`). Transaction lưu ở server, gắn với cookie handle 256 bit; chỉ bị tiêu khi `state` khớp (`login-transaction.ts:67-85`). Cấp phiên mới ở mỗi lần đăng nhập (chống fixation).
- `returnTo` và link thông báo được chuẩn hoá như trình duyệt (dot segment, `%2e`) rồi kiểm lại. Các trường hợp `//`, `/\`, ký tự điều khiển, backslash và khác origin đều bị chặn; không phải chuỗi thì về mặc định.
- Cookie: `__Host-lm_session` có HttpOnly, Secure, SameSite=Strict, Path=/. `__Host-lm_login` dùng Lax. Prefix `__Host-` chặn cookie tossing từ subdomain cùng site (mock, tunnel).
- CSRF: mọi method khác GET, HEAD, OPTIONS phải có `Origin` thuộc danh sách cho phép hoặc `Sec-Fetch-Site: same-origin`, và guard chạy trước khi đọc body. Danh sách miễn so khớp chính xác, nên biến thể path (hoa thường, `/` cuối) bị từ chối. Không có route GET nào gây thay đổi trạng thái. Body không phải JSON bị 415.
- Back-channel logout dùng JWKS, kiểm `alg` ES256, `iss`, `aud`, `typ`, `iat` trong 120 giây, có event, không có `nonce`, cần `sid` hoặc `sub`, và ghi `jti`. Gửi lại chỉ đăng xuất thêm một lần, vô hại.
- Audit SET: Basic so khớp constant-time qua digest, ES256, `typ`, `aud` là URL đầy đủ, `iat` và `exp - iat` ≤ 15 phút, đúng một event có prefix, idempotency theo `jti`.
- Token cipher dùng AES-256-GCM với IV ngẫu nhiên 12 byte, tag 16 byte, AAD là id phiên, keyring có kid để xoay khoá. Phiên lưu SHA-256 của cookie.
- Refresh có lease và khoá trong process; `invalid_grant` thì xoá phiên. Lỗi không bao giờ chứa token.

**Rate limit và proxy**
- Mock runtime giới hạn theo IP (IPv6 gộp /64), theo secret, theo lượt ghi và theo byte, và chạy trước khi đọc body. Preview và accept lời mời giới hạn theo tài khoản và IP. Form Pro và form liên hệ giới hạn theo IP và tài khoản, có honeypot và Turnstile (production bắt buộc, từ chối secret thử nghiệm, kiểm `hostname` và `action`, lỗi siteverify thì chặn). `/auth/login` giới hạn 20/phút mỗi IP.
- `TRUST_PROXY`: giá trị `true` bị từ chối, production không nhận số hop, và giá trị được kiểm bằng `proxy-addr`. Với `loopback`, `proxy-addr` lấy IP không tin cậy ngoài cùng bên phải, nên `X-Forwarded-For` giả do client thêm vào không vượt được giới hạn (dù nginx dùng `$remote_addr` hay `$proxy_add_x_forwarded_for`). `X-Forwarded-Host` giả chỉ chọn được secret, việc mà client vốn đã làm được qua `/m/{secret}`; dashboard không đọc `hostname`.

**CORS**
- Dashboard không có header CORS nào: không phản chiếu origin, không có `Allow-Credentials`, và preflight trả 404. Trình duyệt chặn mọi lượt đọc cross-origin; đây là mức chặt nhất, chặt hơn "chỉ cho origin app".
- Mock runtime trả `Access-Control-Allow-Origin: *`, không bao giờ kèm credentials. Header được hỏi chỉ được phản chiếu khi khớp regex token và dài ≤ 1024.

**Phân quyền (`operations/registry.ts`, 50+ operation)**
- Mọi operation không công khai có `scopes: [USER_SCOPE]`. Chỉ `submitProInterest`, `getProInterestFormConfig` và `submitContactMessage` là công khai, có chủ ý.
- Các operation project, resource, collaborator và magic link đều qua `requireProject(sub, action, projectId)`: không đọc được thì 404, không đủ quyền thì 403. Resource được tìm trong danh sách resource của project (`findResource`), nên không có IDOR chéo project. `parentId` và `childId` cũng phải thuộc project. Collaborator lọc theo `projectId`. Notification lọc theo `userSub`. Xoá push subscription lọc theo `userSub`.
- Admin dùng `guard: ownerOnly` (`OWNER_SUBS`), chạy trước khi parse input. Biểu thức lọc email của admin đã được escape. Export CSV có chống formula injection.
- Collaborator không xem được email và lời mời đang chờ, và chỉ xoá được dòng của chính mình. Token mời lấy project từ token đã lưu, không từ request.
- MCP: chưa có MCP server chạy thật (phase 17); `mcp: true` mới chỉ là descriptor. Khi dựng server, phải truyền `clientIp` và chính sách token như plan đã ghi.

**Secret, PII, log và lỗi**
- Request log không ghi header, cookie, body hay query. Secret trong path được che (`mockRouteOf`; prefix nằm trong `segments`, nên phép so độ dài luôn khớp với `/m/…`). Log lỗi chỉ có method và request id.
- pino redact `authorization` và `cookie`. Mongo URI được che. Token Telegram không xuất hiện trong log. Không có secret thật nào được commit: chỉ có `.env.example`, và quét pattern AWS, PEM, `ghp_`, token bot, URI Mongo có mật khẩu không ra kết quả nào.
- Lỗi không lường trước trả 500 `INTERNAL_ERROR` không kèm stack, ở cả hai server (`error-handler.ts`, `mock-router.ts:139-163`).
- Có helmet ở cả hai server (mock dùng CORP cross-origin) và `x-powered-by` bị tắt. Body mặc định giới hạn 100 KB; route 2,5 MB kiểm phiên trước khi đọc body. Độ sâu và số node JSON được giới hạn bằng `checkJson`.
- Endpoint Web Push chỉ nhận host của dịch vụ push (`push-operations.ts:19-36`), nên không có SSRF.

**Web (`apps/web`)**
- Không dùng `dangerouslySetInnerHTML`, `innerHTML` hay `eval`. Link ngoài đi qua `safeExternalUrl` (chỉ http và https) và `openExternal` (`noopener,noreferrer`). Link thông báo được kiểm cùng origin ở cả app (`inAppPath`) lẫn service worker. Avatar chỉ nhận `https://` và đặt `referrerPolicy="no-referrer"`.
- Thẻ `<meta name="referrer" content="strict-origin">` giữ token mời không lọt qua referrer. Prerender chạy lúc build từ landing tĩnh, không có dữ liệu người dùng.
- Form liên hệ gửi `source` là khu vực app, không gửi đường dẫn, nên không lộ token.

**Thay đổi chưa commit:** request log, `ProjectActivity` (gộp theo lô, chỉ ghi project còn sống), `TombstoneSweeper`, script cleanup (mặc định dry run, `--days` từ 1 tới max, kiểm lại trước khi xoá), bundle script, CI (`permissions: contents: read`) và fake IdP nhiều tài khoản (chỉ dùng trong test, không nằm trong bundle production). Không có vấn đề bảo mật mới.

---

## Việc cần làm (T5)

1. H1: chặn field quan hệ trùng lặp khi lưu, và gom nguồn kèm kiểm `dataBytes` trước khi nạp quan hệ.
2. H2: chốt phương án với user, khuyến nghị dòng chặn `removed`, rồi sửa `joinWithMagicLink`, `ineligibility` và `memberSeats`.
3. M1: rate limit theo tài khoản cho operation destructive và operation có body lớn.
4. M3: `LISTEN_HOST=127.0.0.1` ở production.
5. M2: hỏi user (đây là quyết định đã ghi trong docs).
6. Các mục Low và phụ thuộc hạ tầng chuyển sang review infra và backlog.

## Chỉ số

- Test, lint, typecheck: **không chạy** theo chỉ dẫn (không chạy test nặng). Finding được xác minh bằng đọc code, chưa có test tái hiện.
- `pnpm audit --prod`: 0. `pnpm audit` đầy đủ: 8 (2 critical, 5 moderate, 1 low), đều là dev hoặc ngoài Localman.

## Câu hỏi còn mở

- H2: chọn dòng chặn `removed` (khuyến nghị) hay tự thu hồi magic link khi xoá thành viên?
- M2: giữ cách gắn lời mời vào tài khoản chưa xác minh email (quyết định hiện tại) hay chuyển sang chỉ gắn email?
- Plan bước 3 vẫn còn câu "Đăng ký webhook bằng `setWebhook` sau khi deploy", mâu thuẫn với dòng vừa sửa "không có webhook". Cần sửa cho nhất quán.

Status: DONE_WITH_CONCERNS
Summary: Audit xong; không có Critical, có 2 High phải sửa trước production (DoS bộ nhớ qua field quan hệ trùng lặp ở mock runtime; thành viên bị xoá vào lại được qua magic link), 3 Medium và 8 Low. `pnpm audit --prod` sạch.
Concerns: Finding chỉ được xác minh bằng đọc code, chưa có test tái hiện. H2 và M2 cần user quyết vì đổi hành vi mà người dùng thấy. Nhiều biện pháp phòng vệ (real IP sau Cloudflare, CSP và frame-ancestors, firewall) nằm ở `infra/localman/**`, chưa được review.
