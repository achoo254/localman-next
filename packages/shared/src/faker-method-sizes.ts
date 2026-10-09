/**
 * Upper bounds, in bytes of JSON, of what each whitelisted Faker method
 * returns, used to estimate the worst record a template can produce
 * before it is stored. Measured over thousands of seeded runs and
 * doubled for margin; `faker-methods.test.ts` re-measures and fails if a
 * Faker upgrade outgrows a bound. No Faker import: the web can use it.
 */
export const DEFAULT_FAKER_METHOD_BYTES = 128;

const LARGE_METHOD_BYTES: ReadonlyMap<string, number> = new Map([
	["lorem.text", 1536],
	["lorem.paragraphs", 1536],
	["lorem.sentences", 1024],
	["lorem.lines", 1024],
	["internet.jwt", 1024],
	["image.dataUri", 1024],
	["lorem.paragraph", 512],
	["git.commitEntry", 512],
	["finance.transactionDescription", 384],
	["internet.userAgent", 384],
	["commerce.productDescription", 256],
	["hacker.phrase", 256],
	["lorem.sentence", 256],
	["address.postalAddress", 192],
	["image.avatar", 160],
	["image.personPortrait", 160],
	["image.urlPicsumPhotos", 160],
	["system.mimeType", 160],
	["music.album", 160],
	["music.songName", 160],
]);

/** Most bytes of JSON one call of `id` can return. */
export function fakerMethodMaxBytes(id: string): number {
	return LARGE_METHOD_BYTES.get(id) ?? DEFAULT_FAKER_METHOD_BYTES;
}
