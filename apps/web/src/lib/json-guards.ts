/** Narrowing helpers for JSON received from the API (validated at the edge). */

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Thrown when a response does not match the documented shape. */
export class InvalidResponseError extends Error {
	constructor(what: string) {
		super(`Unexpected API response: ${what}`);
		this.name = "InvalidResponseError";
	}
}

export function expectRecord(value: unknown, what: string): JsonRecord {
	if (!isRecord(value)) throw new InvalidResponseError(what);
	return value;
}

export function expectString(record: JsonRecord, key: string): string {
	const value = record[key];
	if (typeof value !== "string") throw new InvalidResponseError(key);
	return value;
}

export function optionalString(record: JsonRecord, key: string): string | null {
	const value = record[key];
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") throw new InvalidResponseError(key);
	return value;
}

export function expectBoolean(record: JsonRecord, key: string): boolean {
	const value = record[key];
	if (typeof value !== "boolean") throw new InvalidResponseError(key);
	return value;
}

export function expectNumber(record: JsonRecord, key: string): number {
	const value = record[key];
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new InvalidResponseError(key);
	}
	return value;
}

export function expectArray(record: JsonRecord, key: string): unknown[] {
	const value = record[key];
	if (!Array.isArray(value)) throw new InvalidResponseError(key);
	return value;
}
