import type { ServerMessages } from "./en.js";
import { trialVi } from "./trial-vi.js";

/** Vietnamese server texts: the wording Localman used before i18n. */
export const vi: ServerMessages = {
	/** "10/2026", read after "tháng". */
	formatMonth: (year, month) => `${String(month).padStart(2, "0")}/${year}`,
	eventLabels: {
		"project.invitation": "Lời mời cộng tác project",
		"project.mockUrlChanged": "URL mock của project được chia sẻ đã đổi",
		"usage.quota": "Cảnh báo hạn mức lượt gọi mock tháng",
		"trial.ending": "Hạn mức mở rộng sắp kết thúc",
		"trial.ended": "Hạn mức mở rộng đã kết thúc",
		"trial.extension.requested": "Yêu cầu gia hạn dùng thử Pro (owner)",
		"trial.extension.approved": "Hạn mức mở rộng được gia hạn",
		"trial.extension.declined": "Hạn mức mở rộng không được gia hạn",
		"workspace.invitation": "Lời mời vào workspace",
		"element.shared": "Collection và environment được chia sẻ với bạn",
		"access.requested": "Yêu cầu truy cập collection và environment của bạn",
		"access.resolved": "Kết quả yêu cầu truy cập của bạn",
		"comment.mentioned": "Được nhắc đến trong comment",
		"comment.replied": "Trả lời trong thread comment bạn đã viết",
		"collection.changed": "Thay đổi ở collection bạn đang theo dõi",
		"pullRequest.opened": "Pull request chờ bạn review",
		"pullRequest.reviewed": "Kết quả review pull request của bạn",
		"pullRequest.merged": "Pull request của bạn đã được merge",
	},
	roleNames: { admin: "Admin", editor: "Editor", viewer: "Viewer" },
	elementNames: { collection: "collection", environment: "environment" },
	workspaceInvitation: {
		title: "Lời mời vào workspace",
		body: (p) =>
			`${p.inviter ?? "Admin của workspace"} mời bạn vào workspace "${p.workspace}" với vai trò ${p.role}. Lời mời hết hạn sau ${p.days} ngày.`,
	},
	elementShared: {
		title: "Được chia sẻ với bạn",
		body: (p) =>
			`${p.sharer ?? "Một người dùng"} đã chia sẻ ${p.kind} "${p.element}" với bạn, vai trò ${p.role}.`,
	},
	accessRequested: {
		title: "Yêu cầu truy cập",
		body: (p) =>
			`${p.requester} xin quyền ${p.role} cho ${p.kind} "${p.element}".`,
	},
	accessResolved: {
		approvedTitle: "Yêu cầu truy cập đã được duyệt",
		approvedBody: (p) =>
			`Bạn đã có quyền ${p.role} với ${p.kind} "${p.element}".`,
		deniedTitle: "Yêu cầu truy cập bị từ chối",
		deniedBody: (p) =>
			`Yêu cầu quyền ${p.role} với ${p.kind} "${p.element}" của bạn đã bị từ chối.`,
	},
	commentMentioned: {
		title: "Bạn được nhắc trong comment",
		body: (p) =>
			`${p.author ?? "Một người dùng"} đã nhắc đến bạn trong comment ở ${p.item === null ? "" : `"${p.item}" thuộc `}collection "${p.collection}".`,
	},
	commentReplied: {
		title: "Có trả lời mới",
		body: (p) =>
			`${p.author ?? "Một người dùng"} đã trả lời trong thread ở ${p.item === null ? "" : `"${p.item}" thuộc `}collection "${p.collection}".`,
	},
	collectionChanged: {
		title: "Collection đã thay đổi",
		body: (p) =>
			p.authors === 1
				? `${p.author ?? "Một người dùng"} đã thực hiện ${p.changes} thay đổi ở collection "${p.collection}".`
				: `${p.authors} người đã thực hiện ${p.changes} thay đổi ở collection "${p.collection}".`,
	},
	pullRequestOpened: {
		title: "Có yêu cầu review",
		body: (p) =>
			`${p.author ?? "Một người dùng"} nhờ bạn review pull request "${p.title}" vào collection "${p.collection}".`,
	},
	pullRequestReviewed: {
		approvedTitle: "Pull request đã được duyệt",
		approvedBody: (p) =>
			`${p.author ?? "Một reviewer"} đã duyệt pull request "${p.title}" của bạn vào collection "${p.collection}".`,
		declinedTitle: "Pull request bị từ chối",
		declinedBody: (p) =>
			`${p.author ?? "Một reviewer"} đã từ chối pull request "${p.title}" của bạn vào collection "${p.collection}".`,
	},
	pullRequestMerged: {
		title: "Pull request đã được merge",
		body: (p) =>
			`${p.author ?? "Một người dùng"} đã merge pull request "${p.title}" của bạn vào collection "${p.collection}".`,
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
			`Các project của bạn đã dùng hết ${p.limit} lượt gọi mock API của tháng ${p.month}. Mock API trả 429 cho tới đầu tháng sau.`,
		warningTitle: (p) => `Đã dùng ${p.threshold}% lượt gọi mock API tháng này`,
		warningBody: (p) =>
			`Các project của bạn đã dùng ${p.used}/${p.limit} lượt gọi mock API của tháng ${p.month}.`,
	},
	testNotification: {
		title: "Thông báo thử",
		body: "Bạn đọc được dòng này nghĩa là thông báo của Localman đã tới được kênh này.",
	},
	apiClient: {
		proxyBusyUser: (p) =>
			`Bạn đang có ${p.max} request chạy qua proxy; chờ một request xong rồi thử lại.`,
		proxyBusyServer:
			"Proxy đang bận với các request khác; thử lại sau giây lát.",
		tunnelUrlInvalid: (p) =>
			`URL tunnel phải có dạng https://<tên>.<domain>, không có port, path hay query, và domain là một trong: ${p.domains}.`,
		tunnelsDisabled: "Server này chưa bật URL tunnel.",
	},
	traffic: {
		tunnelMissing: (p) =>
			`Chưa có tunnel nào gắn với localhost:${p.port} trong thiết lập API client của chủ project. Chạy "tunelo http ${p.port}" rồi thêm URL của nó làm tunnel cho localhost:${p.port}.`,
		tunnelDown: (p) =>
			`Tunnel tới localhost:${p.port} không phản hồi. Kiểm tra "tunelo http ${p.port}" và server local còn đang chạy.`,
		unreachable: "Upstream không phản hồi (kết nối lỗi hoặc quá thời gian).",
		blocked:
			"Upstream trỏ tới địa chỉ private, loopback hoặc link-local nên không được gọi tới.",
		responseTooLarge: (p) => `Response của upstream lớn hơn ${p.mb} MB.`,
		busy: "Có quá nhiều request đang chờ upstream của project này; thử lại sau giây lát.",
		loop: "Request từ upstream quay lại một mock của Localman; kiểm tra thiết lập upstream của project.",
		baseUrlInvalid:
			"URL upstream phải có dạng https://host[:port][/path], không có thông tin đăng nhập, query hay fragment, và không được là URL mock của Localman.",
		baseUrlBlocked:
			"URL upstream trỏ tới địa chỉ private, loopback hoặc link-local; hãy mở server local bằng tunnel Tunelo.",
		baseUrlDns: "Không phân giải được tên host của upstream.",
		replayBodyTruncated:
			"Body của request này đã bị cắt ở 64 KB trong log nên không gửi lại đúng được.",
		replayFailed: "Request gửi lại không nhận được phản hồi từ mock.",
		streamLimit: (p) =>
			`Bạn đang mở ${p.max} log request trực tiếp; đóng bớt một cái rồi thử lại.`,
		callbackUrlInvalid:
			"URL callback phải có dạng https://…, không có thông tin đăng nhập hay fragment, và không được là URL mock của Localman. Muốn gửi về máy bạn thì dùng tunnel:<port><path>.",
		callbackUrlBlocked:
			"Địa chỉ này trỏ vào mạng private nên Localman không gửi callback tới được. Hãy mở server local bằng tunnel Tunelo.",
		callbackDns: "Không phân giải được tên host của URL callback.",
	},
	trial: trialVi,
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
