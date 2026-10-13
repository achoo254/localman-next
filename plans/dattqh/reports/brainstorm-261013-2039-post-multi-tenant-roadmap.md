# Localman sau đợt multi-tenant: việc dở, khoảng trống, nợ kỹ thuật và thứ tự ba đợt tới

Ngày 13/10/2026. Chỉ rà soát, chưa sửa code. Thứ tự đợt do Jev chọn (mục "Validation Log").

## Hợp đồng

- **Outcome:** có danh sách việc dở, khoảng trống tính năng và nợ kỹ thuật kèm bằng chứng, cùng thứ tự 3 đợt tới đã được Jev chọn, để `ak:plan` lập plan cho đợt 1.
- **Constraints:** ưu tiên có người dùng thật trước hạ tầng hoàn hảo; mọi phase phải qua `pnpm lint && pnpm typecheck && pnpm test && pnpm check:mcp-coverage`; mỗi module xong làm SAST, sau deploy làm DAST; deploy, publish npm, mở `/claim` của IdP cần user xác nhận.
- **Non-goals:** sửa code, deploy, đổi trạng thái plan trong đợt rà này. Tunelo chỉ ghi lại, không xếp ưu tiên.
- **Acceptance:** mỗi phát hiện có đường dẫn tệp, commit hoặc run CI; thứ tự đợt có xác suất của Jev.

## 1. CI trên `main` đang đỏ (việc gấp nhất)

- 59 run gần nhất trên `main`: 5 thành công, 33 thất bại, 21 bị huỷ (bị run mới thay thế). Run xanh cuối cùng là `fecd1dc` (12/10).
- Unit test đều qua (4738/4738, 658 tệp). Các test unit chập chờn hôm 12/10 đã được sửa ở `6dd3c79`, `f76fb3b`, `bd7bca8`, `3eb9a1e`, `1ab6185`.
- E2E `e2e/specs/traffic-request-log.spec.ts:58` hỏng ở cả 3 run từ đợt multi-tenant (run 38375335853, 38384520888, 38388105964): `getByText("Couldn't replay this request")` khớp 2 phần tử. Lỗi lặp lại ở mọi run, nên đây là hồi quy thật chứ không phải test chập chờn. Code request log đổi trong đợt này (`request-log-service.ts` đổi 93 dòng, `request-log-capture.ts`, `request-log-trim.ts`). **Chưa chứng minh nguyên nhân.**
- E2E `collaboration` (magic link mời người thứ ba) hỏng 1/3 run với `page.waitForURL: Test ended`, nhiều khả năng là test chập chờn.

## 2. Việc còn dở trong `plans/dattqh`

Còn 230 mục `- [ ]`: Localman core 128, DevOps 88, Tunelo tài khoản 11, central auth 2, UI review 1.

| Plan | Còn lại |
|---|---|
| Localman core | Phase 01 (T4, T5), 10 (T8: tự nhận tunnel theo tài khoản, đang chờ Tunelo), 17 (kiểm thủ công), 19 (T9 deploy staging). Chưa bắt đầu: 14 fork/merge/comment, 15 chia sẻ công khai, 16 Live Mock Sync, 18 MCP cho API client, 21 client power-ups, 22–23 extension |
| Central auth | Phase 03: T7 và E2E trên production; Localman chưa liệt kê tunnel theo tài khoản |
| DevOps toolkit | Cả 7 phase `pending`, chưa có commit |
| i18n | CLS 0.107 trên landing, rà câu chữ tiếng Việt, từ "request" trong bản zh-CN (`plan.md:36-38`) |
| UI review heavy data | Owner duyệt UI, xoá project test, quyết định hoàn Pro (`plan.md:44`) |
| Tunelo (ghi lại) | Tài khoản phase 03: cutoff token ẩn danh, `tunelo-v2.0.0`; web console phase 04: đăng nhập thật Google/GitHub |

**Multi-tenant không có plan riêng.** Phần còn lại theo `docs/decisions/0003-tenant-scoped-data.md` và `docs/deployment-guide.md`:
- Chế độ tenant đã bật trên production 13/10, nhưng chưa có tenant nào ngoài hoandat.com vì IdP chưa mở `/claim` (`docs/deployment-guide.md:132`).
- Chưa có e2e hai tenant: `grep tenant e2e/specs e2e/support` không ra kết quả nào, dù ADR ghi sẽ làm tiếp (`0003…md:4`).
- Tenant khác chưa có Turnstile (form công khai chỉ nhận người đã đăng nhập) và không nhận thông báo Telegram (`0003…md:` mục 8).
- Rate limit theo IP và cache trong bộ nhớ vẫn giả định chỉ chạy một process.

