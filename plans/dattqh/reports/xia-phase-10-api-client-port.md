# Xia port phase 10: API client (lõi gửi request và proxy)

Ngày 2026-10-09 (Asia/Saigon). Việc T1 của `plans/dattqh/261008-1123-localman-core/phase-10-api-client.md`. Chỉ đọc code: repo cũ `../localman` (commit `ff94634`) và `localman-next` ở trạng thái làm việc hiện tại (phase 19 đang review, chưa commit).

## 0. Quyết định đã chốt (ghi lại, không hỏi lại)

- Làm phase 10 ngay theo yêu cầu user (vòng 27 của Validation Log), trước đợt 4 (plan Tunelo theo tài khoản).
- **T8 tách làm hai:** T8a làm ngay (phát hiện host local, thử gửi thẳng localhost, panel Tunelo với `tunelo http <port>`, gợi ý bật CORS, cảnh báo lộ dịch vụ local, dán URL tunnel thủ công với ánh xạ riêng từng user, sửa ánh xạ trong Settings). **T8b hoãn** tới khi xong plan Tunelo: tự nhận tunnel qua `GET /api/tunnels`, liên kết máy ẩn danh (`/api/links/init`, `/api/links/poll`, token AES-256-GCM), chọn khi có nhiều tunnel, báo Basic Auth và TCP, tunnel đã dừng.
- Logic thuần dùng chung web và server (tool MCP `send_request`) đặt ở `packages/shared/src/api-client/*`, xuất qua subpath `@localman/shared/api-client`. Phần phụ thuộc DOM (fetch thẳng, Worker, File) ở `apps/web/src/platform/*` và `apps/web/src/features/api-client/*`.

## Quyết định AI tự chốt ở bước xia (có lý do, có thể đảo nếu user muốn)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Proxy là operation `client.sendRequest`, `POST /api/v1/proxy`, `mcp: true` (tool `send_request`), `bodyLimit` 15 MiB | Quy tắc registry: không viết route Express tay. Tool MCP có sẵn từ phase 10, phase 18 chỉ bổ sung (localhost qua tunnel, scope). Đường dẫn nằm dưới `/api/v1` như mọi operation, khác chữ `POST /api/proxy` trong plan |
| D2 | History lưu **bản nháp có `{{var}}`**, không lưu giá trị đã nội suy, không lưu body response | Giữ keyword "Secret không rời trình duyệt": server không bao giờ thấy secret qua history. Trình duyệt ghi history sau mỗi lần gửi (cả gửi thẳng lẫn proxy); MCP `send_request` tự ghi envelope do agent gửi |
| D3 | Ba collection Mongo theo `sub`: `client_history` (TTL 90 ngày, tối đa 500 dòng/user), `client_drafts` (tối đa 50 tab/user, file binary chỉ lưu tên), `client_settings` (host đã nhớ, ánh xạ tunnel) | Thay Dexie; prototype ghi rõ "History lưu trên server theo tài khoản" và ánh xạ "riêng cho bạn". Hằng số đặt ở `packages/shared/src/api-client/limits.ts` (không phải hạn mức gói nên không vào `plan-limits.ts`) |
| D4 | Không thêm Zustand và Dexie. Server state qua TanStack Query; trạng thái tab và response theo tab dùng `useReducer` trong `WorkbenchProvider` | Repo mới đã có TanStack Query; store cũ giữ một response toàn cục, prototype cần response theo tab |
| D5 | Script API là `lm.*` (`lm.environment`, `lm.variables`, `lm.test`, `lm.expect`, `lm.response`), **không** alias `pm.*` | Vòng 11 loại "Postman script shim" (0.24). Prototype đang ghi snippet `pm.*`; UI dùng `lm.*`. Xem câu hỏi Q2 |
| D6 | Phần `lm` (test, expect, biến) viết bằng JS chạy **bên trong** QuickJS (prelude), host chỉ đưa vào JSON và đọc ra JSON | Sửa 2 lỗi của bản cũ (mục 4.4) và bỏ việc giữ handle qua callback |
| D7 | Snippet: giữ đúng 16 generator cũ (có Java HttpURLConnection, không có "Node.js - http" như prototype) | Plan ghi "16 snippet giữ nguyên"; chỉ lệch nhãn với prototype |
| D8 | Import: cURL, Collection v2.1, OpenAPI 3.0 (JSON), môi trường dạng v2.1. Phase 10 chưa có collection (phase 12) nên import mở request thành tab qua hộp chọn (`collection-open-picker`), mặc định chọn tất cả nếu ≤ 20. Export: cURL (snippet), Collection v2.1 và OpenAPI 3.0 của các tab đang mở | Đủ phạm vi "Import/export cURL, Postman v2.1, OpenAPI 3.0" mà không làm trước model của phase 12. Bỏ định dạng "native" và backup của repo cũ |
| D9 | Nhãn định dạng trên UI là "Collection v2.1"; mọi tên `postman` (type, URL schema) chỉ nằm trong `packages/shared` | `pnpm check:i18n` chặn chữ `postman` trong literal của `apps/web/src`. Xem câu hỏi Q3 |
| D10 | Biến khi mở tab từ collection (import hay từ mock): biến collection được thay thẳng vào nội dung lúc mở; `mock-to-collection` ở phase 10 ghi URL mock tuyệt đối | Phase 10 chưa có environment (phase 13). Phase 12/16 chuyển sang `{{baseUrl}}` + environment |
| D11 | Trang Settings mới `/settings` (tab Tunelo, Định tuyến) theo prototype `#/settings`; không đưa tab MCP và Thông báo vào (đã có ở chỗ khác) | Plan T8 đã nêu `apps/web/src/pages/settings/` |
| D12 | `undici@^7.30` (không dùng 8.x) | `undici` 8 cần Node ≥ 22.19, repo khai `engines.node >= 22.12` và `setup-server.sh` kiểm 22.12 |

---

## 1. Dependency matrix

### 1.1 Module cũ → nơi mới

