import type { Messages } from "./messages.js";

export const vi: Messages = {
	"meta.homeTitle": "Tunelo: URL công khai cho server trên máy bạn",
	"meta.tunnelsTitle": "Tunnel của bạn · Tunelo",
	"home.eyebrow": "Tunnel cho lập trình viên",
	"home.title": "Đưa server trên máy bạn lên internet bằng một lệnh",
	"home.lead":
		"Tunelo cấp cho ứng dụng đang chạy trên máy bạn một địa chỉ HTTPS công khai dưới {domain}, hoặc một cổng TCP cho mọi thứ khác. Đăng nhập bằng tài khoản {brand} để xem mọi tunnel các máy của bạn đang mở.",
	"home.signInTitle": "Đăng nhập vào Tunelo",
	"home.signInBody": "Xem và quản lý mọi tunnel các máy của bạn đang mở.",
	"steps.title": "Bắt đầu",
	"steps.install.title": "Cài CLI",
	"steps.install.body": "Cần Node.js 20 trở lên.",
	"steps.login.title": "Đăng nhập trên máy của bạn",
	"steps.login.body":
		"Gắn các tunnel của máy này với tài khoản của bạn. Cần CLI 1.8.0 trở lên.",
	"steps.open.title": "Mở tunnel",
	"steps.open.body":
		"Dùng cổng mà server trên máy bạn đang nghe. Terminal sẽ in ra URL công khai.",
	"tunnels.title": "Tunnel của bạn",
	"tunnels.countOne": "1 tunnel đang chạy",
	"tunnels.countOther": "{count} tunnel đang chạy",
	"tunnels.snapshot":
		"Danh sách là các tunnel đang mở lúc trang được tải. Tải lại trang để cập nhật.",
	"tunnels.devices": "Quản lý thiết bị",
	"tunnels.machineCountOne": "1 tunnel",
	"tunnels.machineCountOther": "{count} tunnel",
	"tunnels.unnamedMachine": "Máy chưa đặt tên",
	"tunnel.protocol": "Giao thức",
	"tunnel.localPort": "Cổng local",
	"tunnel.basicAuth": "Basic Auth",
	"tunnel.basicAuthOn": "Bật",
	"tunnel.basicAuthOff": "Tắt",
	"tunnel.connected": "Kết nối",
	"tunnel.tcpHint": "Kết nối bằng client TCP",
	"empty.title": "Tài khoản này chưa có tunnel nào đang chạy",
	"empty.body":
		"Tunnel hiện ở đây khi đang chạy. Tunnel mở bằng Tunelo CLI 1.6.x dùng key ẩn danh, không gắn với tài khoản nào, nên không có trong danh sách này dù vẫn hoạt động.",
	"empty.fix":
		"Trên máy đó, cập nhật CLI lên 1.8.0 trở lên, đăng nhập, rồi mở lại tunnel:",
	"error.login_failed": "Đăng nhập chưa hoàn tất. Vui lòng thử lại.",
	"error.login_expired":
		"Đăng nhập quá lâu hoặc được bắt đầu ở tab khác. Vui lòng thử lại.",
	"error.access_denied": "Đăng nhập đã bị huỷ.",
	"error.idp_unavailable":
		"Dịch vụ đăng nhập tạm thời không truy cập được. Vui lòng thử lại sau ít phút.",
	"error.csrf": "Yêu cầu đã hết hạn. Tải lại trang rồi thử lại.",
	"meta.description":
		"Tunelo cấp cho ứng dụng đang chạy trên máy bạn một địa chỉ HTTPS công khai, hoặc một cổng TCP, chỉ bằng một lệnh.",
};
