/**
 * Rules of the Faker field matcher (`faker-field-matcher.ts`): which
 * whitelisted Faker methods suit a field, by name. English names and
 * Vietnamese names without diacritics (`ten`, `sdt`, `dia_chi`) share a
 * rule. Every method id is checked against the whitelist by the tests.
 *
 * A pattern is matched against a run of name tokens, lower case and
 * joined (`so_dien_thoai` and `soDienThoai` both give `sodienthoai`), so
 * it lists joined spellings. `methods` go from preferred to fallback; the
 * matcher takes the first whose output fits the field's type (a Number
 * `price` gets `datatype.float`, not the string `commerce.price`). Order
 * breaks ties: specific rules come before generic ones.
 */

/** Where the matched run may sit in the name; absent means anywhere. */
export type FieldRulePlace = "exact" | "start" | "end";

export interface FakerFieldRule {
	/** Regex source of an alternation; anchored by the matcher. */
	readonly pattern: string;
	readonly methods: readonly string[];
	readonly place?: FieldRulePlace;
}

const anywhere = (pattern: string, ...methods: string[]): FakerFieldRule => ({
	pattern,
	methods,
});
const only = (
	place: FieldRulePlace,
	pattern: string,
	...methods: string[]
): FakerFieldRule => ({ pattern, methods, place });

export const FAKER_FIELD_RULES: readonly FakerFieldRule[] = Object.freeze([
	anywhere("e?mail|emailaddress|mailaddress|thudientu", "internet.email"),
	anywhere(
		"avatar|avatarurl|profileimage|profilepicture|profilephoto|anhdaidien|hinhdaidien",
		"image.avatar",
	),
	anywhere(
		"(image|img|photo|picture|pic|thumbnail|thumb|cover|banner|logo)s?(url)?|anh|hinh|hinhanh|anhbia",
		"image.url",
	),
	anywhere("useragent", "internet.userAgent"),
	anywhere(
		"username|login|handle|nickname|tendangnhap|taikhoan|bietdanh",
		"internet.userName",
	),
	anywhere("password|passwd|pwd|matkhau", "internet.password"),
	anywhere("token|accesstoken|refreshtoken|jwt", "internet.jwt"),
	anywhere("ip|ipaddress|ipv4|diachiip", "internet.ip"),
	anywhere("ipv6", "internet.ipv6"),
	anywhere("domain|domainname|hostname|host|tenmien", "internet.domainName"),
	anywhere(
		"url|uri|website|homepage|link|href|duongdan|trangweb",
		"internet.url",
	),
	anywhere("firstname|givenname|forename", "name.firstName"),
	anywhere("middlename|tendem", "name.middleName"),
	anywhere("lastname|surname|familyname", "name.lastName"),
	only("exact", "ho", "name.lastName"),
	anywhere(
		"productname|product|tensanpham|sanpham|tenhang|mathang",
		"commerce.productName",
	),
	anywhere(
		"company|companyname|organization|organisation|employer|congty|tencongty|doanhnghiep",
		"company.companyName",
	),
	anywhere("department|phongban", "commerce.department"),
	anywhere("category|danhmuc", "commerce.department"),
	anywhere("filename|tenfile|tentep", "system.fileName"),
	anywhere("mimetype|contenttype", "system.mimeType"),
	anywhere(
		"name|fullname|displayname|ten|hoten|hovaten|tendaydu|hotendaydu",
		"name.fullName",
	),
	anywhere("jobtitle|job|occupation|chucvu|nghenghiep", "name.jobTitle"),
	anywhere("bio|about|gioithieu|tieusu", "name.bio"),
	anywhere("gender", "name.gender"),
	anywhere("sex|gioitinh", "name.sex"),
	anywhere(
		"phone|phonenumber|mobile|mobilenumber|tel|telephone|cellphone|sdt|sodienthoai|dienthoai|sodt|didong|sodidong",
		"phone.number",
	),
	anywhere("countrycode|maquocgia", "address.countryCode"),
	anywhere(
		"zip|zipcode|postcode|postalcode|mabuuchinh|mabuudien",
		"address.zipCode",
	),
	anywhere(
		"address|streetaddress|street|address1|addressline1?|diachi|duong|sonha",
		"address.streetAddress",
	),
	anywhere("city|town|thanhpho", "address.city"),
	anywhere("county|district|quanhuyen", "address.county"),
	// Short Vietnamese words that start other names (`quan_ly`, `tinh_trang`).
	only("exact", "quan|huyen", "address.county"),
	anywhere("state|province|region|tinhthanh", "address.state"),
	only("exact", "tinh", "address.state"),
	anywhere("country|nation|quocgia", "address.country"),
	anywhere("lat|latitude|vido", "address.latitude"),
	anywhere("lng|lon|long|longitude|kinhdo", "address.longitude"),
	anywhere(
		"birthdate|birthday|dob|dateofbirth|ngaysinh|sinhnhat",
		"date.birthdate",
		"date.timestamp",
	),
	anywhere(
		"expiresat|expiredat|expiry|expiration|deadline|duedate|hethan|ngayhethan",
		"date.future",
		"date.timestamp",
	),
	only(
		"end",
		"at|on|date|time|timestamp|ngaytao|ngaycapnhat|thoigian",
		"date.past",
		"date.timestamp",
	),
	only("start", "ngay|thoigian", "date.past", "date.timestamp"),
	anywhere(
		"price|cost|amount|total|subtotal|fee|gia|giaban|giatien|dongia|sotien|thanhtien|tongtien|phi|chiphi",
		"commerce.price",
		"datatype.float",
	),
	anywhere("currency|currencycode|tiente", "finance.currencyCode"),
	anywhere("iban", "finance.iban"),
	anywhere("creditcard|cardnumber|sothe", "finance.creditCardNumber"),
	anywhere("accountnumber|bankaccount|sotaikhoan|stk", "finance.accountNumber"),
	anywhere("title|subject|headline|tieude", "lorem.sentence"),
	anywhere(
		"description|desc|summary|content|body|text|comment|notes?|message|mota|noidung|ghichu|binhluan|tomtat",
		"lorem.paragraph",
	),
	anywhere("tags?|keywords?|tukhoa", "lorem.word"),
	anywhere("slug", "lorem.slug"),
	anywhere("version|semver|phienban", "system.semver"),
	anywhere("hexcolor|colorhex|colorcode", "color.hex"),
	anywhere("colou?r|mau|mausac", "color.human"),
	only("start", "is|has|can|should|was", "datatype.boolean"),
	only(
		"end",
		"active|enabled|disabled|verified|deleted|published|visible|archived|completed|kichhoat|hoatdong|daxoa",
		"datatype.boolean",
	),
	anywhere("uuid|guid", "datatype.uuid"),
	only("end", "id", "datatype.uuid", "datatype.number"),
]);
