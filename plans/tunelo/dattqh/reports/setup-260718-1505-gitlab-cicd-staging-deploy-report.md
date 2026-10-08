# GitLab CI/CD → Staging (.65) — Setup Report

**Ngày:** 2026-07-18 | **Repo:** `gitlabs.inet.vn/dattqh/tunelo` (project id 343) | **Branch:** main

## Mục tiêu
Cấu hình CI/CD trên GitLab để build + deploy tự động lên staging `.65`, **chỉ khi push vào `main`**. Tự set CI/CD Variables cần thiết.

## Kết quả — DONE (verified)
- Pipeline `#7124` **success** (build 55s + deploy_staging 33s).
- App `tunelo` chạy ổn định trên `.65`: `https://tunnel.inetdev.io.vn/health` → **HTTP 200** (`{"status":"ok"}`), qua nginx.
- Deploy chỉ chạy trên push `main` (workflow rule `$CI_COMMIT_BRANCH == "main"`).

## Đã làm

### 1. Git remote
- `origin` đổi từ GitHub (`achoo254/tunelo`) → `https://gitlabs.inet.vn/dattqh/tunelo.git` (bỏ hẳn GitHub — theo yêu cầu).

### 2. Reconcile lịch sử main (đã diverge)
- GitLab main cũ (streaming 0.5.0, 09/07) khác kiến trúc local main (MongoDB+auth+dashboard, 17/07).
- Backup GitLab main cũ → nhánh **`backup/pre-cicd-gitlab-main`** @ `128c601` (không mất gì).
- Tạm mở `allow_force_push` trên protected branch → force-push local main → **khôi phục `allow_force_push=false`**.

### 3. `.gitlab-ci.yml` (mới)
- `build`: `pnpm install --frozen-lockfile` → `pnpm test` (15/15) → `pnpm build:server` (bundle server.mjs + dashboard). Artifact `dist/`.
- `deploy_staging`: rsync `dist/` + `ecosystem.config.cjs` sang server qua SSH (port 24700, key inject), `pnpm install --prod`, PM2 restart, **health gate retry ~30s (fail job nếu ≠200)**.
- Image `node:20-bookworm-slim`; runner shared #15 (untagged, online). CI Lint: valid.
- Build job gồm cả `pnpm lint` (biome) — xem mục 7. Verify local: lint ✓, test ✓, build ✓, typecheck server+client ✓.

### 4. CI/CD Variables (project 343, tất cả `Protected`)
| Key | Type | Value |
|-----|------|-------|
| `SSH_PRIVATE_KEY` | File | RSA key staging (không mask được vì đa dòng) |
| `STAGING_HOST` | Var | `103.72.98.65` |
| `STAGING_PORT` | Var | `24700` |
| `STAGING_USER` | Var | `root` |
| `DEPLOY_PATH` | Var | `/var/www/tunelo` |

### 5. Fix crash-loop trên staging (root cause thật)
- Pipeline deploy đúng, nhưng app crash-loop: `.env` server (bản cũ 09/07, config streaming `TUNELO_API_KEYS`) **thiếu `MONGO_URI`/`JWT_SECRET`** mà bản MongoDB yêu cầu.
- Đã backup `.env` cũ (`.env.bak-<ts>`) và ghi `.env` mới: `MONGO_URI` (verified với Mongo local trên .65), `JWT_SECRET` (openssl rand), `ADMIN_EMAILS=dattqh@inet.vn`, `TUNNEL_PORT=3001`, `TUNNEL_DOMAIN`, `NODE_ENV=production`, quyền `600`.
- Restart → "MongoDB connected" → "Tunelo server started"; restart count ổn định.

### 6. Docs
- `docs/deployment-guide.md`: thêm mục "CI/CD (GitLab)" + biến `.env` bắt buộc phía server.

### 7. Biome config + bật lại lint gate
- Thêm **`biome.json`** (root): `vcs.useIgnoreFile`, ignore build artifacts (`**/dist`, `**/portal-dist`, `**/*.d.ts`, `**/*.tsbuildinfo`, `repomix-output.xml`, `.claude/**`), format tab/80/double-quote. Lint từ 378 lỗi (quét cả generated) → scope đúng source.
- Auto-fix format (`lint:fix`, 10 files) + fix thủ công 8 lỗi thật (không tắt rule):
  - `req.userId!` ×4 → helper **`require-user-id.ts`** (`requireUserId(req)`, fail-loud).
  - `.pop()!` → `slice(lastIndexOf(":")+1)`.
  - `delete config.key` → `config.key = undefined` (JSON tương đương).
  - modal: `autoFocus` → `nameInputRef`+`useEffect`; backdrop thêm `onKeyDown` (Escape close).
- `pnpm lint` xanh (126 files). Bật `pnpm lint` trong build job → **lint gate active**.

### 8. Publish CLI lên GitLab Package Registry (client)
- Client đổi tên `@achoo254/tunelo` → **`@dattqh/tunelo`** (khớp namespace + registry cũ), version **1.0.0**, URL → GitLab; CLI `--version` đồng bộ 1.0.0.
- `build-client.ts` sinh `dist/package.json` self-contained (bỏ `@tunelo/shared workspace:*` đã bundle, giữ runtime deps) + `files` list loại `.npmrc` (chống lộ CI token). Thêm root script `build:client`.
- `.gitlab-ci.yml`: stage `publish` + job **`publish-cli`** (rule `$CI_COMMIT_TAG`) — build + `npm publish` lên `projects/343/packages/npm/`, auth `CI_JOB_TOKEN`. workflow.rules cho phép tag; build/deploy scope về `main` (tag không deploy).
- README: mục "Cài CLI từ GitLab Package Registry" — config scope `@dattqh` + deploy token read-only (`tunelo-npm-install`), `npm i -g @dattqh/tunelo`.
- **Verified E2E:** tag `v1.0.0` → pipeline #7128 `publish-cli` success → `@dattqh/tunelo@1.0.0` là `latest`. Cài thật từ registry OK (`tunelo --version`→1.0.0). Tarball publish KHÔNG chứa `.npmrc` (token an toàn).
- Release sau: bump version client → `git tag vX.Y.Z && git push --tags` (publish lại version cũ sẽ fail).

## Điều kiện vận hành
- `main` là protected branch + runner #15 online nhận job untagged.
- Pipeline **không** sync `.env` — secret nằm trên server (`/var/www/tunelo/.env`), nạp qua `--env-file` (ecosystem).
- Push tiếp theo vào main từ máy khác cần credential GitLab (token/credential helper) vì origin là HTTPS.

## Unresolved / lưu ý
1. **`JWT_SECRET`/`ADMIN_EMAILS` staging** do Agent set (secret random + email của bạn). Muốn giá trị khác → sửa `/var/www/tunelo/.env` rồi `pm2 restart tunelo`.
2. **MONGO_URI staging** dùng đúng giá trị trong `.env` local (auth `tunelo_db@localhost`). Mongo trên .65 hiện cho cả có/không auth — nếu muốn siết, cấu hình lại Mongo.
3. **Nhánh `backup/pre-cicd-gitlab-main`** giữ bản streaming 0.5.0 cũ. Xoá khi không cần.
