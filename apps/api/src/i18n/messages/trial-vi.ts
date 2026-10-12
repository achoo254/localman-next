import { type TrialMessages, dayAsUtc } from "./trial-en.js";

/** Vietnamese texts of the Pro trial. */
export const trialVi: TrialMessages = {
	/** "10/10/2026". */
	formatDay: (day) => {
		const date = dayAsUtc(day);
		const pad = (value: number) => String(value).padStart(2, "0");
		return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
	},
	endingTitle: (p) => `Hạn mức mở rộng còn ${p.daysLeft} ngày`,
	endingBody: (p) =>
		`Ngày ${p.date} tài khoản của bạn về hạn mức cơ bản. Mọi thứ bạn đã tạo vẫn giữ nguyên, nhưng không tạo thêm được khi đang vượt hạn mức đó.`,
	endedTitle: "Hạn mức mở rộng đã kết thúc",
	endedBody: (p) =>
		`Từ ngày ${p.date} tài khoản của bạn về hạn mức cơ bản. Project, resource và dữ liệu vẫn được giữ nguyên; không tạo thêm được khi đang vượt hạn mức đó.`,
	requestedTitle: "Yêu cầu gia hạn dùng thử Pro",
	requestedBody: (p) =>
		`${p.user} xin gia hạn gói dùng thử Pro. Duyệt hoặc từ chối ở trang quản trị.`,
	approvedTitle: "Hạn mức mở rộng đã được kéo dài",
	approvedBody: (p) =>
		`Hạn mức mở rộng của bạn được dùng tới hết ngày ${p.date}.`,
	declinedTitle: "Yêu cầu chưa được duyệt",
	declinedBody:
		"Yêu cầu của bạn chưa được duyệt. Hạn mức mở rộng giữ nguyên ngày kết thúc hiện tại.",
	ownerAlert: (p) =>
		[
			"Yêu cầu gia hạn dùng thử Pro",
			`Người dùng: ${p.user}`,
			`Hết hạn dùng thử: ${p.date ?? "không có hạn"}`,
			"Quyết định ở trang quản trị: /admin/trial-extensions",
		].join("\n"),
};
