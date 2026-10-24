/**
 * Fills `{{response "<request>" "<JSONPath>"}}` before a send: each
 * reference takes its value from the last response of that request of
 * the same collection, sent again first when older than its TTL. The
 * values become one more variable scope of the send.
 */
import {
	type ApiRequestDraft,
	type ClientResponse,
	ResponseReferenceError,
	type TabSource,
	type VariableScope,
	findResponseReferences,
	resolveResponseReferences,
} from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { keepResponse, keptResponse } from "./kept-responses";

/** A request found by name in the collection of a tab. */
export interface NamedRequest {
	readonly source: TabSource;
	readonly draft: ApiRequestDraft;
}

/** What resolving needs from the workbench. */
export interface ReferenceSteps {
	find(collectionId: string, name: string): Promise<NamedRequest | null>;
	/** Sends a request of the collection as its own tab would; rejects on failure. */
	send(
		request: NamedRequest,
		extra: VariableScope | null,
	): Promise<ClientResponse>;
}

/** Every text of a draft a `{{…}}` may sit in. */
export function draftTexts(draft: ApiRequestDraft): string[] {
	return [
		draft.url,
		...draft.params.flatMap((row) => [row.key, row.value]),
		...draft.headers.flatMap((row) => [row.key, row.value]),
		draft.body.raw,
		...draft.body.urlencoded.flatMap((row) => [row.key, row.value]),
		...draft.body.formData.flatMap((row) => [row.key, row.value]),
		JSON.stringify(draft.auth),
	];
}

export type ReferenceOutcome =
	| { readonly ok: true; readonly scope: VariableScope | null }
	| { readonly ok: false; readonly code: string; readonly message: string };

/** The sentence for a reference that could not be filled. */
function messageOf(error: ResponseReferenceError): string {
	const { t } = activeTranslator();
	const name = error.reference.requestName;
	const path = error.reference.path;
	switch (error.code) {
		case "REFERENCE_REQUEST_NOT_FOUND":
		case "REFERENCE_LOOP":
		case "REFERENCE_SEND_FAILED":
			return t(`apiClient.send.references.${error.code}`, { name });
		case "REFERENCE_NOT_JSON":
		case "REFERENCE_PATH_MISSING":
			return t(`apiClient.send.references.${error.code}`, { name, path });
		case "REFERENCE_PATH_INVALID":
			return t("apiClient.send.references.REFERENCE_PATH_INVALID", { path });
		case "REFERENCE_TOO_DEEP":
			return t("apiClient.send.references.REFERENCE_TOO_DEEP");
	}
}

function failure(error: unknown): ReferenceOutcome {
	if (error instanceof ResponseReferenceError) {
		return { ok: false, code: error.code, message: messageOf(error) };
	}
	const { t } = activeTranslator();
	return {
		ok: false,
		code: "REFERENCE_SEND_FAILED",
		message: t("apiClient.send.sourceFailed"),
	};
}

class OutsideCollection extends Error {}

/** The values of the references in `draft`, by expression; throws. */
async function referenceValues(
	draft: ApiRequestDraft,
	self: TabSource | null | undefined,
	steps: ReferenceSteps,
	chain: readonly string[],
): Promise<Map<string, string>> {
	const references = findResponseReferences(draftTexts(draft));
	if (references.length === 0) return new Map();
	if (!self) throw new OutsideCollection();
	return resolveResponseReferences(
		references,
		{
			find: (name) => steps.find(self.collectionId, name),
			idOf: (request) => request.source.nodeId,
			kept: (request) => keptResponse(request.source),
			now: () => Date.now(),
			send: async (request, next) => {
				// Its own references first; their errors keep their code.
				const inner = await referenceValues(
					request.draft,
					request.source,
					steps,
					next,
				);
				const response = await steps.send(request, scopeOf(inner));
				keepResponse(request.source, response);
				return response;
			},
		},
		chain.length > 0 ? chain : [self.nodeId],
	);
}

function scopeOf(values: ReadonlyMap<string, string>): VariableScope | null {
	if (values.size === 0) return null;
	return { variables: [...values].map(([key, value]) => ({ key, value })) };
}

/**
 * The scope of the references `draft` holds (`null` when none), or why
 * they could not be filled. `self` is the collection request being sent.
 */
export async function referenceScope(
	draft: ApiRequestDraft,
	self: TabSource | null | undefined,
	steps: ReferenceSteps,
): Promise<ReferenceOutcome> {
	try {
		return {
			ok: true,
			scope: scopeOf(await referenceValues(draft, self, steps, [])),
		};
	} catch (error) {
		if (error instanceof OutsideCollection) {
			const { t } = activeTranslator();
			return {
				ok: false,
				code: "REFERENCE_OUTSIDE_COLLECTION",
				message: t("apiClient.send.references.REFERENCE_OUTSIDE_COLLECTION"),
			};
		}
		return failure(error);
	}
}
