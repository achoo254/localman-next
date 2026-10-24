import type { Messages } from "../../message-types";

export const dataTransparency: Messages["dataTransparency"] = {
	nav: "Dữ liệu của bạn",
	title: "Dữ liệu của bạn nằm ở đâu",
	intro:
		"{app} giữ gì trên thiết bị của bạn, gì tới máy chủ và giữ bao lâu, ghi log những gì. Thời gian giữ và các trường log trên trang này lấy từ chính cấu hình mà ứng dụng đang chạy.",
	promise: {
		title: "Secret không rời trình duyệt",
		body: "Giá trị riêng của các biến secret được mã hoá ngay trong trình duyệt bằng passphrase chỉ bạn biết; máy chủ chỉ giữ bản mã. Request đi thẳng từ trình duyệt tới API bạn gọi mỗi khi trình duyệt gửi được. Khi {app} định tự chuyển một request mang secret hay thông tin đăng nhập sang proxy của nó, {app} hỏi bạn trước.",
		exceptions:
			"Các ngoại lệ, đều do bạn chọn: request bạn gửi qua proxy (tab đặt Proxy, host bạn luôn cho phép, hoặc “Gửi qua proxy” sau một lần gửi lỗi) mang secret của nó đi qua máy chủ; secret bạn cho agent dùng được chép lên máy chủ, đã mã hoá, cho các host bạn liệt kê; và giá trị dùng chung của biến secret được mã hoá bằng khoá của máy chủ để người bạn chia sẻ dùng được.",
	},
	places: {
		device: "Thiết bị của bạn",
		serverSealed: "Máy chủ, đã niêm phong",
		serverEncrypted: "Máy chủ, đã mã hoá",
		server: "Máy chủ",
		passing: "Chỉ đi qua",
	},
	table: {
		caption: "Dữ liệu của API client, nằm ở đâu và giữ bao lâu",
		data: "Dữ liệu",
		where: "Nơi lưu",
		kept: "Thời gian giữ",
	},
	kept: {
		neverSent: "Không bao giờ gửi đi",
		untilDeleted: "Tới khi bạn xoá",
		notStored: "Không lưu",
		days: { one: "{count} ngày", other: "{count} ngày" },
		daysByLimits: "{standard} ngày, {extended} ngày với hạn mức mở rộng",
		cap: "tối đa {count} mục",
	},
	items: {
		vaultPassphrase: {
			title: "Passphrase và khoá của kho",
			detail:
				"Chỉ gõ trong trình duyệt. Khoá nằm trong bộ nhớ của trình duyệt này và không bao giờ được gửi đi. Quên passphrase thì mất các giá trị nó đã niêm phong.",
		},
		vaultValues: {
			title: "Giá trị riêng của biến secret",
			detail:
				"Được niêm phong trong trình duyệt trước khi lưu. Máy chủ giữ bản mã gắn với tên và phạm vi của biến, và không mở được. Giá trị lưu trước khi bạn có kho vẫn được mã hoá bằng khoá của máy chủ cho tới lần đầu kho mở, rồi chuyển vào kho.",
		},
		directSends: {
			title: "Request gửi thẳng",
			detail:
				"Đi từ trình duyệt tới API bạn gọi. Request đã điền biến và response không bao giờ tới {app}; lịch sử chỉ giữ những gì dòng của nó nêu.",
		},
		proxySends: {
			title: "Request gửi qua proxy",
			detail:
				"Khi trình duyệt không gửi được request như đã viết (header trình duyệt chặn, API không bật CORS) hoặc bạn chọn proxy, máy chủ {app} gửi giúp bạn rồi chuyển response lại, không lưu cả hai. Request tới ứng dụng trên máy bạn còn đi qua tunnel Tunelo, và web server của tunnel ghi log path cùng query.",
		},
		agentCopies: {
			title: "Secret bạn cho agent dùng",
			detail:
				"Chỉ với biến bạn bật “Cho agent dùng”: một bản sao mã hoá bằng khoá của máy chủ, chỉ được điền vào request tới các host bạn liệt kê. {app} không bao giờ cho agent xem và che nó trong các câu trả lời; giá trị ngắn hơn 4 ký tự, hoặc bị API biến đổi trước khi trả lại, có thể lọt qua.",
		},
		sharedSecrets: {
			title: "Giá trị dùng chung của biến secret",
			detail:
				"Của environment và globals: mã hoá bằng khoá của máy chủ để người bạn chia sẻ dùng được, và không bao giờ gửi cho người chỉ xem.",
		},
		collectionSecrets: {
			title: "Biến secret của collection",
			detail:
				"Lưu nguyên dạng và gửi cho mọi người mở được collection; ứng dụng chỉ che trên màn hình và bỏ ra khỏi file export, link công khai và agent.",
		},
		variables: {
			title: "Các biến khác",
			detail: "Lưu đúng như bạn đặt, trong workspace của bạn.",
		},
		collections: {
			title: "Collection, request và example",
			detail: "Lưu để bạn mở ở bất cứ đâu và chia sẻ được.",
		},
		requestTabs: {
			title: "Các tab request đang mở",
			detail:
				"Lưu đúng như bạn viết, <code>{token}</code> để nguyên chưa điền; thông tin đăng nhập gõ thẳng (không qua biến) được lưu như đã gõ.",
		},
		history: {
			title: "Lịch sử request",
			detail:
				"Mỗi request như đã viết, <code>{token}</code> để nguyên chưa điền và thông tin đăng nhập gõ thẳng bị để trống, kèm status, thời gian, kích thước của response và, sau redirect của một URL viết không dùng biến, nơi nó dừng (không có query); không bao giờ có header hay body của response.",
		},
		mockLogs: {
			title: "Log request của mock",
			detail:
				"Request tới mock API của bạn và response của chúng, kèm query, header và body; header Authorization, Cookie, Set-Cookie, X-API-Key và các header bạn chọn ẩn được lưu thành “[redacted]”.",
		},
		backups: {
			title: "Bản sao lưu hằng đêm",
			detail:
				"Của toàn bộ cơ sở dữ liệu, trên cùng máy chủ: dữ liệu đã xoá có thể còn trong một bản tới khi bản đó bị thay.",
		},
	},
	fieldLine: "<code>{field}</code>: {label}",
	proxyLog: {
		title: "Proxy ghi log những gì",
		body: "Mỗi request một dòng, chỉ với các trường này. Không bao giờ có path, query, header hay body.",
		fields: {
			sub: "ID tài khoản của bạn",
			host: "host đích, secret trong đó và nhãn secret của mock API bị che",
			method: "method",
			status: "status của response",
			error: "hoặc mã lỗi",
			ms: "thời gian xử lý",
			via: "tunnel mà đích nội bộ đi qua",
		},
	},
	serverLog: {
		title: "Máy chủ ghi log những gì",
		body: "Mỗi request tới {app} một dòng, chỉ với các trường này. Không bao giờ có header, cookie, body hay query. Khi máy chủ gặp lỗi, có thêm một dòng ghi lỗi đó.",
		fields: {
			requestId: "một ID để tìm lại dòng log",
			method: "method",
			route:
				"route dạng mẫu; với mock API là path của nó, secret của project bị che",
			status: "status của response",
			ms: "thời gian xử lý",
			projectId: "project mock, khi request liên quan tới một project",
			aborted: "có khi client ngắt kết nối giữa chừng",
		},
	},
	webServerLog: {
		title: "Web server ghi log những gì",
		body: "Web server đứng trước {app} ghi mỗi request một dòng, chỉ với các trường này. Không bao giờ có tên host, query, cookie hay trang bạn đến từ đó.",
		fields: {
			ip: "địa chỉ IP của bạn",
			time: "thời điểm",
			method: "method",
			path: "path, query bị ẩn",
			status: "status của response",
			bytes: "kích thước response",
			userAgent: "tên và phiên bản trình duyệt",
			duration: "thời gian xử lý",
		},
	},
	telemetry: {
		title: "Telemetry",
		body: "Không có. {app} không dùng dịch vụ phân tích, theo dõi hay báo lỗi nào, và không hiện quảng cáo.",
	},
	more: "<privacy>Chính sách quyền riêng tư</privacy> nói về tài khoản, việc đăng nhập và các dịch vụ khác có liên quan.",
	landing: {
		eyebrow: "Riêng tư",
		title: "Secret không rời trình duyệt",
		lead: "Giá trị riêng của các biến secret được mã hoá ngay trong trình duyệt bằng passphrase chỉ bạn biết, và request đi thẳng từ trình duyệt mỗi khi nó gửi được. Nếu {app} định tự chuyển một request mang secret sang proxy của nó, {app} hỏi bạn trước.",
		points: {
			sealed: "Máy chủ chỉ giữ bản mã mà nó không mở được.",
			direct: "Request gửi thẳng không bao giờ chạm máy chủ {app}.",
			agents:
				"Agent chỉ dùng secret ở nơi bạn cho phép; {app} không bao giờ cho agent xem nó.",
		},
		link: "Dữ liệu của bạn nằm ở đâu",
	},
};