**Trạng thái lệch với git:** frontmatter phase 01–10 của Localman core ghi `pending` trong khi bảng `plan.md` ghi `completed`; phase 13 đã deploy (`702c1cb`, `fecd1dc`) nhưng frontmatter ghi `in-progress`; `central-auth/plan.md:106` ghi đăng nhập im lặng "chưa commit", trong khi git đã có `d11b992`; phase 03 của Tunelo vẫn nhắm 1.7.0, trong khi npm đã lên 1.9.0; ADR 0003 dòng 4 và 13 chưa cập nhật (nginx đã làm ở `0e54c9c`, thư mục tenant đã hỏi IdP).

## 3. Khoảng trống tính năng so với README và docs

Đã có code thật: mock API (resource lồng, Faker, rules, chaos), Hosted Mock MCP, Localman MCP `/mcp`, operation registry (khoảng 154 operation), webhook inbox, replay, callbacks, collections, environments, workspace, chia sẻ phần tử, multi-tenant.

Chưa có code: Collection Runner và CLI `localman`, mock tạm có TTL, API monitor, `localman.yaml`, đồng bộ env/secret, fork/merge/PR/comment, chia sẻ công khai (guest, nút Run, access key), Live Mock Sync (chỉ có section landing bị ẩn), chaining không cần script, docs tự sinh, browser extension.

README sai 3 chỗ:
- `README.md:15`: viết `deploy.sh` mặc định build với danh sách cờ rỗng, nhưng thực tế đọc `infra/localman/released-features` (6 cờ).
- `README.md:19`: viết "chưa có server MCP chạy", nhưng `apps/api/src/main.ts:159` đã mount `/mcp`.
- `README.md:17`: cờ `directMode` không điều khiển gì (`apps/web/src/config/feature-flags.ts:19`).

## 4. Nợ kỹ thuật

- **Tệp quá 200 dòng:** Localman có 11 tệp. 10 tệp là test hoặc từ điển i18n, chỉ một tệp nguồn là `packages/operations/src/openapi.ts` (209 dòng). Tunelo có 8 tệp, lớn nhất là `packages/tunelo-cli/src/tunnel-client.ts` (403 dòng) và `apps/tunelo-server/src/tunnel-manager.ts` (376 dòng). Không có kiểm tra tự động cho giới hạn 200 dòng.
- **Test chập chờn:** xem mục 1. Unit test đã ổn từ 12/10. E2E còn 1 hồi quy và 1 test chập chờn.
- **Cảnh báo trong log CI không làm hỏng run:** `tunelo-cache-serve ERR_INVALID_CHAR`; test `generate_all performance` chạy 2153–3076 ms, sát hoặc vượt ngưỡng 3000 ms trên runner chung.

## 5. Thứ tự đề xuất (Jev chọn S2)

| Đợt | Nội dung | Tier |
|---|---|---|
| 1 | **CI xanh** (chẩn đoán và sửa hồi quy e2e request log, ổn định e2e magic link, sửa 3 chỗ README, ADR 0003, frontmatter plan), sau đó **chia sẻ công khai** (Localman phase 15: public workspace, guest, nút Run, access key) | S rồi L |
| 2 | **Runner và CLI** (DevOps 01 danh tính máy và audit, DevOps 02 Collection Runner, CLI `localman`, template CI). Publish npm cần user xác nhận | L |
| 3 | **Hoàn tất multi-tenant** (e2e hai tenant, Turnstile và Telegram cho tenant khác, Localman liệt kê tunnel theo tài khoản). Làm sớm hơn ngay khi IdP mở `/claim` | M–L |

Backlog sau ba đợt: Live Mock Sync (16), fork/merge/comment (14), MCP cho API client (18), client power-ups (21), extension (22–23), DevOps 03–07, việc còn lại của i18n và UI review, cutoff của Tunelo. Các tệp quá 200 dòng được tách khi có việc chạm tới chúng, không lập thành mục riêng.

### Trade-offs

- **S2 (đã chọn):** dựa nhiều nhất vào giả định chia sẻ công khai kéo được người dùng mới. Sẽ hỏng trước tiên nếu IdP mở `/claim` trong lúc làm đợt 1–2, vì khi đó tenant thứ hai chạy mà không có e2e, Turnstile và Telegram. Cách giảm rủi ro: đặt mở `/claim` làm điều kiện kéo P2 lên làm ngay.
- **S3 (Runner trước):** dựa vào giả định người dùng hiện có cần chạy collection trong CI. Sẽ hỏng trước tiên nếu chưa có người dùng nào dùng collection đủ nhiều để cần chạy trong CI.
- **S1 (multi-tenant trước):** an toàn nhất nếu có tenant mới, nhưng đầu tư vào trường hợp chưa xảy ra. Jev cho 0.03.

