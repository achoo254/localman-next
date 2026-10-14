import { randomBytes } from "node:crypto";

/** A random id that is the whole secret of a link or button (base64url). */
export function newCapabilityId(bytes: number): string {
	return randomBytes(bytes).toString("base64url");
}

/** Shape of an id `newCapabilityId(bytes)` made; anything else is unknown. */
export function isCapabilityId(value: string, bytes: number): boolean {
	const length = Math.ceil((bytes * 4) / 3);
	return value.length === length && /^[A-Za-z0-9_-]+$/.test(value);
}
