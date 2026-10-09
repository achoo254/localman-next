/**
 * Ids of the whitelisted Faker methods (`category.method`), grouped as in
 * mockapi.io. Names follow the source (Faker 5: `name.*`, `address.*`) so
 * templates written for it keep working; the runners in `faker-methods.ts`
 * map them onto the current Faker API.
 *
 * This file has no Faker import on purpose: the web app needs the list for
 * its method picker without bundling Faker. `faker-methods.test.ts` checks
 * that every id here has exactly one runner and vice versa.
 */
export const FAKER_CATEGORIES = [
	"address",
	"animal",
	"color",
	"commerce",
	"company",
	"database",
	"datatype",
	"date",
	"finance",
	"git",
	"hacker",
	"image",
	"internet",
	"lorem",
	"music",
	"name",
	"phone",
	"science",
	"system",
	"vehicle",
	"word",
] as const;
export type FakerCategory = (typeof FAKER_CATEGORIES)[number];

/** Method names per category, space separated to keep the list compact. */
const METHOD_NAMES: Readonly<Record<FakerCategory, string>> = {
	address:
		"buildingNumber cardinalDirection city cityName continent country countryCode county direction fullAddress latitude longitude nearbyGPSCoordinate ordinalDirection postalAddress secondaryAddress state stateAbbr street streetAddress streetName timeZone zipCode",
	animal:
		"bear bird cat cetacean cow crocodilia dog fish horse insect lion petName rabbit rodent snake type",
	color:
		"cmyk colorByCSSColorSpace cssSupportedFunction cssSupportedSpace hex hsl human hwb lab lch rgb space",
	commerce:
		"department isbn price priceWithSymbol product productAdjective productDescription productMaterial productName upc",
	company:
		"bs buzzAdjective buzzNoun buzzPhrase buzzVerb catchPhrase catchPhraseAdjective catchPhraseDescriptor catchPhraseNoun companyName name",
	database: "collation column engine mongodbObjectId type",
	datatype:
		"alpha alphanumeric array bigInt binary boolean datetime float hexadecimal nanoid number numeric octal romanNumeral string ulid uuid",
	date: "anytime birthdate future month monthAbbr past recent soon timeZone timestamp weekday",
	finance:
		"accountName accountNumber amount bic bitcoinAddress creditCardCVV creditCardIssuer creditCardNumber currencyCode currencyName currencyNumericCode currencySymbol ethereumAddress iban litecoinAddress maskedNumber pin routingNumber transactionDescription transactionType",
	git: "branch commitDate commitEntry commitMessage commitSha shortSha",
	hacker: "abbreviation adjective ingverb noun phrase verb",
	image:
		"abstract animals avatar avatarGitHub business cats city dataUri fashion food imageUrl nature people personPortrait sports technics transport url urlLoremFlickr urlPicsumPhotos",
	internet:
		"displayName domainName domainSuffix domainWord email emoji exampleEmail httpMethod httpStatusCode ip ipv4 ipv6 jwt jwtAlgorithm mac password port protocol url userAgent userName username",
	lorem: "lines paragraph paragraphs sentence sentences slug text word words",
	music: "album artist genre songName",
	name: "bio findName firstName fullName gender jobArea jobDescriptor jobTitle jobType lastName middleName prefix sex sexType suffix zodiacSign",
	phone: "imei number numberInternational numberNational phoneNumber",
	science:
		"chemicalElement chemicalElementName chemicalElementSymbol unit unitName unitSymbol",
	system:
		"commonFileExt commonFileName commonFileType cron directoryPath fileExt fileName filePath fileType mimeType networkInterface semver",
	vehicle: "bicycle color fuel manufacturer model type vehicle vin vrm",
	word: "adjective adverb conjunction interjection noun preposition sample verb words",
};

export interface FakerMethodGroup {
	readonly category: FakerCategory;
	/** Full ids, e.g. `address.city`. */
	readonly ids: readonly string[];
}

export const FAKER_METHOD_GROUPS: readonly FakerMethodGroup[] = Object.freeze(
	FAKER_CATEGORIES.map((category) =>
		Object.freeze({
			category,
			ids: Object.freeze(
				METHOD_NAMES[category].split(" ").map((name) => `${category}.${name}`),
			),
		}),
	),
);

/** Every whitelisted id, in catalog order. */
export const FAKER_METHOD_IDS: readonly string[] = Object.freeze(
	FAKER_METHOD_GROUPS.flatMap((group) => group.ids),
);

const KNOWN_IDS: ReadonlySet<string> = new Set(FAKER_METHOD_IDS);

/** Whether `id` names a whitelisted method (exact match, no lookups). */
export function isFakerMethodId(id: string): boolean {
	return KNOWN_IDS.has(id);
}
