import type { Messages } from "../../message-types";

type Part = Pick<
	Messages["collections"],
	"status" | "tags" | "rightRail" | "info" | "links" | "activity"
>;

export const collectionsMeta: Part = {
	status: {
		add: "Thêm trạng thái",
		none: "chưa có trạng thái",
		label: "Trạng thái: {status}",
		custom: "Trạng thái riêng…",
		remove: "Bỏ trạng thái",
		customTitle: "Trạng thái riêng",
		name: "Tên",
		emoji: "Emoji",
		emojiOther: "Hoặc gõ một emoji",
		save: "Lưu trạng thái",
		presets: {
			stable: "Ổn định",
			inDevelopment: "Đang phát triển",
			inReview: "Đang review",
			deprecated: "Ngừng dùng",
		},
		problems: {
			nameLength: "Dùng từ {min} đến {max} ký tự.",
			nameStart: "Tên phải bắt đầu bằng một chữ cái.",
			nameCharacters: "Tên không được chứa ký tự ẩn hoặc ký tự điều khiển.",
			emoji: "Chọn đúng một emoji.",
		},
	},
	tags: {
		title: "Tag {count}/{max}",
		empty: "Chưa có tag nào.",
		input: "Tag mới",
		placeholder: "Thêm tag",
		add: "Thêm",
		remove: "Bỏ tag {tag}",
		hint: "Tối đa 10 tag, mỗi tag 1 đến {max} ký tự, bắt đầu và kết thúc bằng chữ hoặc số. Tag được lưu dạng chữ thường.",
		tooltip: "Tag: {tags}",
		problems: {
			empty: "Hãy gõ một tag trước.",
			tooLong: "Mỗi tag tối đa {max} ký tự.",
			edges: "Tag phải bắt đầu và kết thúc bằng chữ hoặc số.",
			characters: "Tag không được chứa ký tự ẩn hoặc ký tự điều khiển.",
			tooMany: "Mỗi collection có tối đa 10 tag.",
		},
	},
	rightRail: {
		label: "Chi tiết collection",
		info: "Thông tin",
		comments: "Comment",
		forks: "Fork",
		pullRequests: "Pull request",
		changelog: "Changelog",
		close: "Đóng panel",
		backdrop: "Đóng panel chi tiết",
	},
	info: {
		title: "Thông tin",
		id: "ID",
		copyId: "Sao chép ID",
		copied: "Đã sao chép ID.",
		created: "Ngày tạo",
		role: "Vai trò của bạn",
	},
	links: {
		environment: "Environment liên quan",
		mockProject: "Mock project liên quan",
		notLinked: "Chưa liên kết",
		none: "Không có",
		sharedHint: "Được share cùng collection này",
		choose: "Đổi environment liên quan",
		linked: "Đã liên kết {name} với collection này.",
		unlinked: "Collection này không còn environment liên quan.",
	},
	activity: {
		title: "Hoạt động gần đây",
		empty: "Chưa có hoạt động nào.",
		loadFailed: "Không tải được hoạt động.",
		openChangelog: "Mở changelog",
	},
};
