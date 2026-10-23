# ADR-0008: Live Mock Sync là merge ba chiều trong không gian khoá của mock

- **Ngày:** 2026-10-24
- **Trạng thái:** Đã chốt; Jev chọn làm Live Mock Sync trước 15b, 21 và 18 (0,76, ngày 24/10/2026)
- **Người quyết định:** dattqh. Spec: plan `plans/dattqh/261008-1123-localman-core/phase-16-live-mock-sync.md` và prototype `prototype/index.html`, `prototype/api-client.html` của plan đó.

## Bối cảnh

Một collection tạo từ project mock (phase 10) chỉ là bản chụp lúc tạo: đổi tên resource, tắt endpoint hay đổi prefix là request trong collection sai path, nên người dùng phải tạo lại và mất phần đã tự sửa (header, body, script). Phase 16 yêu cầu collection tự theo mock nhưng không đè lên phần người dùng đã sửa, và khi mock đổi trúng phần đó thì hỏi người dùng.

## Quyết định

1. **Liên kết riêng, không đổi collection:** `live_mock_sync_links` (một liên kết cho mỗi collection, theo `collectionId`) giữ project, workspace, environment, tên request theo ngôn ngữ của người tạo, `pairs` (khoá mock → id node) và số xung đột đang chờ. Base (những gì lần đồng bộ trước lấy từ mock) nằm trong `live_mock_sync_base_nodes`, mỗi node một bản ghi, giống `fork_base_nodes`, để không chạm giới hạn 16 MB của một document. Fork và bản sao không có liên kết, nên chỉ bản gốc nhận đồng bộ; fork nhận thay đổi qua Pull changes như thường.
2. **Khoá ổn định:** mapper (`mock-to-collection-mapper.ts`, hàm thuần) đặt khoá theo id resource: folder `mock:<resourceId>:folder`, request `mock:<resourceId>:<METHOD>:<collection|item>`, example `…:example`. Đổi tên, đổi prefix hay lồng lại resource không đổi khoá, nên node giữ nguyên id, comment và lịch sử.
3. **Merge ba chiều trong không gian khoá:** collection được đổi tên node theo `pairs` sang khoá mock (node người dùng tự thêm giữ id của nó), rồi merge bằng `mergeCollections` của fork (base = base đã lưu, nguồn = output mapper bây giờ, đích = collection). Phần chỉ một bên đổi thì áp; cả hai cùng đổi một field là xung đột, giữ giá trị của người dùng tới khi có người chọn. Gốc collection (tên, auth, biến) không đồng bộ.
4. **Base chỉ tiến khi hết xung đột:** còn xung đột chưa chọn thì base giữ nguyên, nên xung đột hiện lại ở mọi lần đồng bộ sau, còn phần đã áp không bị áp lại (đích đã bằng nguồn). Chọn xong (`POST /collections/:id/mock-sync/resolve`) thì base thành output mapper.
5. **Không xoá thẳng:** request hay folder mock không còn phục vụ (endpoint tắt, resource bị xoá) chuyển vào folder `_removed` kèm ghi chú; nội dung của folder đi theo nó. Người dùng xoá node đó thì lần sau nó không quay lại. Endpoint bật lại thì request về chỗ cũ.
6. **Mẫu lấy từ schema, không từ dữ liệu:** body mẫu của POST/PUT/PATCH và example của GET dựng từ schema bằng giá trị cố định theo kiểu (`""`, `0`, `false`, `{}`, `[]`, một ngày cố định). Spec ban đầu ghi "example lấy từ dữ liệu đang có"; dữ liệu đổi ở mọi lần ghi bản ghi và lần đồng bộ nào cũng sẽ đổi example, làm changelog đầy thay đổi giả và tạo xung đột với example người dùng sửa. Bản ghi không bao giờ kích hoạt đồng bộ.
7. **Khi nào đồng bộ:** service resource (`createResource`, `updateResource`, `deleteResource`, `moveResource`, `createImportedResources`) và `updateProject` (prefix) phát `resource.changed` sau khi transaction commit (`resource-events.ts`). `LiveMockSyncJob` gom các thay đổi trong 2 giây thành một lần đồng bộ cho mỗi project, chạy trong tenant của người ghi, và lúc tắt server thì chạy ngay những lần đang chờ. Mỗi lần đồng bộ là một mục changelog `sync`, tác giả `system:live-mock-sync` (hiện là "Live Mock Sync"), ghi qua `writeCollectionState` trong transaction của workspace, nên restore được và không giẫm lên sửa đồng thời.
8. **Environment:** tạo collection đồng bộ thì tạo luôn environment có `baseUrl` (URL mock gồm prefix) và một biến id cho mỗi resource (`userId`, …), gắn làm environment liên quan. `baseUrl` theo prefix chỉ khi nó còn đúng giá trị lần trước đã ghi (người dùng đổi thì giữ); biến id thêm một lần cho mỗi resource mới (người dùng xoá thì không thêm lại).
9. **Quyền:** tạo cần Editor của project (`editResources`) và quyền thêm phần tử vào workspace; tắt cần Editor của collection và của project (project đã mất thì chỉ cần Editor của collection); chọn cho xung đột cần Editor của collection. Đồng bộ chạy dưới danh nghĩa hệ thống. Xoá project gỡ liên kết (`registerProjectDependent`), purge collection gỡ liên kết của nó.
10. **Công tắc và MCP:** operation đứng sau `LIVE_MOCK_SYNC_ENABLED` (tắt thì không route, không có tool), giao diện sau cờ web `liveMockSync`. Toolset `sync` dùng scope `client:*` mà IdP đã cấp (`SCOPE_AREAS`), không cần scope mới ở IdP.

## Phương án bị loại

- **Đồng bộ hai chiều (sửa collection thì đổi mock):** spec và prototype chốt một chiều, mock → collection.
- **So theo vị trí hay tên request:** đổi tên resource là mất ghép, phần người dùng sửa bị coi là xoá rồi thêm.
- **Dựng base từ changelog:** changelog bị cắt và có revision không giữ patch; giống fork, base lưu thành snapshot.
- **Đồng bộ ngay trong request ghi resource:** khoá workspace của collection nằm trong transaction ghi project, và một lần đổi nhiều resource sẽ ra nhiều mục changelog; debounce sau commit tách hai việc và gom thành một mục.

## Hệ quả

- Không có dữ liệu thật trong example của collection đồng bộ; người cần dữ liệu thật thì gửi request.
- Đồng bộ chạy trong process API; nhiều process thì mỗi process debounce riêng phần ghi nó nhận (vẫn đúng vì merge là idempotent, chỉ có thể ra thêm mục changelog).
- Thay đổi đang chờ debounce mất nếu process chết đột ngột; lần đổi mock tiếp theo đồng bộ bù cả phần đó.
