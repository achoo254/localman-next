import { type TrialMessages, dayAsUtc } from "./trial-en.js";

/** Vietnamese texts of the Pro trial. */
export const trialVi: TrialMessages = {
	/** "10/10/2026". */
	formatDay: (day) => {
		const date = dayAsUtc(day);
		const pad = (value: number) => String(value).padStart(2, "0");
		return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
	},
	endingTitle: (p) => `Gói dùng thử Pro còn ${p.daysLeft} ngày`,
	endingBody: (p) =>
		`Gói dùng thử Pro của bạn kết thúc ngày ${p.date}. Sau đó tài khoản về gói Free: mọi thứ bạn đã tạo vẫn giữ nguyên, nhưng không tạo thêm được khi đang vượt hạn mức Free. Bạn có thể xin gia hạn ở trang tài khoản.`,
	endedTitle: "Gói dùng thử Pro đã kết thúc",
	endedBody: (p) =>
		`Gói dùng thử Pro của bạn đã kết thúc ngày ${p.date} và tài khoản đã về gói Free. Project, resource và dữ liệu vẫn được giữ nguyên; không tạo thêm được khi đang vượt hạn mức Free. Bạn có thể xin gia hạn ở trang tài khoản trong vòng 7 ngày.`,
	requestedTitle: "Yêu cầu gia hạn dùng thử Pro",
	requestedBody: (p) =>
		`${p.user} xin gia hạn gói dùng thử Pro. Duyệt hoặc từ chối ở trang quản trị.`,
	approvedTitle: "Gói dùng thử Pro đã được gia hạn",
	approvedBody: (p) =>
		`Gói dùng thử Pro của bạn được dùng tới hết ngày ${p.date}.`,
	declinedTitle: "Yêu cầu gia hạn dùng thử Pro bị từ chối",
	declinedBody:
		"Yêu cầu gia hạn gói dùng thử Pro của bạn đã bị từ chối. Gói dùng thử giữ nguyên ngày kết thúc hiện tại.",
	ownerAlert: (p) =>
		[
			"Yêu cầu gia hạn dùng thử Pro",
			`Người dùng: ${p.user}`,
			`Hết hạn dùng thử: ${p.date ?? "không có hạn"}`,
			"Quyết định ở trang quản trị: /admin/trial-extensions",
		].join("\n"),
};
