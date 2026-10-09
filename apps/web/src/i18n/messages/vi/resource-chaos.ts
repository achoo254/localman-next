import type { Messages } from "../../message-types";

export const resourceChaos: Messages["resourceChaos"] = {
	toggle: "Chaos",
	toggleLabel: "Chaos cho {endpoint}",
	badge: "chaos",
	summaryDelay: "{min}–{max} ms",
	summaryErrors: "{rate}% lỗi ({status})",
	summaryRateLimit: "{rate}% trả 429",
	summaryTimeouts: "{rate}% timeout",
	intro:
		"Làm endpoint này chậm hoặc chập chờn để thử trạng thái đang tải, cơ chế thử lại và xử lý lỗi.",
	order:
		"Quy tắc chạy trước. Request khớp một quy tắc vẫn chờ delay, nhưng chỉ request không khớp quy tắc nào mới bị lỗi, 429 hoặc timeout.",
	delay: "Delay",
	min: "Tối thiểu",
	max: "Tối đa",
	minLabel: "Delay tối thiểu tính bằng mili giây",
	maxLabel: "Delay tối đa tính bằng mili giây",
	delayHint:
		"Mỗi response chờ một khoảng ngẫu nhiên trong khoảng này, tối đa {max} ms.",
	errorRate: "Tỉ lệ lỗi",
	errorRateLabel: "Tỉ lệ lỗi tính bằng phần trăm",
	errorRateHint: "Phần request trả lỗi với mã trạng thái bên cạnh.",
	errorStatus: "Mã lỗi",
	rateLimitRate: "Tỉ lệ 429",
	rateLimitRateLabel: "Tỉ lệ 429 tính bằng phần trăm",
	rateLimitHint:
		"Phần request nhận 429 Too Many Requests, kèm header <code>Retry-After</code>.",
	timeoutRate: "Tỉ lệ timeout",
	timeoutRateLabel: "Tỉ lệ timeout tính bằng phần trăm",
	timeoutHint:
		"Phần request bị giữ kết nối tới mốc delay tối đa (10 giây nếu để 0, tối đa 30 giây), rồi nhận 504.",
	off: "Tắt chaos",
	endpointOff: "Bật endpoint này để dùng quy tắc và chaos.",
	errors: {
		delayRange: "Nhập số mili giây nguyên từ 0 đến {max}.",
		delayOrder: "Tối thiểu không được lớn hơn tối đa.",
		rate: "Nhập phần trăm từ 0 đến 100.",
		rateSum: "Tổng tỉ lệ lỗi, tỉ lệ 429 và tỉ lệ timeout không được quá 100%.",
	},
};
