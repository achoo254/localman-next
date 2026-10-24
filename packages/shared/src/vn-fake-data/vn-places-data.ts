/**
 * Places for Vietnamese fake addresses, on the two-level map in force
 * since 1 July 2025: 34 provinces and centrally run cities, each with a
 * few of its wards. The ward lists are a sample for realistic-looking
 * test data, not a complete or authoritative register.
 */
export interface VnProvince {
	readonly name: string;
	/** Centrally run city ("Thành phố") or province ("Tỉnh"). */
	readonly kind: "city" | "province";
	readonly wards: readonly string[];
}

const city = (name: string, wards: string[]): VnProvince => ({
	name,
	kind: "city",
	wards,
});
const province = (name: string, wards: string[]): VnProvince => ({
	name,
	kind: "province",
	wards,
});

export const VN_PROVINCES: readonly VnProvince[] = [
	city("Hà Nội", [
		"Hoàn Kiếm",
		"Cửa Nam",
		"Ba Đình",
		"Ngọc Hà",
		"Giảng Võ",
		"Hai Bà Trưng",
		"Bạch Mai",
		"Đống Đa",
		"Láng",
		"Tây Hồ",
		"Cầu Giấy",
		"Nghĩa Đô",
		"Yên Hòa",
		"Thanh Xuân",
		"Hoàng Mai",
		"Long Biên",
		"Hà Đông",
	]),
	city("Hồ Chí Minh", [
		"Sài Gòn",
		"Tân Định",
		"Bến Thành",
		"Cầu Ông Lãnh",
		"Bàn Cờ",
		"Xuân Hòa",
		"Nhiêu Lộc",
		"Chợ Lớn",
		"Bình Thạnh",
		"Gia Định",
		"Phú Nhuận",
		"Gò Vấp",
		"Tân Bình",
		"Thủ Đức",
		"Thủ Dầu Một",
		"Dĩ An",
		"Vũng Tàu",
		"Bà Rịa",
	]),
	city("Hải Phòng", [
		"Hồng Bàng",
		"Ngô Quyền",
		"Lê Chân",
		"Hải An",
		"Kiến An",
		"Hải Dương",
	]),
	city("Đà Nẵng", [
		"Hải Châu",
		"Hòa Cường",
		"Thanh Khê",
		"Sơn Trà",
		"Ngũ Hành Sơn",
		"Liên Chiểu",
		"Cẩm Lệ",
		"Hội An",
		"Tam Kỳ",
	]),
	city("Huế", ["Thuận Hóa", "Phú Xuân", "Kim Long", "Vỹ Dạ", "An Cựu"]),
	city("Cần Thơ", [
		"Ninh Kiều",
		"Cái Khế",
		"Bình Thủy",
		"Cái Răng",
		"Vị Thanh",
	]),
	province("Cao Bằng", ["Thục Phán", "Tân Giang"]),
	province("Điện Biên", ["Điện Biên Phủ", "Mường Thanh"]),
	province("Lai Châu", ["Tân Phong", "Đoàn Kết"]),
	province("Sơn La", ["Tô Hiệu", "Chiềng An"]),
	province("Lạng Sơn", ["Đông Kinh", "Lương Văn Tri", "Tam Thanh"]),
	province("Quảng Ninh", ["Hạ Long", "Bãi Cháy", "Cẩm Phả", "Uông Bí"]),
	province("Thanh Hóa", ["Hạc Thành", "Sầm Sơn"]),
	province("Nghệ An", ["Trường Vinh", "Thành Vinh", "Cửa Lò"]),
	province("Hà Tĩnh", ["Thành Sen", "Trần Phú"]),
	province("Tuyên Quang", ["Minh Xuân", "Hà Giang 1"]),
	province("Lào Cai", ["Lào Cai", "Cam Đường", "Yên Bái"]),
	province("Thái Nguyên", ["Phan Đình Phùng", "Đức Xuân"]),
	province("Phú Thọ", ["Việt Trì", "Vĩnh Phúc", "Hòa Bình"]),
	province("Bắc Ninh", ["Kinh Bắc", "Bắc Giang"]),
	province("Hưng Yên", ["Phố Hiến", "Thái Bình"]),
	province("Ninh Bình", ["Hoa Lư", "Nam Định", "Phủ Lý"]),
	province("Quảng Trị", ["Đồng Hới", "Đông Hà"]),
	province("Quảng Ngãi", ["Cẩm Thành", "Kon Tum"]),
	province("Gia Lai", ["Pleiku", "Quy Nhơn"]),
	province("Khánh Hòa", ["Nha Trang", "Phan Rang"]),
	province("Lâm Đồng", ["Xuân Hương - Đà Lạt", "Phan Thiết"]),
	province("Đắk Lắk", ["Buôn Ma Thuột", "Tuy Hòa"]),
	province("Đồng Nai", ["Trấn Biên", "Biên Hòa", "Bình Phước"]),
	province("Tây Ninh", ["Tân Ninh", "Long An"]),
	province("Vĩnh Long", ["Thanh Đức", "Bến Tre", "Trà Vinh"]),
	province("Đồng Tháp", ["Cao Lãnh", "Mỹ Tho"]),
	province("Cà Mau", ["An Xuyên", "Bạc Liêu"]),
	province("An Giang", ["Long Xuyên", "Rạch Giá", "Châu Đốc"]),
];

/** Street names found in most Vietnamese cities. */
export const VN_STREETS: readonly string[] = [
	"Lê Lợi",
	"Nguyễn Huệ",
	"Trần Hưng Đạo",
	"Lý Thường Kiệt",
	"Hai Bà Trưng",
	"Nguyễn Trãi",
	"Lê Duẩn",
	"Điện Biên Phủ",
	"Võ Thị Sáu",
	"Phan Chu Trinh",
	"Quang Trung",
	"Hùng Vương",
	"Bà Triệu",
	"Nguyễn Du",
	"Trần Phú",
	"Lê Lai",
	"Hoàng Diệu",
	"Phạm Ngũ Lão",
	"Nguyễn Thị Minh Khai",
	"Cách Mạng Tháng Tám",
	"Lê Thánh Tôn",
	"Ngô Quyền",
	"Lạc Long Quân",
	"Phan Đình Phùng",
];