Better approaches: không có. Hướng đã chọn đúng là thứ tự được yêu cầu chọn. Bằng chứng: Jev nghiêng về S2, và S2 khớp quy tắc "có người dùng trước" trong memory của dự án.

## Validation Log

Gọi `jev-latest` (`jev-1.13.0`), ngày 13/10/2026. State gồm các sự thật đã kiểm ở mục 1–4.

| Câu hỏi | Kết quả | Xác suất |
|---|---|---|
| Thứ tự 3 đợt | **S2**: P1 rồi chia sẻ công khai, sau đó Runner/CLI, cuối cùng multi-tenant | S2 0.47 · S3 0.25 · S4 0.25 · S1 0.03 (confidence 0.29) |
| Gói làm đầu tiên sau khi CI xanh | **P4** chia sẻ công khai | P4 0.38 · P2 0.32 · P3 0.25 · P5 0.05 (confidence 0.17) |
| Hoãn hoàn tất multi-tenant tới khi IdP mở `/claim` | Có | 0.85 |
| Lập mục riêng để tách tệp quá 200 dòng | Không, tách khi có việc chạm tới | 0.20 |

Độ tin cậy của câu thứ tự và câu gói đầu tiên thấp: P2 chỉ kém P4 0.06. Vì vậy điều kiện "IdP mở `/claim` thì kéo P2 lên" là một phần của quyết định, không phải chú thích.

## Cập nhật cùng ngày: đã xử lý (chưa commit, chưa deploy)

**Hai lỗi CI, đã chứng minh nguyên nhân:**
- E2E request log là lỗi của test, app chạy đúng. Sau khi toast hiện, Radix chèn một vùng `aria-live` chứa cùng câu chữ, tồn tại khoảng 60–1000 ms. Probe đo được 2 phần tử khớp trong khoảng đó, 1 phần tử trước và sau. Máy local nhanh nên lần kiểm đầu rơi vào khoảng có 1 phần tử; CI chậm nên rơi vào khoảng có 2 phần tử. Sửa: `getByText(…, { exact: true })` (Jev 0.98).
- E2E magic link lộ ra một lỗi app thật: cuộc đua của đăng nhập im lặng. Landing gọi `/users/me`. Nếu khách bấm "Sign in" trước khi lời gọi trả về, callback đặt cookie `lm_sso_hint`. Lời gọi 401 về muộn sau đó đọc cookie lúc ấy, chạy `prompt=none` với `returnTo=/`, và lần chuyển này huỷ chuyển hướng tới `/projects`. Trace CI cho thấy đúng thứ tự này. Sửa: `use-current-user.ts` đọc cookie lúc lời gọi bắt đầu, kèm test hồi quy (test này hỏng khi bỏ phần sửa). Helper e2e `signIn` chờ `/users/me` trả lời rồi mới bấm (Jev chọn "cả hai", 0.50, so với "chỉ sửa app" 0.49).
- Ba spec liên quan chạy `--repeat-each=3`: 12/12 qua.

**Docs và plan:** README (trạng thái tính năng theo `released-features`, `/mcp`, bỏ `directMode` và bảng giá), ADR 0003 (trạng thái và thư mục tenant), frontmatter 13 phase của Localman core theo bảng `plan.md`, plan central auth (đăng nhập im lặng đã deploy).

**Production (đo 13/10 tối, chỉ đọc):**
- Release `20261013-110155-cbd7436e9f93` đã có đăng nhập im lặng (`d11b992`) và nginx cho tenant (`0e54c9c`). Cả hai healthz trả `db: connected`.
- `localman-api` có 32 lần restart. Tất cả là `SIGINT` với exit code 0 (deploy hoặc reload), không phải crash; uptime 2 giờ, 214 MB.
- **Có 2 tenant:** `primary` (1 user, 8 project) và một tenant thứ hai (1 user, 1 project). Hai user có cùng email, nên đây là owner thử domain của chính mình. **Ngoài owner chưa có người dùng nào.** Dữ kiện "chưa có tenant nào ngoài hoandat.com" ở mục 5 vì thế không còn đúng.
- `tunnel.inetdev.io.vn` không còn block riêng trong `tunelo.conf`. Domain này được phục vụ như tenant qua regex `tunnel.(?<tenant>.+)` (đúng `0e914b5`).
- Không đo được số lượt `prompt=none` từ access log, vì nginx bỏ query string khi ghi log.

**Jev hỏi lại với dữ kiện đã sửa:** giữ thứ tự (multi-tenant ở đợt 3) có xác suất 0.54, gần như năm ăn năm thua. Owner nên chốt câu này.

**User chốt (13/10):** giữ thứ tự ba đợt (Jev 0.54). Commit, push và deploy bản sửa, dù Jev nghiêng về chỉ commit và push (0.70; deploy 0.23).
