import { useSearchParams } from "react-router";
import { Alert } from "../../components/ui/alert";

/** Reasons `/auth/callback` may send back in `?authError=`. */
const AUTH_ERRORS = {
	access_denied: {
		title: "Bạn đã huỷ đăng nhập",
		text: "Localman chưa được phép truy cập tài khoản hoandat của bạn. Đăng nhập lại khi bạn sẵn sàng.",
	},
	login_expired: {
		title: "Phiên đăng nhập đã hết hạn",
		text: "Bước đăng nhập mất quá lâu nên không hoàn tất được. Hãy đăng nhập lại.",
	},
	login_failed: {
		title: "Đăng nhập không thành công",
		text: "Có lỗi khi hoàn tất đăng nhập. Hãy thử lại.",
	},
	rate_limited: {
		title: "Thử đăng nhập quá nhiều lần",
		text: "Bạn thử đăng nhập quá nhiều lần, vui lòng đợi một phút rồi thử lại.",
	},
	idp_unavailable: {
		title: "Không kết nối được tài khoản hoandat",
		text: "Máy chủ đăng nhập đang không phản hồi. Hãy thử lại sau ít phút.",
	},
} as const;

type AuthErrorCode = keyof typeof AUTH_ERRORS;

function isAuthErrorCode(value: string | null): value is AuthErrorCode {
	return value !== null && Object.hasOwn(AUTH_ERRORS, value);
}

/** Explains why the last sign-in did not finish; unknown codes are ignored. */
export function AuthErrorAlert() {
	const [params] = useSearchParams();
	const code = params.get("authError");
	if (!isAuthErrorCode(code)) return null;
	const { title, text } = AUTH_ERRORS[code];
	return (
		<Alert
			tone="danger"
			title={title}
			data-id="landing-auth-error"
			className="w-full text-left"
		>
			{text}
		</Alert>
	);
}
