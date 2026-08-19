# ADR-0003: Client tự dò sống-chết, không chờ sự kiện `close`

- **Ngày:** 2026-08-19
- **Trạng thái:** Đã chốt
- **Người quyết định:** dattqh

## Bối cảnh

Server đã có keepalive từ đầu: `ws-handler.ts` ping mỗi `PING_INTERVAL_MS` (30s), lần ping sau mà
chưa nhận pong thì `terminate()` rồi gỡ đăng ký tunnel. Client thì **không có gì cả** — toàn bộ đường
kết nối lại của `TunnelClient` treo vào đúng một sự kiện: `socket.on("close")`.

Cách bố trí bất đối xứng đó đúng khi đường truyền chết *có báo tang*: một FIN hoặc RST tới nơi, `ws`
phát `close`, `reconnect()` chạy. Nó **sai khi đường truyền chết im lặng** — NAT hoặc tường lửa hết
hạn bảng trạng thái và bắt đầu nuốt gói của luồng đó. Không bên nào nhận được gì, nhưng socket phía
client vẫn `ESTABLISHED` trong bảng kernel. Không có `close`, nên không có kết nối lại. Vĩnh viễn.

Sự cố thật ngày 19/08/2026 trên lab: một trục trặc mạng lúc ~08:35 đụng cả ba tunnel của box CEPH
`192.168.122.171` (box này nằm sau NAT). Log tunnel server:

```
08:35:48  onedash-s3  Tunnel unregistered      ← và không có "registered" nào sau đó
08:39:51  ods3lab     Tunnel registered        ← tunnel anh em tự hồi bình thường
```

Phía client, mọi chỉ dấu đều xanh và đều nói dối:

| Chỗ nhìn | Cái thấy |
|---|---|
| `systemctl status onedash-s3-tunnel` | `active (running)` |
| `journalctl -u onedash-s3-tunnel` | dòng cuối là `Status: Online` của **hôm trước** |
| `ss -tnp` | TCP `ESTAB` tới edge `:443`, còn nguyên |
| gọi thật vào `s3.inetdev.io.vn` | **502 `Tunnel not found: onedash-s3`** |

`s3.inetdev.io.vn` ngừng phục vụ hơn 3 tiếng, không cảnh báo nào nổ, và mọi phép kiểm tại chỗ đều báo
khoẻ. Sửa bằng `systemctl restart` — tức là bản thân client hoàn toàn có khả năng kết nối lại, nó chỉ
không bao giờ **biết** là cần phải làm thế.

## Quyết định

Client dò ngược lại server bằng chính cơ chế server đang dùng: ping theo chu kỳ, lần ping sau mà chưa
có pong thì `terminate()` socket — cú `terminate` đó sinh ra `close`, và `close` chạy đường kết nối
lại vốn đã có sẵn.

## Lý do (tại sao)

- **Không có tín hiệu nào khác để bám vào.** Khi đường truyền chết im lặng, đúng theo định nghĩa là
  không có gói nào tới. Thứ duy nhất phát hiện được là **ta gửi đi rồi không thấy hồi đáp**. Mọi
  phương án không dựa trên việc tự gửi đều không thể phát hiện ca này.
- **Đường kết nối lại đã đúng sẵn, chỉ thiếu người bấm nút.** Ca này không cần logic hồi phục mới —
  `reconnect()` với backoff và jitter đã có (và vừa được sửa ở 1.5.1). Việc còn thiếu là chuyển một
  socket chết im lặng thành một sự kiện `close`.
- **`terminate()` chứ không `close()`.** `close()` mở màn bắt tay đóng và chờ hồi đáp — hồi đáp sẽ
  không bao giờ tới, vì bên kia đã không nghe được ta nữa. Đó chính là tình huống đang xử lý.
- **Đối xứng với server là tài sản, không phải trùng lặp.** Hai đầu cùng một mô hình sống-chết thì
  chỉ có một hành vi phải suy luận khi đọc mã, và cùng một hằng số để chỉnh.

## Đánh đổi & hệ quả

- **Được:** tunnel sau NAT tự hồi phục. Sự cố 19/08 sẽ tự sửa sau **≤ 60 giây** (hai chu kỳ dò) thay vì
  nằm chết tới khi có người để ý.
- **Được:** hỏng-hóc trở nên **nhìn thấy được**. Client in `Disconnected` / `Reconnecting` vào journal,
  nên lần sau còn dấu vết để lần, thay vì một khoảng lặng.
- **Mất:** thêm một khung ping mỗi 30s mỗi tunnel mỗi chiều. Ở mức 5-10k tunnel mục tiêu, đó là vài
  trăm khung mỗi giây gồm toàn khung điều khiển rỗng — không đáng kể so với lưu lượng relay.
- **Mất:** một khoảng trắng dương tính giả. Máy khách bị treo (đình chỉ, đĩa nghẽn) lâu hơn hai chu kỳ
  sẽ tự cắt kết nối. Chấp nhận được: server vốn đã cắt nó theo đúng ngưỡng đó, nên nới bên client chỉ
  tạo ra bất đối xứng ngược lại.
- **Thời gian phát hiện là 2×`PING_INTERVAL_MS`**, không phải 1×. Chu kỳ đầu gửi, chu kỳ sau mới thấy
  thiếu pong. Chỉnh hằng số thì nhớ nhân đôi.

## Phương án đã cân nhắc

- **Watchdog ngoài (timer systemd gọi `curl` qua đường công khai, hỏng thì restart unit).** Loại vì nó
  vá đúng một máy trong khi lỗi nằm ở mọi client; nó cần một điểm cuối HTTP để dò, mà tunnel TCP không
  có; và nó biến một khiếm khuyết của sản phẩm thành gánh nặng vận hành cho từng người triển khai.
- **Dựa vào TCP keepalive của hệ điều hành.** Loại vì mặc định `tcp_keepalive_time` của Linux là **2
  giờ** — dài hơn hẳn thứ tự thời gian đang nói tới. Chỉnh được, nhưng là chỉnh cho toàn máy, nằm ngoài
  tầm với của gói npm, và im lặng quay về mặc định trên bất kỳ máy nào cài mới.
- **Ping ở tầng ứng dụng (khung JSON `ping`/`pong`).** Loại vì giao thức WebSocket đã có sẵn khung điều
  khiển cho đúng việc này, `ws` tự trả lời pong không cần mã nào, và server đã dùng chính nó rồi.
- **Chỉ nâng client lên 1.5.1.** Loại vì bản đó sửa việc *nhân đôi vòng lặp kết nối lại* — một lỗi ở
  nhánh mà `close` **có** nổ. Nhánh này thì `close` không bao giờ nổ, nên 1.5.1 không chạm tới.
