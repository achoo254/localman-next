/**
 * Ids of tabs, table rows and picked files. A UUID fits the draft API's
 * `[A-Za-z0-9_-]{1,64}` tab ids and the 64-character row ids.
 */
export function newId(): string {
	return crypto.randomUUID();
}