| Module cũ (`../localman`) | Dòng | Nơi mới | Đổi gì | Cách |
|---|---|---|---|---|
| `client/src/types/{enums,common,models,response}.ts` | 191 | `packages/shared/src/api-client/{request-model,request-schema,response-model}.ts` | Model theo prototype: body `none/raw(lang)/urlencoded/formdata(text,file)/binary`, auth `inherit/none/bearer/basic/apikey(header,query)`, header là mảng có thứ tự (giữ header trùng tên), settings `followRedirects/timeoutMs/sendClientIp/route`. Bỏ `oauth2`, `form`/`xml`/`json` thành `raw` + `language` | Viết lại theo model mới |
| `services/interpolation-engine.ts` + `dynamic-variables.ts` | 111 | `api-client/variable-interpolation.ts`, `dynamic-variables.ts` | Scope dạng mảng có thứ tự (phase 13 cắm vào), trả thêm `secrets: string[]` (tên biến `type=secret` đã dùng) | Port + mở rộng |
| `services/request-variable-extractor.ts` | 89 | `api-client/extract-variables.ts` | Bỏ việc bỏ qua body > 100 KB khi dùng để dò secret (bỏ qua là âm thầm chuyển secret sang proxy) | Port + sửa |
| `utils/url-params.ts` | 36 | `api-client/url-params.ts` | `newId` của Dexie thành tham số | Port |
| `services/auth-handler.ts` | 35 | `api-client/auth-headers.ts` | Thêm API key vào query; `btoa` lỗi với ký tự ngoài Latin-1 (mật khẩu tiếng Việt) → base64 UTF-8; bỏ oauth2 | Port + sửa |
| `services/request-preparer.ts` | 119 | `api-client/request-preparer.ts` + `multipart-encoder.ts` | Bản cũ ném lỗi với form-data và không có binary; header thành mảng; trả `secretsUsed` | Port + mở rộng |
| `services/http-client.ts` | 202 | Tách: `apps/web/src/platform/direct-fetch.ts`, `features/api-client/api/proxy-api.ts`, `features/api-client/response/set-cookie-parser.ts` | Bỏ nhánh "localhost thì fetch thẳng", bỏ Firebase token, bỏ header `X-Upstream-*` (thay bằng envelope JSON) | Viết lại, giữ `parseSetCookie` |
| `backend/src/proxy.ts`, `index.ts`, `auth.ts` (Fastify, Firebase) | 210 | `apps/api/src/modules/api-client/{proxy-operation,proxy-forwarder,proxy-headers,ssrf-guard,proxy-timings,proxy-response-body,proxy-quota}.ts` | Bản cũ không chặn SSRF, header là object (mất thứ tự và header trùng), không timeout, không giới hạn body, không giải nén, `X-Upstream-Headers` có thể vượt giới hạn header | Viết lại trên registry + `undici` |
| `services/script-sandbox/{types,script-runner,sandbox-worker,assertion-lib}.ts` | 400 | `api-client/script-sandbox/{script-types,script-prelude,run-script}.ts` (thuần, nhận module QuickJS qua tham số) + `apps/web/src/platform/script-host.ts` + `features/api-client/scripts/script-worker.ts` | Thêm giới hạn bộ nhớ, stack, interrupt; sửa `expect` và `test` (mục 4.4) | Port + sửa |
| `services/snippet-generators/*` (16 + registry + escape) | 735 | `api-client/snippets/*` | Registry tĩnh (map) thay cho đăng ký bằng side-effect import: `vite.config.ts` đánh dấu `packages/shared/src/` không side-effect nên import kiểu cũ bị tree-shake mất; header mảng; sửa escape (mục 4.5) | Port + sửa |
| `services/importers/curl-parser.ts` | 183 | `api-client/import/{curl-tokenizer,curl-parser}.ts` | Tokenizer sai ngữ nghĩa nháy đơn POSIX và không ghép đoạn liền nhau (`'it'\''s'`), nên snippet cURL do chính app sinh không import lại được | Port + sửa |
| `services/importers/{postman-importer,postman-types}.ts` | 292 | `api-client/import/{collection-v21-types,collection-v21-import,collection-v21-items}.ts` | Bản cũ bỏ `event` (script), bỏ form-data file, chép auth của cha vào request thay vì giữ "inherit", bỏ biến collection | Port + mở rộng |
| `services/exporters/postman-exporter.ts` | 151 | `api-client/export/collection-v21-export.ts` | Ghi `event` pre/post, auth inherit, biến | Port + mở rộng |
| `services/exporters/curl-exporter.ts` | 40 | (bỏ) | Trùng với `generator-curl.ts` (cùng lý do để sửa) | Dùng generator cURL |
| (không có) | — | `api-client/import/openapi-import.ts`, `openapi-example.ts`, `export/openapi-export.ts` | Repo cũ không có OpenAPI. Dùng lại `packages/shared/src/openapi-document.ts`, `openapi-ref.ts`, `openapi-schema-walker.ts` (JSON, không tải `$ref` ngoài) | Viết mới |
| `services/importers/native-*`, `exporters/native-exporter.ts`, `db/services/backup-service.ts`, `firebase-*`, `types/cloud-sync.ts` | — | (bỏ) | Định dạng riêng và cloud sync của app cũ | Không port |
| `services/import-export-service.ts` | 178 | `api-client/import/detect-format.ts` + `features/api-client/import-export/*` | Tách phát hiện định dạng (thuần) khỏi file picker và ghi Dexie | Port phần thuần |
| `stores/request-store.ts` (Zustand, 347) | 347 | `features/api-client/workbench/{workbench-reducer,workbench-context}.tsx` + `api/draft-api.ts` | Tab và nháp: reducer cục bộ, nháp tự lưu lên `client_drafts` (debounce bằng `lib/use-debounced-value.ts`) | Viết lại |
| `stores/response-store.ts` (179) | 179 | `features/api-client/routing/{send-pipeline,use-send-request}.ts` | Response theo tab; chuỗi prepare → pre-script → định tuyến → post-script → history | Viết lại |
| `stores/history-store.ts` + `db/services/history-service.ts` | 247 | `apps/api/src/modules/api-client/history-*` + `features/api-client/api/history-api.ts` | Dexie → Mongo qua operation | Viết lại |
| `db/services/draft-service.ts` | 23 | `apps/api/src/modules/api-client/draft-*` | Dexie → Mongo | Viết lại |
| `db/services/settings-service.ts`, `components/settings/proxy-settings.tsx` | 95 | `apps/api/src/modules/api-client/client-settings-*` + `pages/settings/*` | Chỉ giữ host đã nhớ và ánh xạ tunnel | Viết lại |
| `stores/{collections,environment,settings,ui-panel,auth}-store.ts`, `db/services/{collection,folder,request,environment}-service.ts`, `components/{collections,environments,docs}/*`, `layout/variables-panel.tsx` | — | Phase 12, 13, 21 | Chỉ tham khảo UI | Không port ở phase 10 |
| `utils/history-date-groups.ts` | 41 | `features/api-client/history/history-groups.ts` | Nhóm ngày theo Asia/Saigon (bản cũ theo giờ máy) | Port + sửa |
| `utils/method-colors.ts`, `status-color.ts` | 38 | `apps/web/src/lib/method-tone.ts` | Màu qua token `--c-viz-*-text`, không hex. Đã có 2 bản `METHOD_TONE` (landing, `endpoints-editor.tsx`), đây là lần thứ ba nên extract | Viết lại |

### 1.2 Component cũ → primitive mới

