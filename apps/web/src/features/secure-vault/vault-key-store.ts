/**
 * Keeps the unlocked vault key on this device (IndexedDB) so a reload does
 * not ask for the passphrase again. The key is a non-extractable
 * `CryptoKey`: its bytes cannot be read back, only used. Stored per
 * account and per vault salt, so another account or a reset vault never
 * picks it up. Without IndexedDB (tests, some private modes) the key lives
 * in memory for the page only.
 */

const DB = "localman-vault";
const STORE = "keys";

interface StoredKey {
	readonly key: CryptoKey;
}

const memory = new Map<string, CryptoKey>();

const idOf = (sub: string, salt: string): string => `${sub}\u0000${salt}`;

function open(): Promise<IDBDatabase> | null {
	if (typeof indexedDB === "undefined") return null;
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
	const opening = open();
	if (!opening) return undefined;
	const db = await opening;
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = work(db.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}

export async function rememberVaultKey(
	sub: string,
	salt: string,
	key: CryptoKey,
): Promise<void> {
	const id = idOf(sub, salt);
	memory.set(id, key);
	await run("readwrite", (store) => store.put({ key } satisfies StoredKey, id));
}

export async function recallVaultKey(
	sub: string,
	salt: string,
): Promise<CryptoKey | null> {
	const id = idOf(sub, salt);
	const known = memory.get(id);
	if (known) return known;
	const stored = await run<unknown>("readonly", (store) => store.get(id));
	if (
		typeof stored === "object" &&
		stored !== null &&
		"key" in stored &&
		stored.key instanceof CryptoKey
	) {
		return stored.key;
	}
	return null;
}

/**
 * Locks this device for one account: its keys are forgotten here (not on
 * other devices, nor for another account signed in on this browser).
 */
export async function forgetVaultKeys(sub: string): Promise<void> {
	const prefix = idOf(sub, "");
	for (const id of [...memory.keys()]) {
		if (id.startsWith(prefix)) memory.delete(id);
	}
	if (typeof IDBKeyRange === "undefined") return;
	// Ids sort as `sub NUL salt`: this account's ids run from `sub NUL` up
	// to (not including) `sub U+0001`.
	const range = IDBKeyRange.bound(prefix, `${sub}\u0001`, false, true);
	await run("readwrite", (store) => store.delete(range));
}
