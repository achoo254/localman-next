import type { Messages } from "../../message-types";

export const docsReference: Messages["docs"]["reference"] = {
	queryParams: {
		caption: "Tham số query của route danh sách",
		headerParam: "Tham số",
		headerEffect: "Tác dụng",
		headerExample: "Ví dụ",
		search:
			"Tìm chuỗi con, không phân biệt hoa thường, trong mọi giá trị chuỗi ở cấp đầu của bản ghi (kể cả <code>id</code>). Gửi cả hai thì bản ghi phải chứa cả hai chuỗi.",
		field:
			"Lọc theo một field của schema, theo <code>id</code> hoặc <code>{parentId}</code>. Field chuỗi khớp chuỗi con không phân biệt hoa thường; số và boolean khớp đúng giá trị; <code>null</code> khớp chữ <code>null</code>; <code>id</code> và <code>{parentId}</code> khớp nguyên giá trị. Nhiều field thì bản ghi phải khớp tất cả. Tên không phải field bị bỏ qua.",
		page: "Số trang, đếm từ 1. Chỉ có tác dụng khi có <code>limit</code>. Thiếu hoặc sai thì là trang 1.",
		limit:
			"Số bản ghi mỗi trang, tối đa {max} (số lớn hơn được hạ về {max}). Không gửi thì nhận mọi bản ghi.",
		sort: 'Sắp xếp theo một field. Số và chuỗi chỉ chứa số được so như số, nên <code>"2"</code> đứng trước <code>"10"</code>. Field không tồn tại bị bỏ qua.',
		order: "<code>desc</code> để sắp giảm dần; mặc định tăng dần.",
		reserved:
			"Field có tên trùng một tham số dành riêng không lọc được, vì mock đọc tên đó như tham số: {names}. Đặt tên field khác nếu cần lọc theo nó.",
	},
	statusCodes: {
		caption: "Mã trạng thái và mã lỗi",
		headerCode: "Mã",
		headerWhen: "Khi nào",
		none: "Không có",
		ok: "GET, PUT, PATCH và DELETE thành công.",
		created: "POST đã tạo bản ghi; body là bản ghi mới kèm id.",
		invalidQuery:
			"Tên tham số query bắt đầu bằng <code>$</code>, chứa <code>.</code>, <code>[</code> hoặc <code>]</code>, là <code>__proto__</code>, <code>constructor</code>, <code>prototype</code>, hoặc một tham số xuất hiện hai lần.",
		invalidJson:
			"Body gửi kèm <code>Content-Type: application/json</code> nhưng không phải JSON hợp lệ.",
		validation:
			"Body là JSON nhưng không phải object, chứa key <code>__proto__</code>, <code>constructor</code> hoặc <code>prototype</code>, hoặc <code>{parentId}</code> không trỏ tới bản ghi cha có thật khi tạo bản ghi con qua route phẳng. Body lồng sâu hơn {depth} tầng hoặc có hơn {nodes} giá trị (mỗi object, mảng và giá trị đơn tính một) cũng bị từ chối với mã này.",
		badRequest:
			"Request bị ngắt khi body chưa gửi xong, hoặc máy chủ không đọc được request.",
		unauthenticated:
			'Chỉ ở MCP endpoint (<code>/mcp</code>) khi project bật "Yêu cầu token cho MCP": thiếu hoặc sai Bearer token. REST không bao giờ trả mã này.',
		notFoundText:
			"Sai secret (đúng định dạng), sai prefix, không có resource hoặc bản ghi đó, bản ghi cha trên route lồng không khớp, endpoint đang tắt, hoặc method không phục vụ route này (ví dụ POST lên <code>/:res/:id</code>). Body là đúng chuỗi JSON này.",
		notFoundCode:
			"Secret sai định dạng (chỉ nhận chữ thường, số và dấu gạch ngang, tối đa 63 ký tự), nên request không trỏ tới project nào. Body theo dạng lỗi chung: <code>{errorBody}</code>.",
		recordLimit: "Resource đã có {max} bản ghi, mức tối đa.",
		dataTooLarge:
			"Một bản ghi vượt {recordKb} KB, hoặc tổng dữ liệu của resource vượt {resourceMb} MB.",
		payloadTooLarge: "Body gửi lên lớn hơn {kb} KB.",
		unsupportedMediaType:
			"Body dùng <code>Content-Encoding</code> hoặc charset mà máy chủ không đọc được; gửi JSON UTF-8 không nén.",
		responseTooLarge:
			"Body trả về sẽ vượt {mb} MB; lấy ít bản ghi hơn bằng <code>limit</code>.",
		rateLimited:
			"Gửi quá nhanh (giới hạn theo IP và theo project). Chờ số giây trong header <code>Retry-After</code> rồi gửi lại.",
		monthlyQuota: "Chủ project đã dùng hết hạn mức request tháng.",
		monthlyQuotaFree:
			"Chủ project đã dùng hết hạn mức request tháng (gói Free: {requests} request tới mock mỗi tháng, tính chung cho mọi project của họ).",
		chaosError:
			"Lỗi do cài đặt chaos của endpoint tạo ra (theo tỉ lệ lỗi). Mã trạng thái là mã đã chọn ở đó.",
		chaosTimeout:
			"Timeout do cài đặt chaos của endpoint tạo ra: request chờ tới mốc delay tối đa (10 giây nếu để 0) rồi nhận phản hồi này.",
		requestCancelled:
			"Chỉ có ở Mock MCP: client đóng tool call khi nó đang chờ độ trễ chaos của endpoint. Tool trả lỗi này và không có gì bị thay đổi.",
		internal:
			"Lỗi phía máy chủ. Gửi kèm <code>X-Localman-Request-Id</code> khi báo lỗi.",
	},
};