| Component cũ | Thay bằng |
|---|---|
| `@radix-ui/react-tabs` trực tiếp (`request-tabs`, `response-tabs`) | `components/ui/tabs.tsx` |
| `@radix-ui/react-select` (`method-selector`) | `components/ui/select.tsx` (native `<select>`) có class màu method |
| `@radix-ui/react-dialog` (`import-dialog`, `save-request-dialog`, `export-dialog`) | `components/ui/modal.tsx`, `modal-footer.tsx`, `confirm-modal.tsx` |
| `toast-provider.tsx` | `components/ui/toast.tsx` |
| `lucide-react` | `@tabler/icons-react` (đã có) |
| `react-resizable-panels`, `layout/app-layout.tsx` | Lưới CSS như prototype (`rail | sidebar | main | right`), không thêm dependency |
| `key-value-editor.tsx` (140) | `features/api-client/request/key-value-table.tsx` (port, dùng `Input`, `IconButton`, checkbox) |
| `variable-highlight-input.tsx` (162) | `features/api-client/request/variable-input.tsx` (port cách input thật + lớp tô `{{var}}`; bỏ popover biến, để phase 13) |
| `body-json-editor`, `body-raw-editor`, `script-editor` + `hooks/use-codemirror-editor.ts` (`oneDark`) | Primitive mới `components/ui/code-editor.tsx` (tổng quát hoá `json-editor.tsx`: tham số ngôn ngữ, theme token `json-editor-theme.ts`) |
| `response/json-viewer.tsx` (cây JSON) | Bỏ; Pretty là text tô màu, Preview JSON là bảng như prototype |
| `response/html-preview.tsx` (iframe `sandbox=""`) | Port nguyên |
| `response-status-bar`, `response-headers-table`, `response-cookies-table`, `test-results-panel`, `script-console` | Port, đổi sang `Badge`, bảng và token |
| `code-snippet-panel.tsx` | Modal `snippets/code-snippet-modal.tsx` với `CodeBlock` (có sao chép) |

### 1.3 Dependency cần thêm

| Package | Bản | Ở đâu | Ghi chú |
|---|---|---|---|
| `quickjs-emscripten-core` | 0.32.0 (MIT) | `packages/shared` | Chỉ phần JS; wasm do nơi chạy cung cấp |
| `@jitl/quickjs-wasmfile-release-sync` | 0.32.0 (MIT) | `apps/web` (worker), `packages/shared` devDependency (test chạy trong Node) | Một biến thể duy nhất. Không dùng meta-package `quickjs-emscripten` (kéo cả 4 biến thể debug/release × sync/asyncify, 2,4 MB). Wasm 503 KB, gzip khoảng 226 KB |
| `undici` | ^7.30 (MIT) | `apps/api` | `Agent` với `connect.lookup` để ghim IP đã kiểm; tự xử lý redirect |
| `@codemirror/lang-javascript` | ^6.2.5 | `apps/web` | Scripts. Cùng major với `@codemirror/{state ^6.7.6, view ^6.43.14, language ^6.13.1, commands ^6.11.1}` đang có |
| `@codemirror/lang-xml` | ^6.1.0 | `apps/web` | Raw XML |
| `@codemirror/lang-html` | ^6.4.12 | `apps/web` | Raw HTML (prototype có JSON/Text/XML/HTML/JavaScript) |

Không thêm: `codemirror` (meta), `@codemirror/theme-one-dark`, `zustand`, `dexie`, `dexie-react-hooks`, `firebase`, `react-resizable-panels`, `date-fns`, `lucide-react`, `react-markdown`, `@dnd-kit/*`.

**Lazy-load QuickJS:** chỉ tạo Worker (và tải wasm) khi lần gửi có script pre hoặc post khác rỗng. Worker sống qua các lần gửi, bị `terminate()` khi quá hạn. Không import gì của QuickJS từ trang; trang `/api-client` đã là chunk lazy, CodeMirror nằm trong `vendor-codemirror` như cũ. Cần kiểm lúc làm: Vite xử lý `new URL('./emscripten-module.wasm', import.meta.url)` trong worker, có thể phải thêm `optimizeDeps.exclude` cho `@jitl/quickjs-wasmfile-release-sync` khi chạy dev.

### 1.4 Test gốc mang theo

| Test cũ | Ca | Mang sang |
|---|---|---|
| `services/request-preparer.test.ts` | 3 | `api-client/request-preparer.test.ts`, thêm form-data, binary, API key query, header trùng tên, secret |
| `services/interpolation-engine.test.ts` | 5 | `api-client/variable-interpolation.test.ts`, thêm cờ secret |
| `services/request-variable-extractor.test.ts` | 13 | `api-client/extract-variables.test.ts`, đổi ca "bỏ qua body > 100 KB" thành "vẫn dò secret" |
| `utils/url-params.test.ts` | 2 | `api-client/url-params.test.ts` |
| `services/importers/curl-parser.test.ts` | 9 | `api-client/import/curl-parser.test.ts`, thêm khứ hồi với snippet cURL |
| `backend/src/index.test.ts` (Fastify inject) | 3 | Không mang được (khác framework); viết mới theo mục T10 |

Tổng chỉ khoảng 32 ca dùng được. **Repo cũ không có test cho snippet generator, import/export Collection v2.1, script sandbox và http-client**, trong khi Verification của phase ghi "port kèm test của localman cho … import-export và snippet generators". Các test đó phải viết mới (mục 2, T2b và T2c).

---

## 2. Danh sách file chốt

Mọi file kebab-case, ≤ 200 dòng, named export. Test co-located `*.test.ts(x)`.

### 2.1 File cũ phải tách vì quá 200 dòng (hoặc sát ngưỡng sau khi mở rộng)

| File cũ | Dòng | Tách thành |
|---|---|---|
| `stores/request-store.ts` | 347 | `workbench-reducer.ts`, `workbench-context.tsx`, `use-draft-sync.ts` |
| `components/layout/app-layout.tsx` | 251 | `pages/api-client/api-client-page.tsx`, `workbench/sidebar-rail.tsx`, `workbench/status-bar.tsx`, `workbench/empty-editor.tsx` |
| `services/importers/postman-importer.ts` | 210 | `collection-v21-import.ts`, `collection-v21-items.ts` |
| `services/script-sandbox/sandbox-worker.ts` | 208 | `script-prelude.ts`, `run-script.ts`, `script-worker.ts` |
| `components/request/request-tab-bar.tsx` | 203 | `tabs/tab-bar.tsx`, `tabs/tab-item.tsx` |
| `services/http-client.ts` | 202 | `platform/direct-fetch.ts`, `api/proxy-api.ts`, `response/set-cookie-parser.ts` |
| `services/importers/curl-parser.ts` | 183 | `curl-tokenizer.ts`, `curl-parser.ts` |
| `components/request/request-panel.tsx` | 180 | `request/request-editor.tsx`, `request/url-bar.tsx` |
| `stores/response-store.ts` | 179 | `routing/send-pipeline.ts`, `routing/use-send-request.ts` |

### 2.2 T2: logic thuần ở `packages/shared/src/api-client/` (chia 3 việc)

**T2a, nền (làm trước mọi việc khác):**
- `index.ts` (entry của subpath), `limits.ts` (body 10 MB, timeout mặc định 30 s, tối đa 120 s, 10 redirect, script 5 s, 32 MB, history 500, draft 50)
- `request-model.ts`, `request-schema.ts` (zod của draft, dùng cho draft và history), `response-model.ts` (response chuẩn hoá chung cho gửi thẳng và proxy), `proxy-envelope.ts` (zod input/output của `client.sendRequest`)
- `variable-interpolation.ts`, `dynamic-variables.ts`, `extract-variables.ts`, `url-params.ts`, `auth-headers.ts`, `request-preparer.ts`, `multipart-encoder.ts`
- `local-host.ts` (`isLocalTarget`: `localhost`, `*.localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0`, RFC 1918, link-local, ULA, cả dạng `127.1`, `2130706433`, hex qua bộ phân tích WHATWG URL; `localTargetKey` ra `localhost:3000`, port mặc định 80/443)
- `tunnel-url.ts` (`rewriteToTunnel` giữ path, query, fragment; `isTunnelUrl(url, domains)`)
- Test: `request-preparer`, `variable-interpolation`, `extract-variables`, `url-params`, `auth-headers`, `multipart-encoder`, `local-host`, `tunnel-url`
- Sửa `packages/shared/package.json` (export `./api-client`, dependency `quickjs-emscripten-core`, devDependency `@jitl/quickjs-wasmfile-release-sync`)

