/**
 * Vietnamese text without its diacritics, for the `en` locale of the fake
 * data ("Nguyễn Văn Đức" → "Nguyen Van Duc"). `đ` has no combining mark,
 * so it is mapped on its own.
 */
export function withoutDiacritics(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replaceAll("đ", "d")
		.replaceAll("Đ", "D")
		.normalize("NFC");
}
