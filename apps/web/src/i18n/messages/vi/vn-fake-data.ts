import type { Messages } from "../../message-types";

export const vnFakeData: Messages["vnFakeData"] = {
	meta: {
		title: "Tạo dữ liệu giả kiểu Việt Nam",
		description:
			"Tạo dữ liệu thử nghiệm kiểu Việt Nam ngay trên trình duyệt: họ tên, địa chỉ theo 34 tỉnh thành, số di động, số CCCD 12 chữ số và công ty. Sao chép hoặc tải CSV, JSON. Dữ liệu giả, chỉ dùng để thử nghiệm.",
	},
	page: {
		badge: "Dữ liệu thử nghiệm",
		title: "Dữ liệu giả kiểu Việt Nam",
		intro:
			"Họ tên, địa chỉ, số di động, số CCCD và công ty trông như thật, tạo ngay trên trình duyệt của bạn. Không gửi đi, không lưu lại.",
	},
	notice: {
		title: "Dữ liệu giả, chỉ dùng để thử nghiệm",
		text: "Mọi giá trị đều được tạo ngẫu nhiên để thử nghiệm. Chúng không thuộc về người, thuê bao, thẻ căn cước hay công ty có thật nào: đừng dùng để định danh ai hay đưa vào giấy tờ chính thức.",
	},
	form: {
		legend: "Dữ liệu cần tạo",
		type: "Loại dữ liệu",
		count: "Số lượng",
		countHint: "Từ 1 đến {max} bản ghi.",
		countError: "Nhập một số nguyên từ 1 đến {max}.",
		locale: "Ngôn ngữ của dữ liệu",
		generate: "Tạo dữ liệu mới",
	},
	types: {
		person: "Người",
		address: "Địa chỉ",
		phone: "Số di động",
		cccd: "Số CCCD",
		company: "Công ty",
	},
	locales: {
		vi: "Tiếng Việt",
		en: "Tiếng Anh, không dấu",
	},
	view: {
		legend: "Xem dạng",
		table: "Bảng",
		json: "JSON",
	},
	columns: {
		fullName: "Họ tên",
		gender: "Giới tính",
		dateOfBirth: "Ngày sinh",
		cccd: "CCCD",
		street: "Số nhà, đường",
		ward: "Phường",
		province: "Tỉnh, thành",
		full: "Địa chỉ đầy đủ",
		number: "Số",
		international: "Dạng quốc tế",
		carrier: "Nhà mạng",
		provinceCode: "Mã tỉnh",
		birthYear: "Năm sinh",
		name: "Tên",
		taxCode: "Mã số thuế",
		address: "Địa chỉ",
		phone: "Điện thoại",
	},
	genders: {
		male: "Nam",
		female: "Nữ",
	},
	preview: {
		caption: { other: "{count} bản ghi giả" },
	},
	actions: {
		copy: "Sao chép JSON",
		downloadCsv: "Tải CSV",
		downloadJson: "Tải JSON",
		copied: { other: "Đã sao chép {count} bản ghi dạng JSON." },
		copyBlocked:
			"Trình duyệt đã chặn bộ nhớ tạm. Hãy tải file JSON thay vì sao chép.",
		downloaded: "Đã tải {file}.",
	},
	nudge: {
		title: "Dùng dữ liệu này làm mock API",
		text: "Đăng nhập để tạo resource với các field như thế này, sinh bản ghi và có ngay endpoint CRUD.",
		signIn: "Đăng nhập để tạo resource",
		openProjects: "Tạo resource",
	},
	landing: {
		title: "Tạo dữ liệu giả kiểu Việt Nam",
		text: "Họ tên, địa chỉ, số di động, số CCCD và công ty cho bài kiểm thử của bạn, ngay trên trình duyệt, không cần đăng nhập.",
		link: "Mở công cụ",
	},
};
