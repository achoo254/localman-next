import type { Messages } from "../../message-types";

/** `/docs/public-sharing`: chia sẻ collection ra ngoài workspace. */
export const docsPublicSharing: Messages["docs"]["publicSharing"] = {
	lead: "Chia sẻ collection với người ngoài workspace: trang chỉ đọc, trang cho khách đã đăng nhập, key cho script, hoặc nút Run in Localman cho README.",
	ways: {
		title: "Bốn cách chia sẻ",
		body: "Mở <em>Share</em> trên một collection. <em>Public</em> bật public link (ai có link cũng đọc được, không cần đăng nhập) và guest link (người đã đăng nhập đọc được và có thể xin quyền chỉnh sửa). <em>Keys</em> tạo access key chỉ đọc. <em>Run</em> tạo nút để người khác bấm và import collection vào workspace của họ. Mỗi link, key hay nút đều tắt được bất cứ lúc nào.",
	},
	hidden: {
		title: "Những gì luôn bị che",
		body: "Giá trị của biến <code>secret</code>; token, mật khẩu và API key gõ trong tab Authorization của collection, folder, request và example đã lưu; giá trị gõ thẳng của header, tham số query và field form có tên như credential (<code>Authorization</code>, <code>Cookie</code>, <code>Set-Cookie</code>, <code>X-API-Key</code>, <code>access_token</code>, <code>password</code>…); phần <code>user:password@</code> trong URL; và body response của mọi example đã lưu. Tham chiếu <code>{{variable}}</code> giữ nguyên. Giá trị local và giá trị environment chưa chia sẻ không bao giờ rời tài khoản của bạn.",
	},
	kept: {
		title: "Những gì được công khai nguyên văn",
		body: "Biến thường, body request, script và đường dẫn URL được công khai đúng như đã viết. Trước khi chia sẻ, Localman liệt kê chỗ có giá trị trông giống secret (không bao giờ hiện giá trị) để bạn đánh dấu <code>secret</code> hoặc chuyển sang biến trước.",
	},
	who: {
		title: "Ai được chia sẻ, và cách dừng",
		body: "Admin và Editor là thành viên của workspace chia sẻ được collection của nó; người chỉ được share riêng một collection thì không. Admin của workspace có ba công tắc trong phần cài đặt workspace: public link (kèm nút Run công khai), guest link và access key. Tắt một công tắc thì những gì nó bao gồm dừng ngay. Link cũng dừng khi collection vào thùng rác hoặc người tạo không còn là Admin hay Editor của workspace.",
	},
	keys: {
		title: "Access key",
		body: "Key đọc collection hiện tại dưới dạng JSON Collection v2.1: <code>GET /api/v1/public/collections/<angle>id collection</angle>?access_key=<angle>key</angle></code>. Key chỉ hiện một lần, ngừng sau 60 ngày không dùng và thu hồi được. Hãy giữ nó như mật khẩu: ai có key đều đọc được collection.",
	},
	run: {
		title: "Nút Run in Localman",
		body: "Copy đoạn HTML hoặc Markdown vào README. Người bấm sẽ đăng nhập, chọn một workspace của họ và import bản sao collection, kèm giá trị đã chia sẻ, không secret của environment nếu bạn gắn kèm. Nút team chỉ dùng được với thành viên workspace của bạn. Script chạy trong trình duyệt của người import, nên nút công khai mặc định không nhập script trừ khi người đó chọn.",
	},
};
