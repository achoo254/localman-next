/**
 * Postman's `{{$random…}}` dynamic variables, each mapped onto a method of
 * the Faker whitelist (`faker-method-catalog.ts`). Only the ids live here:
 * whoever fills variables passes a runner (`InterpolationContext.runFaker`),
 * so Faker loads on demand and never sits in the API client chunk. Postman
 * names without a whitelisted method (`$randomLocale`, `$randomPhoneNumberExt`,
 * `$randomNightlifeImage`, `$randomCompanySuffix`) are left out.
 */
export const FAKER_DYNAMIC_VARIABLES: Readonly<Record<string, string>> =
	Object.freeze({
		$randomAlphaNumeric: "datatype.alphanumeric",
		$randomBoolean: "datatype.boolean",
		$randomColor: "color.human",
		$randomHexColor: "color.hex",
		$randomAbbreviation: "hacker.abbreviation",
		$randomIP: "internet.ipv4",
		$randomIPV6: "internet.ipv6",
		$randomMACAddress: "internet.mac",
		$randomPassword: "internet.password",
		$randomUserAgent: "internet.userAgent",
		$randomProtocol: "internet.protocol",
		$randomSemver: "system.semver",
		$randomFirstName: "name.firstName",
		$randomLastName: "name.lastName",
		$randomFullName: "name.fullName",
		$randomNamePrefix: "name.prefix",
		$randomNameSuffix: "name.suffix",
		$randomJobArea: "name.jobArea",
		$randomJobDescriptor: "name.jobDescriptor",
		$randomJobTitle: "name.jobTitle",
		$randomJobType: "name.jobType",
		$randomPhoneNumber: "phone.phoneNumber",
		$randomCity: "address.city",
		$randomStreetName: "address.streetName",
		$randomStreetAddress: "address.streetAddress",
		$randomCountry: "address.country",
		$randomCountryCode: "address.countryCode",
		$randomLatitude: "address.latitude",
		$randomLongitude: "address.longitude",
		$randomAvatarImage: "image.avatar",
		$randomImageUrl: "image.imageUrl",
		$randomAbstractImage: "image.abstract",
		$randomAnimalsImage: "image.animals",
		$randomBusinessImage: "image.business",
		$randomCatsImage: "image.cats",
		$randomCityImage: "image.city",
		$randomFoodImage: "image.food",
		$randomFashionImage: "image.fashion",
		$randomPeopleImage: "image.people",
		$randomNatureImage: "image.nature",
		$randomSportsImage: "image.sports",
		$randomTransportImage: "image.transport",
		$randomImageDataUri: "image.dataUri",
		$randomBankAccount: "finance.accountNumber",
		$randomBankAccountName: "finance.accountName",
		$randomCreditCardMask: "finance.maskedNumber",
		$randomBankAccountBic: "finance.bic",
		$randomBankAccountIban: "finance.iban",
		$randomTransactionType: "finance.transactionType",
		$randomCurrencyCode: "finance.currencyCode",
		$randomCurrencyName: "finance.currencyName",
		$randomCurrencySymbol: "finance.currencySymbol",
		$randomBitcoin: "finance.bitcoinAddress",
		$randomCompanyName: "company.companyName",
		$randomBs: "company.bs",
		$randomBsAdjective: "company.buzzAdjective",
		$randomBsBuzz: "company.buzzVerb",
		$randomBsNoun: "company.buzzNoun",
		$randomCatchPhrase: "company.catchPhrase",
		$randomCatchPhraseAdjective: "company.catchPhraseAdjective",
		$randomCatchPhraseDescriptor: "company.catchPhraseDescriptor",
		$randomCatchPhraseNoun: "company.catchPhraseNoun",
		$randomDatabaseColumn: "database.column",
		$randomDatabaseType: "database.type",
		$randomDatabaseCollation: "database.collation",
		$randomDatabaseEngine: "database.engine",
		$randomDateFuture: "date.future",
		$randomDatePast: "date.past",
		$randomDateRecent: "date.recent",
		$randomWeekday: "date.weekday",
		$randomMonth: "date.month",
		$randomDomainName: "internet.domainName",
		$randomDomainSuffix: "internet.domainSuffix",
		$randomDomainWord: "internet.domainWord",
		$randomEmail: "internet.email",
		$randomExampleEmail: "internet.exampleEmail",
		$randomUserName: "internet.userName",
		$randomUrl: "internet.url",
		$randomFileName: "system.fileName",
		$randomFileType: "system.fileType",
		$randomFileExt: "system.fileExt",
		$randomCommonFileName: "system.commonFileName",
		$randomCommonFileType: "system.commonFileType",
		$randomCommonFileExt: "system.commonFileExt",
		$randomFilePath: "system.filePath",
		$randomDirectoryPath: "system.directoryPath",
		$randomMimeType: "system.mimeType",
		$randomPrice: "commerce.price",
		$randomProduct: "commerce.product",
		$randomProductAdjective: "commerce.productAdjective",
		$randomProductMaterial: "commerce.productMaterial",
		$randomProductName: "commerce.productName",
		$randomDepartment: "commerce.department",
		$randomNoun: "hacker.noun",
		$randomVerb: "hacker.verb",
		$randomIngverb: "hacker.ingverb",
		$randomAdjective: "hacker.adjective",
		$randomWord: "word.sample",
		$randomWords: "word.words",
		$randomPhrase: "hacker.phrase",
		$randomLoremWord: "lorem.word",
		$randomLoremWords: "lorem.words",
		$randomLoremSentence: "lorem.sentence",
		$randomLoremSentences: "lorem.sentences",
		$randomLoremParagraph: "lorem.paragraph",
		$randomLoremParagraphs: "lorem.paragraphs",
		$randomLoremText: "lorem.text",
		$randomLoremSlug: "lorem.slug",
		$randomLoremLines: "lorem.lines",
	});

/** The Faker method a `$name` runs, or `undefined` (own keys only). */
export function fakerIdOf(name: string): string | undefined {
	return Object.hasOwn(FAKER_DYNAMIC_VARIABLES, name)
		? FAKER_DYNAMIC_VARIABLES[name]
		: undefined;
}

/**
 * "$randomFirstName" → "Random first name", "$randomMACAddress" → "Random
 * mac address": English text for names without a hand-written one.
 */
export function describeFakerVariable(name: string): string {
	const words = name
		.replace(/^\$random/, "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
		.toLowerCase();
	return `Random ${words}`;
}
