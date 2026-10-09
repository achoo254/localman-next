# ADR-0001: Dữ liệu resource được ghi trong transaction có khoá theo project

- **Ngày:** 2026-10-09
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Resource của một project là cây cha–con; bản ghi con trỏ tới bản ghi cha qua `parentRecordId`. Nhiều thao tác phải đổi nhiều document cùng lúc: sinh dữ liệu thay toàn bộ bản ghi của một resource rồi chỉnh bản ghi con, đổi cha reset cả cây con, "Generate all" thay dữ liệu của mọi resource. Nếu dừng giữa chừng, người dùng thấy dữ liệu nửa cũ nửa mới, hoặc bản ghi con trỏ tới bản ghi cha không còn.

Kiểm tra cây (chặn chu trình, trùng tên anh em, độ sâu) đọc rồi mới ghi. Hai lượt đổi cha chạy song song (A vào dưới B, B vào dưới A) ghi vào hai document khác nhau, nên snapshot isolation của MongoDB không phát hiện xung đột và cả hai cùng commit thành một chu trình.

Nguồn (mockapi.io) không cho biết hành vi khi sinh lại dữ liệu cho resource cha.

## Quyết định

1. Mọi thao tác ghi resource hoặc record từ dashboard chạy trong một transaction Mongo (`inProjectTransaction`). Việc đầu tiên trong transaction là `$inc` một document khoá của project (`resource_tree_locks`), rồi kiểm project còn tồn tại và chưa bị đánh dấu xoá (không thì 404). Xoá project đặt tombstone `deletingAt` trong một transaction giữ khoá, dọn resource và record (cũng dưới khoá), rồi mới xoá document project; `DELETE` lặp lại trên project đang xoá dở thì dọn tiếp.
2. Sau khi dữ liệu của một resource bị thay (sinh, sửa thô), bản ghi con trỏ tới id cha còn tồn tại được giữ nguyên, bản ghi con mồ côi được gán ngẫu nhiên một bản ghi cha mới. Resource cha rỗng thì cả cây con bị reset. Đổi cha reset resource đó cùng cây con của nó.
3. Field `Parent Resource` và `Child Resource` không được lưu vào record; mock runtime phân giải khi trả lời.

## Lý do (tại sao)

- Hai transaction cùng sửa một document khoá thì MongoDB huỷ một bên bằng lỗi write conflict tạm thời, và `withTransaction` chạy lại bên đó trên trạng thái mới. Kiểm tra cây vì thế luôn chạy trên dữ liệu đã commit, không cần khoá phân tán hay hàng đợi.
- Id bản ghi bắt đầu lại từ "1" mỗi lần sinh, giống nguồn. Giữ liên kết tới id còn tồn tại giúp người dùng không mất dữ liệu con chỉ vì sinh lại cha, còn gán lại phần mồ côi theo đúng quy tắc chia ngẫu nhiên mà user đã chốt. Bất biến cuối cùng: mọi bản ghi con luôn trỏ tới một bản ghi cha có thật, nên route lồng của mock runtime không bao giờ gặp cha ma.
- Field quan hệ là ảnh chụp của resource khác. Lưu chúng thì sinh lại cha hay con đều làm ảnh chụp lỗi thời; phân giải lúc trả lời thì luôn đúng.

## Đánh đổi & hệ quả

- Cần replica set ở mọi môi trường: dev dùng `docker-compose.yml` (`rs0`), test dùng `MongoMemoryReplSet` một node.
- Lượt ghi chạy đua với lượt xoá project hoặc commit trước lúc đặt tombstone (và bị dọn theo), hoặc xung đột trên khoá rồi chạy lại và nhận 404: không còn resource hay record mồ côi. Dọn lỗi giữa chừng không để lại dữ liệu vô chủ: project còn đó (ẩn, vẫn chiếm slot hạn mức) cho tới khi `DELETE` lần sau dọn xong. Tombstone cũng là nền cho thùng rác 30 ngày sau này.
- Các thao tác ghi trên cùng một project bị tuần tự hoá. Dashboard ít khi ghi song song nên không đáng kể; "Generate all" cho 50 resource × 100 bản ghi (sinh và chèn từng resource trong một transaction) chạy dưới 200 ms trên Mongo local.
- Tạo resource ở các project khác nhau của cùng chủ không dùng chung khoá; hạn mức được giữ bằng unique `(ownerSub, quotaSlot)` như project.
- Mock runtime ghi từng bản ghi qua POST, PUT, DELETE. Nó đụng document resource (`count`, `nextId`) nên vẫn xung đột đúng với lượt sinh dữ liệu; nếu cần xoá dây chuyền nhiều cấp thì cũng nên dùng `inProjectTransaction`.

## Phương án đã cân nhắc

- **Reset toàn bộ cây con mỗi khi sinh lại cha:** đơn giản hơn nhưng làm mất dữ liệu con mỗi lần người dùng chỉnh số bản ghi cha trên thanh generator. Chỉ áp dụng khi cha rỗng.
- **Chia lại toàn bộ bản ghi con:** phá các liên kết vẫn còn hợp lệ, người dùng thấy dữ liệu đổi không lý do.
- **Không dùng transaction, dựa vào thứ tự ghi:** lỗi giữa chừng để lại dữ liệu lệch và không chặn được chu trình khi đổi cha song song.
