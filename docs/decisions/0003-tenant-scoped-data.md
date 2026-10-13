# ADR-0003: Dữ liệu Localman theo tenant (domain)

- **Ngày:** 2026-10-13
- **Trạng thái:** Đã chốt cho tầng dữ liệu; phần tra tenant theo Host qua IdP, đăng nhập và web theo tenant làm tiếp theo ADR này
- **Người quyết định:** dattqh (Localman phục vụ mọi domain đã nhận ở IdP `hoandat-auth`, hoandat.com là tenant số 1 không đổi hành vi; Pro/trial ở tenant mới như hoandat, owner của tenant là admin của tenant). Thiết kế theo `docs/decisions/0006-tenants-by-domain.md` của repo `hoandat-auth`.

## Bối cảnh

IdP `hoandat-auth` cho người dùng nhận domain riêng (tenant): `auth.<domain>`, `localman.<domain>`, `*.localman.<domain>`, `tunnel.<domain>`. Localman có 41 model mongoose, không có lớp repository, khoảng 700 chỗ gọi model rải rác; nhiều khoá đang duy nhất toàn hệ thống (`Project.secret`, hash token mời, endpoint Web Push…). Sửa từng chỗ gọi để thêm `tenantId` thì dễ sót, và một chỗ sót là lộ dữ liệu giữa tenant.

## Quyết định

1. **Ngữ cảnh tenant bằng `AsyncLocalStorage`** (`apps/api/src/tenancy/tenant-context.ts`). Middleware đầu tiên của cả hai server (`tenantScope` trong `createBaseApp`) chọn tenant theo Host qua `TenantDirectory` rồi chạy phần còn lại của request trong tenant đó; Host không thuộc tenant nào nhận 421, trừ `/healthz`. Hiện thư mục tenant chỉ có tenant chính dựng từ env (`primaryTenantFromEnv`, id `primary` như IdP), phục vụ mọi Host như trước.
2. **Plugin `tenantScopePlugin` gắn tường minh vào cả 41 schema** (trước `mongoose.model`, không dùng plugin toàn cục vì plugin toàn cục chạy cả trên schema con). Plugin thêm trường `tenantId` bắt buộc, thêm `tenantId` vào filter của mọi query, update, delete, `aggregate` (`$match` đầu pipeline) và `bulkWrite`, đóng dấu `tenantId` khi tạo, `insertMany`, upsert và replace, từ chối `save()` một document của tenant khác. Không có tenant trong ngữ cảnh thì ném `MissingTenantError` (production không có tenant mặc định; test có `TEST_TENANT` qua `src/test-support/tenant-setup.ts`).
3. **Mọi index đứng đầu bằng `tenantId`**, nên khoá duy nhất cũ thành duy nhất trong tenant (cùng `secret` ở hai tenant được). Index TTL giữ một trường (MongoDB bắt buộc).
4. **Đi tắt plugin chỉ ở chỗ được liệt kê** (test `tenant-models.test.ts` quét mã): ghi thô `RecordModel.collection` tự thêm `tenantId`; `acrossTenants` chỉ cho việc nền liệt kê công việc của mọi tenant (hàng đợi outbound nhận job rồi chạy job trong tenant của nó, cắt request log theo project id vốn duy nhất, liệt kê tenant có user).
5. **Việc ngoài request mang tenant theo từng mục:** usage meter, hoạt động project và request log giữ tenant của request đã đếm/ghi, flush theo từng tenant; job định kỳ (dọn tombstone, nhắc dùng thử, dọn thùng rác, backfill tên ví dụ) chạy lần lượt trong từng tenant có user (`forEachTenant`).
6. **Dữ liệu cũ thuộc tenant chính:** `create-tenant-indexes.mjs` chạy trong `activate-release.sh` khi release cũ còn phục vụ (gắn `tenantId: "primary"` cho document chưa có, dựng index mới); lúc khởi động `migrateToTenants` gắn nốt document ghi trong khoảng đó, dựng index rồi bỏ index cũ đã có bản `tenantId` đứng đầu. Index khác (vận hành tự tạo) không bị đụng.
7. **Lệnh vận hành có `--tenant <id>`** (mặc định `primary`): `set-user-plan`, `cleanup-abandoned-projects`. Chúng chạy trong phạm vi chỉ có dữ liệu (`runInTenantData`), không có cấu hình tenant.

## Lý do (tại sao)

- Một chỗ áp bộ lọc (plugin) thay vì 700 chỗ gọi: chỗ gọi mới tự đúng, quên tenant thì ném lỗi chứ không đọc chéo.
- `AsyncLocalStorage` đi qua `await`, body parser và transaction (đã đo), nên chữ ký hàm nghiệp vụ không đổi.
- Một bản `users` mỗi tenant (khoá `(tenantId, sub)`): hạn mức, gói, dùng thử, liên kết Telegram và thông báo tách theo tenant đúng như quyết định Pro/trial.

## Đánh đổi & hệ quả

- Ghi thô qua driver (`Model.collection`) không được bảo vệ: phải tự thêm `tenantId` và được test quét mã liệt kê.
- Mongoose query là lazy: hàm trả về một query chưa `await` rồi chạy ngoài `runInTenant` sẽ mất ngữ cảnh. Code ứng dụng luôn `await` trong request nên không gặp; test dùng `.exec()`.
- Khởi động có thêm một lượt `updateMany({ tenantId: null })` mỗi collection; sau lần đầu nó đi theo index nên rẻ.
- Rate limit, cache project và bộ đếm trong bộ nhớ vẫn một process (fork mode như trước).
