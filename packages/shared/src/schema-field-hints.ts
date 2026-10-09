/**
 * Faker method suggested for an imported field, from its OpenAPI `format`
 * or its name. Only methods whose output matches the declared type are
 * suggested (no string-returning `commerce.price` for a number field);
 * anything unmatched stays a plain String/Number/Date field. Every id
 * here is in the whitelist (`faker-method-catalog.ts`, checked by tests).
 */
import type { ImportedShape } from "./schema-import-fields.js";

/** A Map, so formats such as `__proto__` cannot reach `Object.prototype`. */
const FORMAT_HINTS: ReadonlyMap<string, string> = new Map([
	["email", "internet.email"],
	["idn-email", "internet.email"],
	["uri", "internet.url"],
	["url", "internet.url"],
	["uri-reference", "internet.url"],
	["uuid", "datatype.uuid"],
	["hostname", "internet.domainName"],
	["ipv4", "internet.ipv4"],
	["ipv6", "internet.ipv6"],
	["password", "internet.password"],
]);

type HintRule = readonly [pattern: RegExp, method: string];

/** Matched against the name in lower case without `_`, `-` and `.`. */
const STRING_HINTS: readonly HintRule[] = [
	[/^(e)?mail(address)?$|email$/, "internet.email"],
	[/avatar/, "image.avatar"],
	[/(image|photo|picture|thumbnail|cover)(url)?$/, "image.url"],
	[/(url|website|homepage|link)$/, "internet.url"],
	[/^(username|login|handle)$/, "internet.userName"],
	[/password/, "internet.password"],
	[/^(firstname|givenname)$/, "name.firstName"],
	[/^(lastname|surname|familyname)$/, "name.lastName"],
	[/^(name|fullname|displayname)$/, "name.fullName"],
	[/jobtitle/, "name.jobTitle"],
	[/^(phone|mobile|tel|telephone|phonenumber|mobilenumber)$/, "phone.number"],
	[
		/^(address|streetaddress|street|address1|addressline1)$/,
		"address.streetAddress",
	],
	[/^city$/, "address.city"],
	[/^country$/, "address.country"],
	[/^(zip|zipcode|postcode|postalcode)$/, "address.zipCode"],
	[/^(state|province)$/, "address.state"],
	[/^(company|companyname|organization|organisation)$/, "company.companyName"],
	[/^(title|subject|headline)$/, "lorem.sentence"],
	[/^bio$/, "name.bio"],
	[
		/^(description|summary|content|body|text|comment|note|notes)$/,
		"lorem.paragraph",
	],
	[/^(uuid|guid)$/, "datatype.uuid"],
	[/^colou?r$/, "color.human"],
	[/^slug$/, "lorem.slug"],
	[/^(ip|ipaddress)$/, "internet.ip"],
	[/^(currency|currencycode)$/, "finance.currencyCode"],
	[/^gender$/, "name.gender"],
	[/^(birthdate|birthday|dob|dateofbirth)$/, "date.birthdate"],
];

const NUMBER_HINTS: readonly HintRule[] = [
	[/^(lat|latitude)$/, "address.latitude"],
	[/^(lng|lon|long|longitude)$/, "address.longitude"],
];

/** `createdAt`, `updated_at`, `publishDate`… held in a string field. */
const DATE_NAME = /(?:At|_at|On|_on|Date|_date)$/;

function match(rules: readonly HintRule[], key: string): string | null {
	for (const [pattern, method] of rules) {
		if (pattern.test(key)) return method;
	}
	return null;
}

/** A whitelisted `category.method`, or `null` to keep the plain type. */
export function fakerHintFor(
	name: string,
	shape: ImportedShape,
): string | null {
	const key = name.toLowerCase().replace(/[_\-.]/g, "");
	if (shape.kind === "number") return match(NUMBER_HINTS, key);
	if (shape.kind === "date") {
		return key === "birthdate" || key === "dob" || key === "dateofbirth"
			? "date.birthdate"
			: null;
	}
	if (shape.kind !== "string") return null;
	const byFormat = FORMAT_HINTS.get(shape.format ?? "");
	if (byFormat !== undefined) return byFormat;
	return (
		match(STRING_HINTS, key) ?? (DATE_NAME.test(name) ? "date.past" : null)
	);
}
