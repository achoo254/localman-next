import type { Messages } from "../../message-types";

export const docsQuickStart: Messages["docs"]["quickStart"] = {
	lead: "Tạo một mock REST API có dữ liệu thật để frontend hoặc test gọi vào, không cần dựng backend.",
	createProject: {
		title: "1. Tạo project",
		body: "Ở trang Projects, bấm Tạo project, đặt tên và nếu muốn thì thêm API Prefix như <code>/api/v1</code>. Mỗi project có một secret riêng nằm ngay trong URL của mock; thẻ API endpoint trong trang project hiện sẵn URL đầy đủ. Mỗi tài khoản có chỗ cho ít nhất {projects} project và tổng cộng {resources} resource.",
	},
	mockUrl: {
		title: "2. URL của mock API",
		caption: "Hai dạng URL của cùng một project",
		headerForm: "Dạng",
		headerUrl: "URL",
		headerWhen: "Dùng khi",
		subdomain: "Subdomain",
		subdomainWhen: "Mặc định.",
		path: "Đường dẫn",
		pathWhen:
			"Mạng hoặc công cụ của bạn không phân giải được subdomain riêng của project.",
		secret:
			"Secret có vai trò như mật khẩu: ai có URL đều đọc và ghi được dữ liệu mock. Chủ project bấm Đổi URL mock để cấp secret mới; URL cũ trả 404 ngay, dữ liệu giữ nguyên. Đường dẫn phân biệt chữ hoa và chữ thường.",
		cors: "Mock trả JSON và cho phép mọi origin gọi qua CORS (không gửi cookie), nên trang web chạy ở đâu cũng gọi thẳng được. Mỗi response có header <code>X-Localman-Request-Id</code>, hãy gửi kèm mã này khi cần hỗ trợ.",
	},
	addResource: {
		title: "3. Thêm resource và sinh dữ liệu",
		body: 'Bấm Thêm resource và đặt tên theo số nhiều, ví dụ <code>customers</code>: tên này là đoạn đầu của route. Schema là danh sách field của mỗi bản ghi; field có thể là kiểu cơ bản hoặc một method Faker để sinh tên, email, ngày tháng… Rê chuột trên thanh sinh dữ liệu của resource rồi bấm vào số bản ghi muốn có (0 đến {max}). Mỗi bản ghi có <code>id</code> dạng chuỗi, đánh số từ <code>"1"</code>.',
	},
	endpoints: {
		title: "4. Năm endpoint của một resource",
		caption: "Endpoint của resource customers",
		headerResult: "Kết quả",
		list: "200: mảng bản ghi. Lọc, sắp xếp và phân trang qua query.",
		get: "200: một bản ghi.",
		post: "201: bản ghi mới, id là số kế tiếp. Field của schema mà body bỏ trống được sinh như khi bấm sinh dữ liệu.",
		put: "200: field trong body được gộp vào bản ghi, field không gửi giữ nguyên. Không đổi được id.",
		delete:
			"200: bản ghi vừa xoá. Mọi bản ghi con của nó ở các resource lồng bên dưới cũng bị xoá.",
		body: "Body của POST, PUT và PATCH là một object JSON, gửi kèm header <code>Content-Type: application/json</code>; thiếu header này thì body bị coi như rỗng. Từng endpoint tắt được hoặc đổi được hình dạng body trả về, xem <link>Custom responses</link>.",
	},
	nested: {
		title: "5. Route lồng",
		intro:
			"Trên cây resource, bấm chấm tròn bên trái <code>orders</code> rồi bấm chấm tròn bên phải <code>customers</code> để lồng, khi đó mỗi order thuộc về một customer. Bản ghi của <code>orders</code> có thêm field <code>customerId</code> (tên cha ở số ít cộng <code>Id</code>), và mock phục vụ cả route lồng lẫn route phẳng:",
		caption: "Route của orders",
		parentCheck:
			"Route lồng kiểm tra từng bản ghi cha trên đường dẫn: customer 3 không tồn tại, hoặc order 12 thuộc customer khác, thì trả 404. POST trên route lồng lấy <code>customerId</code> từ đường dẫn; POST trên route phẳng cần <code>customerId</code> trỏ tới một customer có thật, nếu không sẽ nhận 400.",
		depth:
			"Cây lồng được tới {depth} tầng, ví dụ <code>/customers/3/orders/12/items</code>. Route phẳng <code>/orders</code> chỉ trỏ tới resource lồng khi không resource nào khác trong cây trùng tên; nếu có một resource gốc cùng tên thì route phẳng thuộc về resource gốc đó.",
	},
	query: {
		title: "6. Lọc, sắp xếp, phân trang",
		intro:
			"Route danh sách (cả phẳng lẫn lồng) nhận các tham số dưới đây, kết hợp tuỳ ý. Thứ tự xử lý là lọc, rồi sắp xếp, rồi cắt trang. Ví dụ đầy đủ ở <link>Code examples</link>.",
		rejected:
			"Tên tham số bắt đầu bằng <code>$</code>, chứa <code>.</code> hoặc ngoặc vuông, và tham số gửi hai lần đều bị từ chối với 400 <code>INVALID_QUERY</code>, nên cú pháp toán tử kiểu <code>?price[$gt]=10</code> không dùng được.",
	},
	status: {
		title: "7. Mã trạng thái và lỗi",
		body: 'Lỗi có body dạng <code>{errorBody}</code>. Riêng 404 khi secret đúng định dạng trả về đúng chuỗi JSON <code>"Not found"</code>; secret sai định dạng nhận lỗi dạng chung với <code>NOT_FOUND</code>. Dựa vào <code>code</code> để xử lý, vì <code>message</code> có thể đổi câu chữ.',
	},
};