**T2b, import, export, snippet:**
- `import/detect-format.ts`, `import/curl-tokenizer.ts`, `import/curl-parser.ts`, `import/collection-v21-types.ts`, `import/collection-v21-import.ts`, `import/collection-v21-items.ts`, `import/environment-v21-import.ts`, `import/openapi-import.ts`, `import/openapi-example.ts`, `import/imported-collection.ts` (cây trung gian mà phase 12 lưu)
- `export/collection-v21-export.ts`, `export/openapi-export.ts`
- `snippets/snippet-registry.ts`, `snippets/snippet-escape.ts`, 16 generator `snippets/generator-{curl,httpie,javascript-fetch,javascript-axios,python-requests,go-native,java-httpurlconnection,java-okhttp,kotlin-okhttp,php-curl,csharp-httpclient,ruby-net-http,swift-urlsession,dart-http,rust-reqwest,powershell}.ts`
- Test: `curl-parser`, `collection-v21` (khứ hồi trên fixture thật), `openapi-import`, `openapi-export`, `snippets` (golden cho 16 ngôn ngữ + chuỗi đối kháng: `'`, `"`, `\`, `$`, backtick, `@` đầu body, xuống dòng, Unicode)

**T2c, script sandbox:**
- `script-sandbox/script-types.ts`, `script-sandbox/script-prelude.ts`, `script-sandbox/run-script.ts`
- Test `run-script.test.ts` (chạy QuickJS thật trong Node): `while(true){}` bị ngắt, cấp phát vượt bộ nhớ bị chặn, đệ quy sâu bị chặn, `lm.expect` sai làm test fail, `lm.environment.set` trả biến ra, `console.log` bị giới hạn, script lỗi cú pháp

**T9 (sau):** `mock-to-collection.ts` + test. Đặt trong `api-client/` thay vì `packages/shared/src/mock-to-collection.ts` như plan ghi, để cùng subpath. Dùng ID ổn định `mock:<resourceId>:<method>:<scope>` ngay từ đầu để phase 16 (`mock-to-collection-mapper`) mở rộng hàm này, không viết hàm thứ hai.

### 2.3 T3: proxy ở `apps/api/src/modules/api-client/`

- `proxy-operation.ts`: `client.sendRequest` (`POST /proxy`, scope `user`, `bodyLimit` 15 MiB, `mcp: true`), quota, rate limit, log metadata
- `proxy-forwarder.ts`: vòng redirect tự làm (tối đa 10, kiểm SSRF lại mỗi lần, 303 thành GET, bỏ `Authorization`/`Cookie` khi redirect sang origin khác), timeout
- `proxy-headers.ts`: bỏ hop-by-hop (RFC 9110 §7.6.1 và mọi tên liệt kê trong `Connection`), `Host` theo URL trừ khi user ghi đè, thêm `X-Forwarded-For` (nối cuối), `X-Real-IP`, `Forwarded: for=…;proto=…` theo `ctx.clientIp` (đã tôn trọng `TRUST_PROXY`)
- `ssrf-guard.ts`: `net.BlockList` (RFC 1918, loopback, link-local, CGNAT, ULA, `::ffff:` mapped, NAT64 `64:ff9b::/96`, 6to4 và Teredo, multicast, `0.0.0.0/8`, `240.0.0.0/4`, metadata), IP literal kiểm trước, `lookup` cho `undici` resolve mọi địa chỉ, có một địa chỉ bị chặn là từ chối, ghim địa chỉ đã kiểm; thêm CIDR từ env `PROXY_BLOCKED_CIDRS` (IP công khai của chính server .65)
- `proxy-timings.ts`: bọc connector của `undici` để đo dns, connect, tls; ttfb ở `onHeaders`, download tới khi đọc xong
- `proxy-response-body.ts`: đọc tối đa 10 MB, giải nén gzip/deflate/br có trần sau giải nén (chống zip bomb), `truncated`, chọn utf8 hay base64
- `proxy-quota.ts`: `limitsFor(plan).proxyRequestsPerMonth`, `incrementUsage(sub, "proxyRequests")`, 429 `MONTHLY_QUOTA_EXCEEDED`
- Test: `ssrf-guard.test.ts`, `proxy-headers.test.ts`, `proxy-forwarding.test.ts` (echo server), `proxy-operation.test.ts`
- Sửa: `apps/api/package.json` (`undici`), `apps/api/src/config/runtime-settings.ts` (`proxyRateLimit`), `apps/api/src/config/feature-env.ts` (`PROXY_BLOCKED_CIDRS`), `.env.example`
- Sửa `infra/localman/nginx/localman.hoandat.com.conf`: `location = /api/v1/proxy` với `client_max_body_size 15m`, `proxy_read_timeout 130s`; CSP `connect-src` mở cho mọi origin http(s) và `script-src` thêm `'wasm-unsafe-eval'` (mục 4.6)
- Sửa `docs/system-architecture.md` (mục Proxy của API client)

### 2.4 T4: history, draft, settings ở `apps/api/src/modules/api-client/`

- `history-model.ts`, `history-service.ts`, `history-operations.ts`: `client.listHistory` (`GET /client/history`, cursor), `client.recordHistory` (`POST /client/history`), `client.deleteHistoryEntry` (`DELETE /client/history/:entryId`), `client.clearHistory` (`DELETE /client/history`, `dryRun`)
- `draft-model.ts`, `draft-operations.ts`: `client.listDrafts`, `client.saveDraft` (`PUT /client/drafts/:draftId`), `client.deleteDraft`; `mcp: { exempt: "trạng thái tab của giao diện API client" }`
- `client-settings-model.ts`, `client-settings-operations.ts`: `client.getClientSettings` (`GET /client/settings`), `client.rememberRoutingHost` / `client.forgetRoutingHost` (`PUT`/`DELETE /client/routing-hosts/:host`, miễn MCP: "chỉ đường gửi thẳng của trình duyệt dùng; tool send_request luôn qua proxy"), `client.setTunnelMapping` / `client.deleteTunnelMapping` (`PUT`/`DELETE /client/tunnel-mappings/:key`, có MCP)
- `api-client-operations.ts` (gom mảng operation của T3 và T4)
- Test: `history-operations.test.ts`, `draft-operations.test.ts`, `client-settings-operations.test.ts` (kể cả user khác không đọc được ánh xạ)
- Sửa `apps/api/src/operations/registry.ts` (thêm `...apiClientOperations`), làm ở bước cuối sau khi T3 xong (mục 5)

### 2.5 T5: UI request ở `apps/web`

- `pages/api-client/api-client-page.tsx`
- `features/api-client/workbench/{workbench-types.ts, workbench-reducer.ts, workbench-context.tsx, use-draft-sync.ts, sidebar-rail.tsx, status-bar.tsx, empty-editor.tsx}`
- `features/api-client/api/draft-api.ts`
- `features/api-client/tabs/{tab-bar.tsx, tab-item.tsx, close-tab-modal.tsx}`
- `features/api-client/request/{request-editor.tsx, url-bar.tsx, method-select.tsx, variable-input.tsx, key-value-table.tsx, params-tab.tsx, headers-tab.tsx, auto-headers.ts, auth-tab.tsx, body-tab.tsx, body-form-table.tsx, body-binary-picker.tsx, request-settings-tab.tsx}`
- `features/api-client/scripts/{scripts-tab.tsx, script-snippets.ts}`
- `components/ui/code-editor.tsx` (+ test), `lib/method-tone.ts`, `platform/file-read.ts`
- Sửa: `routes.tsx` (`/api-client`), `components/layout/app-shell.tsx` (biến thể workbench: cao full màn hình, không footer), `apps/web/package.json` (3 gói CodeMirror), `docs/design-system.md` (`CodeEditor`, `method-tone`)
- i18n: tạo `i18n/messages/{en,vi,zh-CN}/api-client.ts` và đăng ký trước cả 4 namespace `apiClient`, `apiClientTools`, `apiClientRouting`, `apiClientTunelo` trong `{en,vi,zh-CN}/dictionary.ts` (ba namespace sau là object rỗng để T6, T7, T8a tự điền, không cùng sửa `dictionary.ts`)
- Test: `workbench-reducer.test.ts`, `auto-headers.test.ts`, `key-value-table.test.tsx`, `url-bar.test.tsx` (đồng bộ params với query)

### 2.6 T6: UI response và tiện ích

- `features/api-client/response/{response-panel.tsx, response-meta.tsx, timings-popover.tsx, response-body.tsx, body-search.ts, html-preview.tsx, json-table-preview.tsx, response-headers-table.tsx, response-cookies-table.tsx, set-cookie-parser.ts, script-results.tsx}`
- `features/api-client/history/{history-sidebar.tsx, history-item.tsx, history-groups.ts}`, `features/api-client/api/history-api.ts`
- `features/api-client/import-export/{import-modal.tsx, collection-open-picker.tsx, export-menu.tsx}`
- `features/api-client/snippets/code-snippet-modal.tsx`
- i18n: `{en,vi,zh-CN}/api-client-tools.ts`
- Test: `body-search.test.ts`, `set-cookie-parser.test.ts`, `history-groups.test.ts`, `import-modal.test.tsx`, `response-panel.test.tsx`

### 2.7 T7: bộ định tuyến

- `features/api-client/routing/{forbidden-headers.ts, route-plan.ts, send-pipeline.ts, use-send-request.ts, secret-consent-modal.tsx, route-select.tsx, route-badge.tsx, route-note.tsx, route-why.ts}`
- `features/api-client/api/{proxy-api.ts, client-settings-api.ts}`
- `features/api-client/scripts/script-worker.ts`, `platform/script-host.ts` (Worker, hàng đợi tuần tự, `terminate()` khi quá hạn), `platform/direct-fetch.ts` (`credentials: 'omit'`, `AbortSignal.timeout`, `targetAddressSpace` của Local Network Access, timing qua Performance API, phân loại `TypeError`/`AbortError`)
- `pages/settings/routing-settings.tsx`
- Sửa `apps/web/vite.config.ts` (worker ES, wasm của QuickJS)
- i18n: `{en,vi,zh-CN}/api-client-routing.ts`
- Test: `route-plan.test.ts` (header cấm, host đã nhớ, `followRedirects` tắt hay "Gửi IP client" thì cần proxy, ghi đè theo request, localhost), `send-pipeline.test.ts` (TypeError chuyển proxy và nhớ host, có secret thì dừng chờ đồng ý, Direct không tự chuyển, quota), `secret-consent-modal.test.tsx`

### 2.8 T8a: Tunelo thủ công (T8b hoãn)

- `features/api-client/tunelo/{tunelo-panel.tsx, tunelo-steps.tsx, cors-hint.tsx, cors-snippets.ts, tunnel-warning.tsx, tunnel-paste-form.tsx, tunnel-badge.tsx}`
- `pages/settings/{settings-page.tsx, tunelo-settings.tsx}`; sửa `routes.tsx` (`/settings`)
- i18n: `{en,vi,zh-CN}/api-client-tunelo.ts`
- Test: `tunelo-panel.test.tsx` (lệnh điền đúng port, dán URL sai domain báo lỗi, "Kiểm tra lại" gửi lại), `tunnel-paste-form.test.tsx`
- T8b (hoãn): `apps/api/src/modules/tunelo/*` (dùng `TunnelTokenExchange` sẵn có ở `modules/auth/token-exchange.ts`), `features/api-client/tunelo/{choose-tunnel-modal,tunelo-connect-modal}.tsx`, bảng máy đã liên kết trong `tunelo-settings.tsx`

### 2.9 T9: tích hợp mock

- `packages/shared/src/api-client/mock-to-collection.ts` (+ test)
- `features/api-client/import-export/from-mock-modal.tsx` (danh sách project của user, `getMockUrls`, rồi `collection-open-picker`)
- Sửa `features/resource-tree/node-actions.tsx` (thêm action `client`, `data-id` `{node}-client`), `features/resource-tree/resource-node.tsx`, `pages/project-detail/project-detail-dialogs.tsx` (điều hướng `/api-client?resource=…`), `components/layout/app-header.tsx` (nav "Mock API" / "API Client", `data-id` `topbar-nav-mock-api` / `topbar-nav-api-client`, ẩn khi cờ `apiClient` tắt), `i18n/messages/{en,vi,zh-CN}/{layout,resource-tree}.ts`
- Tuỳ chọn trong T9: thay 2 bản `METHOD_TONE` cũ bằng `lib/method-tone.ts`

### 2.10 T10: test liên tầng

- `apps/api/src/modules/api-client/proxy-echo-server.test.ts` (header tuỳ chỉnh kể cả `Cookie`, `User-Agent`, header trùng tên đúng thứ tự; body binary nguyên byte; IP qua 3 header; không có hop-by-hop và `lm_session`; `X-Forwarded-For` giả từ client không tin cậy không đổi IP)
- `apps/api/src/modules/api-client/ssrf-matrix.test.ts` (`127.0.0.1`, `169.254.169.254`, `[::1]`, `10.0.0.1`, `127.1`, `2130706433`, `[::ffff:127.0.0.1]`, domain resolve về IP private, redirect sang IP private)
- `e2e/specs/api-client-routing.spec.ts` (đích có CORS đi thẳng và proxy không nhận request, đích không CORS tự chuyển kèm badge, localhost có CORS với `--allow-insecure-localhost` và quyền LNA cấp sẵn)
- `e2e/specs/api-client-tunelo.spec.ts` (`http://localhost:3000/users` chưa có tunnel hiện `tunelo http 3000`; dán URL rồi gửi lại; user khác không thấy ánh xạ)
- `e2e/specs/api-client-mock.spec.ts` (tạo project mock, "Tạo collection", gửi GET/POST tới mock)
- `e2e/support/*` nếu cần thêm đích CORS/không CORS cố định cổng 46xx

---

## 3. Đối chiếu màn của prototype với component cũ

Ký hiệu: **P** port từ repo cũ, **M** viết mới, **H** hoãn sang phase khác. Cột `data-id` giữ đúng chữ của prototype.

### 3.1 `#/workspace`

| Vùng | `data-id` | Cũ | Cách | Ghi chú |
|---|---|---|---|---|
| Khung | `workbench`, `sidebar-rail`, `sidebar`, `tabbar`, `editor`, `statusbar` | `layout/app-layout.tsx`, `sidebar.tsx`, `status-bar.tsx` | M | Lưới CSS, không panel kéo giãn |
| Rail | `sidebar-rail-history` | — | M | `sidebar-rail-collections`, `-environments`, `-trash` là H (12, 13) |
| History | `sidebar-history-item`, `sidebar-history-clear` | `history/*` | P | Lọc theo method/status của bản cũ giữ lại |
| Tab | `tabbar-tabs`, `tabbar-tab`, `tabbar-tab-close`, `tabbar-new`, `tabbar-open-sidebar` | `request-tab-bar.tsx` | P | `tabbar-env-select`, `tabbar-env-create`, `tabbar-vars-quick`, `tabbar-open-right` là H (13, 12) |
| Đóng tab | `modal-unsaved`, `-discard`, `-cancel` | — | M | Nút `-save` là H (12) vì chưa có collection |
| Editor rỗng | `editor-empty`, `editor-empty-new`, `editor-empty-import`, `editor-empty-from-mock` | — | M | |
| Đầu request | `request`, `request-head`, `request-head-code` | `request-panel.tsx` | P | `request-head-save` H (12), `request-head-comments` H (14) |
| Thanh URL | `request-method`, `request-url`, `request-route`, `request-send` | `url-bar.tsx`, `method-selector.tsx` | P + M | `request-route` (Auto/Trực tiếp/Proxy) là M; dán cURL vào ô URL tự import (P từ `curl-parser`) |
| Badge tunnel | `request-url-tunnel-badge`, `request-url-tunnel-unmap` | — | M (T8a) | Chỉ hiện với ánh xạ thủ công |
| Tab request | `request-tab-{params,auth,headers,body,scripts,settings}`, `request-pane-*` | `request-tabs.tsx` | P | |
| Params | `request-params-{table,key,value,delete,add}` | `params-tab.tsx`, `key-value-editor.tsx` | P | Đồng bộ hai chiều với query |
| Headers | `request-headers-{toggle-auto,table,key,value,delete,add}` | `headers-tab.tsx` | P + M | Hàng header tự sinh là M |
| Auth | `auth-form`, `auth-type`, `auth-token`, `auth-username`, `auth-password`, `auth-key`, `auth-value`, `auth-inherit-source` | `auth-tab.tsx` | P | Thêm Inherit và API key vào query |
| Body | `request-body-type-{none,formdata,urlencoded,raw,binary}`, `request-body-raw-lang`, `request-body-raw`, `request-body-editor`, `request-body-formData`, `request-body-urlencoded`, `request-body-{key,value,add}`, `request-body-binary` | `body-tab.tsx`, `body-*-editor.tsx`, `body-binary-picker.tsx` | P | form-data có hàng file là M; gutter comment `request-body-comment-marker` là H (14) |
| Scripts | `request-scripts-{pre,post,editor,snippet}` | `script-editor.tsx` | P | Snippet dùng `lm.*` (D5) |
| Settings request | `request-settings-{send-ip,follow,timeout,tunelo}` | — | M | |
| Response, trạng thái | `response`, `response-empty`, `response-empty-route`, `response-loading`, `response-loading-text`, `response-cancel`, `response-cancelled` | `response-panel.tsx` | P | |
| Đồng ý secret | `response-route-consent`, `response-route-consent-open`, `modal-route-secret`, `-note`, `-remember`, `-cancel`, `-confirm` | — | M (T7) | |
| Gửi thẳng thất bại | `response-direct-fail`, `response-direct-fail-proxy`, `response-direct-fail-auto` | — | M (T7) | |
| Quota | `response-quota-exceeded`, `response-quota-plans` | — | M (T7) | Mở modal gói sẵn có (`manage-subscription-modal.tsx`) |
| Meta | `response-meta`, `response-route-badge`, `response-status`, `response-time`, `response-timings`, `response-timings-limited` | `response-status-bar.tsx` | P + M | Badge và timings theo đường đi là M; `response-save-example` H (12) |
| Ghi chú đường đi | `response-route-note`, `response-route-why` | — | M (T7) | |
| Body | `response-tab-{body,headers,cookies}`, `response-mode-{pretty,raw,preview}`, `response-search`, `response-search-count`, `response-copy`, `response-body`, `response-body-preview` | `response-body-viewer.tsx`, `raw-viewer.tsx`, `html-preview.tsx`, `response-actions.tsx` | P + M | Tìm trong body có đếm là M; Preview JSON dạng bảng là M |
| Headers, cookies | `response-headers`, `response-headers-note`, `response-cookies`, `response-cookies-direct` | `response-headers-table.tsx`, `response-cookies-table.tsx` | P | Ghi chú "gửi thẳng không đọc được `Set-Cookie`" là M |
| Kết quả script | (prototype không vẽ) | `test-results-panel.tsx`, `script-console.tsx` | P | Đặt thêm tab `response-tab-tests`; xem Q4 |
| Panel Tunelo | `tunelo-panel`, `tunelo-direct-fail`, `tunelo-reason`, `tunelo-step-{install,login,http}` (+`-copy`), `tunelo-recheck`, `tunelo-warning`, `tunelo-paste`, `tunelo-paste-input`, `tunelo-paste-submit`, `tunelo-cors-hint`, `tunelo-cors-tab-{express,vite,next,spring,laravel}`, `tunelo-cors-snippet`, `tunelo-cors-copy` | — | M (T8a) | `tunelo-connect`, `response-tunnel-basic-auth`, `modal-tunelo-connect`, `modal-choose-tunnel` là T8b |
| Import | `modal-import`, `-text`, `-file`, `-submit` | `import-dialog.tsx` | P | Thêm bước chọn request để mở (`collection-open-picker`) |
| Code | `modal-code`, `-lang`, `-output` | `code-snippet-panel.tsx` | P | |
| Từ mock | `modal-from-mock`, `modal-from-mock-{projectId}`, `-submit` | — | M (T9) | Ô "Tạo environment" và `modal-from-mock-sync` là H (13, 16) |
| Status bar | `statusbar-proxy-quota`, `statusbar-tunelo` | `status-bar.tsx` | M | Dùng `GET /account/usage` sẵn có; `statusbar-globals` H (13), `statusbar-trash` H (12) |
| Panel phải | `right-sidebar` | — | H (12, 14) | |

### 3.2 `#/settings`

| Vùng | `data-id` | Cũ | Cách | Ghi chú |
|---|---|---|---|---|
| Trang | `settings-page`, `settings-tab-tunelo`, `settings-tab-routing` | `settings/settings-page.tsx` | M | `settings-tab-mcp`, `settings-tab-notify` không đưa vào (D11) |
| Tunelo | `settings-tunelo`, `settings-tunelo-keyword`, `settings-tunelo-mappings`, `settings-tunelo-mapping`, `settings-tunelo-mapping-delete`, `settings-cmd-{install,login,http,auth,tcp}` | `proxy-settings.tsx` (khác hẳn) | M (T8a) | `settings-tunelo-connect`, `settings-tunelo-machines`, `settings-tunelo-machine`, `settings-tunelo-disconnect` là T8b |
| Định tuyến | `settings-routing`, `settings-routing-auto`, `settings-routing-lna`, `settings-routing-hosts`, `settings-routing-hosts-table`, `settings-routing-host`, `settings-routing-host-remove`, `settings-routing-hosts-empty` | — | M (T7) | `settings-routing-extension` là H (phase 22) |

### 3.3 Màn mock (`prototype/index.html`)

| Vùng | `data-id` | Cách |
|---|---|---|
| Nav sản phẩm | `topbar-nav-mock-api`, `topbar-nav-api-client` | M (T9), theo cờ `apiClient` |
| Node cây resource | `{node}-client` (mới, prototype không có) | M (T9) |

---

## 4. Rủi ro khi port

### 4.1 License và quyền sở hữu
- Cả `achoo254/localman` và `localman-next` đều không có file LICENSE, package `private`. Tác giả trùng (achoo254), nên port không cần giấy phép.
- Lưu ý: phần lớn commit của repo cũ đến từ bot GitLab của `gitlabs.inet.vn` và email `dattqh@inet.vn`. Nếu code đó viết trong thời gian làm cho công ty thì quyền sở hữu là việc user tự xác nhận; không chặn kỹ thuật.
- Dependency mới đều MIT.

### 4.2 Chất lượng test cũ
- Chỉ khoảng 32 ca dùng được; không có test cho snippet, Collection v2.1, sandbox, http-client. Test proxy cũ viết cho Fastify.
- Test cũ chỉ phủ đường thuận. Nên viết test mới theo lỗi đã thấy ở mục 4.4 và 4.5, không chỉ chép test cũ.

### 4.3 Phần dính desktop hoặc cloud
- Không còn Electron/Tauri (`CLAUDE.md` của repo cũ: "Web-only refactor complete").
- Bỏ: Firebase auth và cloud sync, Dexie, backup và định dạng native.
- Hướng ngược lại: nhờ `platform/direct-fetch.ts`, bản Tauri sau này (vòng 22) thay được bằng HTTP native không bị CORS.

### 4.4 Sandbox QuickJS
Lỗi của bản cũ phải sửa khi port:
1. **Không giới hạn bộ nhớ, stack, không interrupt.** `while(true){}` khoá worker; `setTimeout` trong worker không bao giờ chạy, chỉ còn `terminate()` từ main thread. Trên server (sau này cho runner/monitor) không có worker để giết. Sửa: `runtime.setMemoryLimit(32 MB)`, `setMaxStackSize(512 KB)`, `setInterruptHandler(shouldInterruptAfterDeadline(...))`, giữ `terminate()` làm chốt cuối; giới hạn độ dài script, số dòng console, số biến ghi ra.
2. **`lm.expect(...).toBe()` không bao giờ fail.** Hàm host trả `vm.newError(...)` như một giá trị bình thường chứ không ném lỗi, nên mọi test đều pass.
3. **`lm.test` giữ handle hàm sau khi callback trả về** (không `dup()`), nên gọi lại sẽ lỗi "lifetime not alive" hoặc dùng handle đã giải phóng.
4. Rò handle (`vm.getProp(vm.global, 'console')`), `response.json()` dựng lại bằng `evalCode` chuỗi JSON.
5. Prelude (D6) giải quyết 2–4: toàn bộ `lm` là JS trong VM, host chỉ đưa vào chuỗi JSON và đọc kết quả bằng `JSON.stringify`. Không đưa `fetch`, timer hay quyền gọi ra ngoài vào sandbox ở phase 10.

### 4.5 Escape của snippet generator

| Generator | Lỗi | Sửa |
|---|---|---|
| cURL | Body bắt đầu bằng `@` bị curl đọc thành file (`-d '@/etc/passwd'`) | Dùng `--data-raw` |
| PowerShell | Header đặt trong `"…"` nhưng escape kiểu C (`\"`), `$x` trong giá trị bị nội suy | Dùng nháy đơn `'…'` (`''`) cho cả header |
| Kotlin | `"…$name…"` là string template | Escape `$` thành `\$` |
| Dart | `'…$name…'` là interpolation | Escape `$` thành `\$` |
| Ruby | Dùng escape của JS trong nháy đơn: `\n` thành chữ `\n` thật, body đổi nghĩa | Dùng nháy kép với escape Ruby, hoặc heredoc |
| HTTPie | `echo '…' \|`: `echo` của `sh` có thể diễn giải `\` | Dùng `printf '%s'` |
| Tất cả | Header là object nên mất header trùng tên; method chưa được kiểm | Header mảng; method thuộc enum 7 giá trị |

Go, Python, PHP, Rust, Swift, C#, Java, JavaScript escape đúng với các ký tự đã xét. Golden test nên chạy với chuỗi đối kháng ở mục 2.2.

### 4.6 Rủi ro mới phát hiện khi đối chiếu với `localman-next`

1. **CSP chặn gửi thẳng.** nginx đặt `connect-src 'self'` cho cả web app, nên mọi `fetch` tới origin khác bị CSP chặn và cũng trả `TypeError`: chế độ Auto sẽ âm thầm luôn đi proxy, và E2E "đích có CORS đi thẳng" fail. Phải mở `connect-src` (ví dụ `'self' https: http: ws: wss:`) cho toàn app vì SPA chuyển trang không tải lại CSP. Rủi ro thêm nhỏ vì `img-src https:` vốn đã cho gửi dữ liệu ra ngoài.
2. **CSP chặn WebAssembly.** Worker tải từ `'self'` nhận cùng CSP; thiếu `'wasm-unsafe-eval'` trong `script-src` thì QuickJS không biên dịch được.
3. **nginx:** `client_max_body_size 128k` và `proxy_read_timeout 30s` cho `/api/` làm hỏng body 10 MB và timeout 120 giây. Cần `location = /api/v1/proxy` riêng.
4. **SSRF tới chính server .65.** Proxy gọi IP công khai của .65 thì request xuất phát từ chính IP đó, nên vượt được các `allow <ip>` của vhost khác trên cùng nginx. Cần `PROXY_BLOCKED_CIDRS` chứa IP công khai của server.
5. **Redirect làm lộ token.** Bản cũ không có redirect thủ công; khi tự làm phải bỏ `Authorization`, `Cookie` khi sang origin khác.
6. **`undici.request` không giải nén.** Phải tự giải nén và đo trần sau giải nén.
7. **Nhánh "đi thẳng" không giữ được một số tuỳ chọn:** `fetch` không tắt được redirect mà vẫn đọc được response (`opaqueredirect`), không gửi IP client. Auto phải coi `followRedirects: false` là lý do đi proxy; "Gửi IP client" chỉ có nghĩa khi qua proxy.
8. **Mixed content với IP LAN.** `http://192.168.x.x` từ trang https bị chặn trừ khi dùng `targetAddressSpace` (Chrome 142+ LNA); `http://localhost` thì được. Trình duyệt khác rơi về panel Tunelo.
9. **Tree-shake registry snippet** (mục 1.1) và **từ "postman" bị `check:i18n` chặn** (D9).
10. **Xung đột file với phase 19 đang review:** `registry.ts`, `i18n/messages/*/dictionary.ts`, `node-actions.tsx`, `resource-node.tsx` đang sửa dở. Phase 10 chỉ bắt đầu sửa các file này sau khi phase 19 commit.
11. **Tên dễ nhầm:** `apps/web/src/lib/api-client.ts` là client gọi API của chính Localman; feature mới ở `features/api-client/`. Trong feature không đặt file tên `api-client.ts`.

---

## 5. Thứ tự giao việc và chạy song song

Điều kiện chung: phase 19 đã commit (mục 4.6.10). Theo `~/.claude/rules/process-management.md`, các agent chạy song song chỉ chạy test của file mình; full suite (`pnpm test`, `pnpm e2e`) chạy tuần tự một lần ở cuối mỗi đợt, `--maxWorkers=2`.

| Bước | Việc | Tier | Song song với | Sở hữu file (độc quyền) | Phụ thuộc |
|---|---|---|---|---|---|
| 1 | **T2a** model, preparer, nội suy, host local, URL tunnel, envelope | M | — | `packages/shared/src/api-client/` (trừ `import/`, `export/`, `snippets/`, `script-sandbox/`, `mock-to-collection*`), `packages/shared/package.json` | phase 19 đã commit |
| 2 | **T2b** import, export, 16 snippet | M | T2c, T3, T4 | `packages/shared/src/api-client/{import,export,snippets}/` | T2a |
| 2 | **T2c** sandbox QuickJS | S | T2b, T3, T4 | `packages/shared/src/api-client/script-sandbox/` | T2a |
| 2 | **T3** proxy, SSRF, quota, nginx/CSP | L | T2b, T2c, T4 | `apps/api/src/modules/api-client/{proxy-*,ssrf-guard}*`, `apps/api/package.json`, `config/runtime-settings.ts`, `config/feature-env.ts`, `.env.example`, `infra/localman/nginx/localman.hoandat.com.conf`, `docs/system-architecture.md` | T2a |
| 2 | **T4** history, draft, settings | M | T2b, T2c, T3 | `apps/api/src/modules/api-client/{history-*,draft-*,client-settings-*}` | T2a |
| 3 | **T4-wire** gom `api-client-operations.ts`, sửa `registry.ts`, chạy `pnpm check:mcp-coverage` | S | — | `api-client-operations.ts`, `apps/api/src/operations/registry.ts` | T3, T4 |
| 4 | **T5** khung workbench, request builder, scripts tab, CodeEditor | L | T6 (sau khi T5 đẩy `workbench-types.ts` và `workbench-context.tsx`) | mục 2.5, `routes.tsx`, `app-shell.tsx`, `apps/web/package.json`, `{en,vi,zh-CN}/dictionary.ts`, `{…}/api-client.ts`, `docs/design-system.md` | T2a, T4-wire |
| 4 | **T6** response, history, import/export, snippet | L | T5 | mục 2.6, `{…}/api-client-tools.ts` | T2b, T4-wire, `workbench-types.ts` của T5 |
| 5 | **T7** định tuyến, gửi thẳng, worker QuickJS, settings định tuyến | L | — | mục 2.7, `apps/web/vite.config.ts`, `{…}/api-client-routing.ts` | T2c, T3, T5, T6 |
| 6 | **T8a** panel Tunelo thủ công, trang Settings | M | T9 | mục 2.8, `routes.tsx` (thêm `/settings`), `{…}/api-client-tunelo.ts` | T7 |
| 6 | **T9** tích hợp mock | M | T8a | mục 2.9 | T6 (`collection-open-picker`), T7 |
| 7 | **T10** echo, SSRF, E2E | M | — | mục 2.10, `e2e/` | T8a, T9 |
| 8 | **T11** archive repo cũ (cần user xác nhận) | S | — | repo `achoo254/localman` | T10 |
| 9 | **T12** review cuối | M | — | toàn phase | T10 |
| hoãn | **T8b** tự nhận tunnel, liên kết máy ẩn danh | M | — | `apps/api/src/modules/tunelo/*`, `features/api-client/tunelo/{choose-tunnel-modal,tunelo-connect-modal}.tsx`, `tunelo-settings.tsx` | plan Tunelo 01–03 |

Hai file bị nhiều việc chạm theo thời gian, không cùng lúc: `routes.tsx` (T5 rồi T8a) và `pages/settings/` (T7 tạo `routing-settings.tsx`, T8a tạo `settings-page.tsx` dùng nó).

---

## Câu hỏi còn mở (có khuyến nghị, không chặn T2–T4)

- **Q1. E2E "request có secret thì hiện hộp thoại".** Phase 10 chưa có nguồn biến `type=secret` (environment ở phase 13). Khuyến nghị: phase 10 làm unit và component test cho luồng đồng ý với scope giả; chuyển ca E2E sang Verification của phase 13. Phương án khác là thêm "Globals" tối thiểu ở phase 10, vượt phạm vi.
- **Q2. `pm.*` trong script.** Khuyến nghị giữ `lm.*` (D5) theo quyết định loại shim ở vòng 11. Nếu user muốn script import từ file v2.1 chạy được ngay thì cần alias `pm = lm` cho phần API trùng, tức đảo một phần quyết định 0.24.
- **Q3. Nhãn định dạng import.** Khuyến nghị "Collection v2.1" (D9). Nếu muốn ghi đúng tên định dạng phổ biến thì dùng `check-i18n-ignore` có lý do cho riêng nhãn đó.
- **Q4. Tab kết quả test của script.** Prototype không vẽ chỗ hiện kết quả `lm.test` và console. Khuyến nghị thêm tab `response-tab-tests` cạnh Headers và Cookies, chỉ hiện khi có script.
- **Q5. YAML cho OpenAPI.** Prototype nhận `.yaml`, repo hiện chỉ đọc JSON (vòng 25). Khuyến nghị giữ JSON, báo lỗi rõ khi gặp YAML.

Status: DONE_WITH_CONCERNS
Summary: Đã lập dependency matrix, chốt danh sách file theo T2–T10 (T2 tách T2a/b/c, T8 tách T8a làm ngay và T8b hoãn), đối chiếu prototype với `data-id`, liệt kê rủi ro và thứ tự giao việc; mục "Files to Create / Modify" của phase 10 đã cập nhật và T1 đã tick.
Concerns: CSP `connect-src 'self'` và thiếu `'wasm-unsafe-eval'` ở nginx sẽ làm hỏng gửi thẳng và QuickJS nếu không sửa trong T3; repo cũ thiếu test cho snippet, import Collection v2.1 và sandbox nên phải viết mới; sandbox và 6 snippet generator cũ có lỗi phải sửa khi port; phase 10 phải chờ phase 19 commit vì trùng file; Q1–Q5 ở trên.
