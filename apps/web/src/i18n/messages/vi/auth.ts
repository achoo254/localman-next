import type { Messages } from "../../message-types";

export const auth: Messages["auth"] = {
	status: {
		loading: "Đang kiểm tra phiên đăng nhập…",
		redirecting: "Đang chuyển tới trang đăng nhập…",
		errorTitle: "Không kiểm tra được phiên đăng nhập",
		loginLoop:
			"Đã chuyển tới trang đăng nhập nhiều lần mà phiên vẫn chưa được giữ lại. Kiểm tra trình duyệt có chặn cookie của Localman không rồi thử lại.",
	},
	callbackError: {
		access_denied: {
			title: "Bạn đã huỷ đăng nhập",
			text: "Localman chưa được phép truy cập tài khoản {idpName} của bạn. Đăng nhập lại khi bạn sẵn sàng.",
		},
		login_expired: {
			title: "Phiên đăng nhập đã hết hạn",
			text: "Bước đăng nhập mất quá lâu nên không hoàn tất được. Hãy đăng nhập lại.",
		},
		login_failed: {
			title: "Đăng nhập không thành công",
			text: "Có lỗi khi hoàn tất đăng nhập. Hãy thử lại.",
		},
		account_deleted: {
			title: "Tài khoản Localman này đã bị xoá",
			text: "Tài khoản {idpName} của bạn vẫn dùng được, nhưng tài khoản Localman và dữ liệu của nó đã bị xoá. Đăng nhập lại sẽ tạo một tài khoản mới, trống.",
		},
		rate_limited: {
			title: "Thử đăng nhập quá nhiều lần",
			text: "Bạn thử đăng nhập quá nhiều lần, vui lòng đợi một phút rồi thử lại.",
		},
		idp_unavailable: {
			title: "Không kết nối được tài khoản {idpName}",
			text: "Máy chủ đăng nhập đang không phản hồi. Hãy thử lại sau ít phút.",
		},
	},
	accountFallback: "Tài khoản",
	createNewAccount: "Tạo tài khoản mới",
};
