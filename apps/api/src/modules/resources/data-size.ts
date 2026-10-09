import { OperationError } from "@localman/operations";
import {
	type JsonObject,
	MAX_RECORD_BYTES,
	MAX_RESOURCE_BYTES,
	jsonSize,
	utf8Length,
} from "@localman/shared";

export type SizeLimit = "record" | "resource";

/** The resource a size error is about, named in the error details. */
export interface ResourceRef {
	readonly id: string;
	readonly name: string;
}

export function resourceRef(resource: {
	readonly _id: { toHexString(): string };
	readonly name: string;
}): ResourceRef {
	return { id: resource._id.toHexString(), name: resource.name };
}

/**
 * 413 `DATA_TOO_LARGE` naming the resource (also inside `generate_all`);
 * `actualBytes` is an estimate of compact JSON.
 */
export function dataTooLarge(
	limit: SizeLimit,
	actualBytes: number,
	resource: ResourceRef,
): OperationError {
	const maxBytes = limit === "record" ? MAX_RECORD_BYTES : MAX_RESOURCE_BYTES;
	return new OperationError(
		413,
		"DATA_TOO_LARGE",
		limit === "record"
			? `A record may hold at most ${maxBytes} bytes of JSON`
			: `A resource's records may hold at most ${maxBytes} bytes of JSON`,
		{
			limit,
			maxBytes,
			actualBytes,
			resourceId: resource.id,
			name: resource.name,
		},
	);
}

/** Estimated JSON bytes of a record as served (`id` and parent link included). */
export function recordBytes(record: {
	readonly id: string;
	readonly data: JsonObject;
}): number {
	// `{"id":"…","<parent>Id":"…",` costs about the id twice plus keys.
	return jsonSize(record.data).bytes + 2 * utf8Length(record.id) + 32;
}

/**
 * Adds records one at a time and throws as soon as one record or the
 * running total passes its cap, so oversized input is refused before
 * the rest of it is built.
 */
export class ByteMeter {
	private total = 0;

	constructor(private readonly resource: ResourceRef) {}

	add(record: { readonly id: string; readonly data: JsonObject }): void {
		const bytes = recordBytes(record);
		if (bytes > MAX_RECORD_BYTES)
			throw dataTooLarge("record", bytes, this.resource);
		this.total += bytes;
		if (this.total > MAX_RESOURCE_BYTES) {
			throw dataTooLarge("resource", this.total, this.resource);
		}
	}
}

/** Throws when the records of one resource pass the resource cap. */
export function assertResourceSize(
	records: readonly { readonly id: string; readonly data: JsonObject }[],
	resource: ResourceRef,
): void {
	const meter = new ByteMeter(resource);
	for (const record of records) meter.add(record);
}
