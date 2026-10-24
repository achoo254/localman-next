/**
 * Parts of Vietnamese fake company names: legal form, line of business
 * and a two-word trade name built from common auspicious words ("Minh
 * Phát"). Combinations are random; any match with a real company is
 * chance.
 */
export interface VnCompanyPart {
	readonly vi: string;
	readonly en: string;
}

/** Legal form: before the name in Vietnamese, after it in English. */
export const VN_COMPANY_FORMS: readonly VnCompanyPart[] = [
	{ vi: "Công ty TNHH", en: "Co., Ltd." },
	{ vi: "Công ty Cổ phần", en: "JSC" },
	{ vi: "Công ty TNHH MTV", en: "One Member Co., Ltd." },
];

export const VN_COMPANY_TRADES: readonly VnCompanyPart[] = [
	{ vi: "Thương mại", en: "Trading" },
	{ vi: "Dịch vụ", en: "Services" },
	{ vi: "Công nghệ", en: "Technology" },
	{ vi: "Phần mềm", en: "Software" },
	{ vi: "Xây dựng", en: "Construction" },
	{ vi: "Đầu tư", en: "Investment" },
	{ vi: "Vận tải", en: "Logistics" },
	{ vi: "Thực phẩm", en: "Food" },
	{ vi: "Du lịch", en: "Travel" },
	{ vi: "Giáo dục", en: "Education" },
	{ vi: "Sản xuất", en: "Manufacturing" },
	{ vi: "Xuất nhập khẩu", en: "Import Export" },
];

export const VN_COMPANY_WORDS: readonly string[] = [
	"An",
	"Minh",
	"Phúc",
	"Thịnh",
	"Hưng",
	"Phát",
	"Tân",
	"Đại",
	"Việt",
	"Hoàng",
	"Thành",
	"Kim",
	"Bảo",
	"Gia",
	"Nhật",
	"Quang",
	"Trường",
	"Long",
];
