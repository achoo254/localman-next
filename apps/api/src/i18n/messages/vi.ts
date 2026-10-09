import type { ServerMessages } from "./en.js";

/** Vietnamese server texts: the wording Localman used before i18n. */
export const vi: ServerMessages = {
	/** "10/2026", read after "tháng". */
	formatMonth: (year, month) => `${String(month).padStart(2, "0")}/${year}`,
	eventLabels: {
		"project.invitation": "Lời mời cộng tác project",
		"project.mockUrlChanged": "URL mock của project được chia sẻ đã đổi",
		"usage.quota": "Cảnh báo hạn mức lượt gọi mock tháng",
	},
	invitation: {
		title: "Lời mời cộng tác project",
		body: (p) =>
			`${p.inviter ?? "Chủ project"} mời bạn cộng tác trong project "${p.project}". Lời mời hết hạn sau ${p.days} ngày.`,
	},
	mockUrlChanged: {
		title: "URL mock đã đổi",
		body: (p) =>
			`Chủ project đã đổi URL mock của project "${p.project}". URL cũ không còn hoạt động; hãy dùng URL mới trong trang project.`,
	},
	quota: {
		usedUpTitle: "Đã hết lượt gọi mock API tháng này",
		usedUpBody: (p) =>
			`Các project của bạn đã dùng hết ${p.limit} lượt gọi mock API của tháng ${p.month}. Mock API trả 429 cho tới đầu tháng sau hoặc khi bạn nâng cấp Pro.`,
		warningTitle: (p) => `Đã dùng ${p.threshold}% lượt gọi mock API tháng này`,
		warningBody: (p) =>
			`Các project của bạn đã dùng ${p.used}/${p.limit} lượt gọi mock API của tháng ${p.month}.`,
	},
	ownerAlerts: {
		suppressed: (count) =>
			`(và ${count} lượt khác chưa báo vì vượt giới hạn tin báo)`,
		contactCategories: {
			feedback: "Góp ý",
			bug: "Báo lỗi",
			plan_question: "Hỏi về gói",
		},
		contact: (p) =>
			[
				`Góp ý / Liên hệ mới: ${p.category}`,
				`Nội dung: ${p.excerpt}`,
				`Liên hệ: ${p.contact ?? "không để lại"}`,
				`Người gửi: ${p.signedIn ? "đã đăng nhập" : "khách"}`,
				`Nguồn: ${p.source}`,
			].join("\n"),
		proInterestHeadlines: {
			created: "Quan tâm gói Pro: đăng ký mới",
			updated: "Quan tâm gói Pro: cập nhật",
			recorded: "Quan tâm gói Pro: gửi lại từ người khác (chỉ lưu lịch sử)",
		},
		proInterest: (p) =>
			[
				p.headline,
				`Email: ${p.email}`,
				`Nhu cầu: ${p.needs}`,
				`Quy mô: ${p.teamSize}`,
				`Nguồn: ${p.source}`,
			].join("\n"),
	},
};
