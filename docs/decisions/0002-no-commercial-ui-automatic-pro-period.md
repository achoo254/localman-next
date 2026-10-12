# ADR-0002: Chưa thương mại: web không hiện gói hay giá, Pro 30 ngày tự động

- **Ngày:** 2026-10-12
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh (gia hạn, nhắc hạn, thông báo chạm giới hạn do model Jev chọn; ghi ở Validation Log của `plans/dattqh/261008-1123-localman-core/plan.md`)

## Bối cảnh

Web từng có trang `/pricing`, khối giá trên landing, hộp thoại "Manage plan", nút "Start Pro trial", form xin gia hạn, form "quan tâm Pro" và nút "See plans" ở mọi chỗ chạm hạn mức. Localman chưa bán: chưa có thanh toán, và chủ sản phẩm không muốn người dùng thấy giá hay gói. Hạn mức theo gói (`limitsFor(plan)`), dùng thử Pro 30 ngày và trang admin thì vẫn cần.

## Quyết định

1. Web không hiện bảng giá, tên gói, Pro, dùng thử, nâng cấp hay thanh toán, trừ trang admin. `/pricing` chuyển về `/` (nginx 302 để trình duyệt không cache vĩnh viễn và mở lại được khi thương mại hoá, router SPA `Navigate`), không còn prerender `pricing.html`.
2. Mọi tài khoản chưa từng dùng thử (cũ và mới) tự được Pro 30 ngày khi đăng nhập hoặc khi phiên được làm mới (`autoStartTrial` gọi ở cuối `syncUserFromUserInfo`). Một lệnh cập nhật có điều kiện (`trialStartedAt: null`, không đang Pro) nên chỉ chạy một lần. Hết 30 ngày tài khoản tính như Free nhờ `effectivePlan`, không cần job.
3. Gia hạn hay nâng gói lại chỉ admin làm, trên trang admin. Endpoint backend (`users.startTrial`, `users.requestTrialExtension`, form Pro interest) giữ nguyên nhưng web không gọi.
4. Chạm giới hạn: một câu nêu giới hạn (kèm con số khi có) và gợi ý góp ý qua form feedback, không link tới gói. Lỗi `PLAN_LIMIT_REACHED` của API đổi message sang câu trung tính.
5. Nhắc hạn vẫn gửi, câu trung tính ("hạn mức mở rộng kết thúc ngày X"), không nhắc gói hay giá.
6. Trang tài khoản chỉ hiện bộ đếm và ngày hạn mức mở rộng kết thúc.

## Lý do (tại sao)

- Gỡ ở web mà giữ backend thì bật lại thương mại chỉ cần làm lại UI, không phải dựng lại hạn mức, dùng thử hay dữ liệu admin.
- Tự cấp Pro lúc đồng bộ user thay vì ở `GET /users/me` thì không thêm một lượt ghi vào route đọc nóng nhất; phiên được làm mới trước khi access token hết hạn nên người đang dùng app nhận Pro trong một vòng đời access token.
- Hết hạn đã tự động sẵn qua `effectivePlan`, nên "sau 30 ngày tự về Free" không cần code mới.

## Đánh đổi & hệ quả

- Người đã dùng thử xong không còn cách tự xin thêm; họ dùng form góp ý, admin quyết.
- Copy hạn mức trên landing và docs ghi số của Free; trang hướng dẫn nhanh ghi là mức tối thiểu ("ít nhất N project") vì 30 ngày đầu tài khoản có hạn mức cao hơn. Hạn mức resource ghi là tổng trên mọi project của tài khoản, đúng cách server đếm.
- Admin hạ một tài khoản chưa từng dùng thử về Free (`set-user-plan --plan free`), hoặc một lần admin cấp Pro có hạn kết thúc trên tài khoản như vậy, thì lần làm mới phiên kế tiếp tự cấp lại 30 ngày Pro. Chấp nhận và chỉ ghi lại (Jev 0,89): sau deploy mọi lần đăng nhập web đều đặt `trialStartedAt` ngay nên trường hợp này hiếm.
- Tên operation, mã lỗi (`PLAN_LIMIT_REACHED`), trường `plan`/`planExpiresAt` trong API giữ nguyên để không đổi hợp đồng API.
- Thương mại hoá sau này cần một ADR mới thay quyết định 1, 3 và 4.
