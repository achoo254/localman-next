import type { Messages } from "../../message-types";
import { publicSharingShare } from "./public-sharing-share";
import { publicSharingView } from "./public-sharing-view";

export const publicSharing: Messages["publicSharing"] = {
	errors: {
		forbidden:
			"Chỉ Admin và Editor của workspace mới công khai được collection này.",
		publicLinksDisabled:
			"Workspace này đang tắt public link. Admin có thể bật lại trong cài đặt workspace.",
		guestsDisabled:
			"Workspace này đang tắt guest link. Admin có thể bật lại trong cài đặt workspace.",
		accessKeysDisabled:
			"Workspace này đang tắt access key. Admin có thể bật lại trong cài đặt workspace.",
		accessKeyLimit:
			"Bạn đã có số access key tối đa cho collection này. Hãy thu hồi một key để tạo key mới.",
		runButtonLimit:
			"Collection này đã có số nút Run tối đa. Hãy xoá một nút để tạo nút mới.",
		environmentNotInWorkspace:
			"Environment đó không thuộc workspace của collection này. Hãy chọn environment khác.",
		linkNotFound: "Link này không tồn tại hoặc đã bị tắt.",
		runButtonNotFound: "Nút Run này không tồn tại hoặc đã bị xoá.",
		rateLimited: "Có quá nhiều yêu cầu. Vui lòng đợi một phút rồi thử lại.",
		collectionLimit:
			"Workspace đó đã đủ số collection tối đa. Hãy chọn workspace khác hoặc xoá bớt một collection.",
		collectionTooLarge: "Collection này quá lớn để import.",
		importInProgress: "Lượt import này đang chạy. Đợi một lát rồi thử lại.",
		workspaceUnavailable:
			"Bạn không thêm được collection vào workspace đó. Hãy chọn workspace khác.",
		invalid: "Kiểm tra lại giá trị bạn đã nhập rồi thử lại.",
		notFound: "Mục này không còn nữa.",
		fallback: "Đã có lỗi xảy ra. Vui lòng thử lại.",
	},
	warning: {
		none: "Không thấy giá trị nào trông giống secret.",
		found: {
			other: "{count} giá trị trông giống secret",
		},
		foundText:
			"Hãy kiểm tra các vị trí này. Giá trị ở đó sẽ được công khai nếu bạn không chuyển chúng vào biến secret.",
		plainNote:
			"Biến secret và thông tin đăng nhập trong tab Authorization được ẩn. Biến thường được công khai nguyên trạng, body, script và URL cũng vậy.",
		root: "Collection",
		list: "Các vị trí có giá trị trông giống secret",
		places: {
			collectionVariable: "Biến của collection",
			environmentVariable: "Biến của environment",
			script: "Script",
			requestBody: "Body của request",
			requestHeader: "Header của request",
			exampleHeader: "Header của example",
			url: "URL",
		},
	},
	share: publicSharingShare,
	view: publicSharingView,
};
