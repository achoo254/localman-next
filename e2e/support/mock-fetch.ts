import type { Page } from "@playwright/test";

export interface MockReply {
	readonly status: number;
	readonly body: unknown;
}

/**
 * Calls a mock URL from the app's own page, as a browser client would (the
 * page origin differs from the mock origin, so CORS applies).
 */
export function fetchFromPage(page: Page, url: string): Promise<MockReply> {
	return page.evaluate(async (target: string) => {
		const response = await fetch(target);
		const body: unknown = await response.json().catch(() => null);
		return { status: response.status, body };
	}, url);
}

/** The records of a collection reply; throws when the body is not a list. */
export function recordsOf(reply: MockReply): Record<string, unknown>[] {
	if (!Array.isArray(reply.body)) {
		throw new Error(`Expected a JSON list, got ${JSON.stringify(reply.body)}`);
	}
	return reply.body.map(asRecord);
}

function asRecord(item: unknown): Record<string, unknown> {
	if (typeof item !== "object" || item === null) {
		throw new Error(`Expected a JSON object, got ${JSON.stringify(item)}`);
	}
	return { ...item };
}

export interface ParentWithRecords {
	readonly id: string;
	readonly records: Record<string, unknown>[];
}

/**
 * The first parent, in list order, whose nested collection has records. The
 * generator places children at random among the parents, so the first one
 * may have none.
 */
export async function firstWithRecords(
	page: Page,
	parents: readonly Record<string, unknown>[],
	pathOf: (parentId: string) => string,
): Promise<ParentWithRecords> {
	for (const parent of parents) {
		const id = String(parent.id);
		const records = recordsOf(await fetchFromPage(page, pathOf(id)));
		if (records.length > 0) return { id, records };
	}
	throw new Error("No parent has records on its nested route");
}
