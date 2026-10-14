/**
 * Turning a collection's public or guest link on, reading it and turning
 * it off. Both kinds behave the same; only the switch, the page and who
 * may open it differ (`collection-link-service.ts`).
 */
import { defineOperation } from "@localman/operations";
import {
	type CollectionLinkKind,
	findSecretLikeValues,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import {
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import {
	disableLink,
	enableLink,
	findLink,
	toLinkView,
} from "./collection-link-service.js";
import {
	WARNINGS_NOTE,
	collectionLinkView,
	secretWarnings,
} from "./public-sharing-views.js";
import { publicViewOf } from "./public-tree.js";
import { requirePublishable } from "./publish-access.js";

interface LinkKindSpec {
	readonly kind: CollectionLinkKind;
	/** `Public`, `Guest`: part of the operation ids. */
	readonly name: string;
	readonly segment: string;
	readonly what: string;
}

const PUBLISHERS =
	"Only Admins and Editors who are members of the collection's workspace (403 FORBIDDEN otherwise; a person shared the collection alone cannot).";

export function collectionLinkOperations(spec: LinkKindSpec) {
	const path = `${COLLECTION_PATH}/${spec.segment}`;
	const toggle =
		spec.kind === "public" ? "publicLinksAllowed" : "guestsAllowed";
	const input = z.object({ collectionId: collectionIdSchema });

	const enable = defineOperation({
		id: `sharing.enableCollection${spec.name}Link`,
		method: "POST",
		path,
		summary: `Turn on the ${spec.kind} link of a collection`,
		description: `${spec.what} Returns the link that is on already, else a new one. ${PUBLISHERS} 403 ${toggle === "publicLinksAllowed" ? "PUBLIC_LINKS_DISABLED" : "GUESTS_DISABLED"} when an Admin turned them off. Secret variables, credentials typed into Authorization, credential headers and query values, URL user:password and example response bodies are hidden. ${WARNINGS_NOTE} Call with dryRun to see the warnings first.`,
		input,
		output: z.object({
			dryRun: z.boolean(),
			link: collectionLinkView.nullable(),
			warnings: secretWarnings,
		}),
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "sharing",
		mcp: true,
		dryRun: true,
		requiresConfirmation: true,
		handler: async (ctx, { collectionId }) => {
			const sub = requireSubject(ctx);
			const access = await requirePublishable(sub, collectionId, toggle);
			const view = await publicViewOf({ _id: access.collectionId });
			const warnings = findSecretLikeValues(view.tree);
			if (ctx.dryRun) {
				const link = await findLink(access.collectionId, spec.kind);
				return { dryRun: true, link: link && toLinkView(link), warnings };
			}
			const link = await enableLink(
				{
					collectionId: access.collectionId,
					workspaceId: access.element.workspaceId,
				},
				spec.kind,
				sub,
			);
			return { dryRun: false, link: toLinkView(link), warnings };
		},
	});

	const get = defineOperation({
		id: `sharing.getCollection${spec.name}Link`,
		method: "GET",
		path,
		summary: `Get the ${spec.kind} link of a collection`,
		description: `The ${spec.kind} link when it is on, else \`null\`. Anyone who can view the collection may read it. 404 NOT_FOUND for a collection the caller cannot see.`,
		input,
		output: z.object({ link: collectionLinkView.nullable() }),
		scopes: [USER_SCOPE],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "sharing",
		mcp: true,
		handler: async (ctx, { collectionId }) => {
			const sub = requireSubject(ctx);
			const access = await requireCollection(sub, collectionId, "view");
			const link = await findLink(access.collectionId, spec.kind);
			return { link: link && toLinkView(link) };
		},
	});

	const disable = defineOperation({
		id: `sharing.disableCollection${spec.name}Link`,
		method: "DELETE",
		path,
		summary: `Turn off the ${spec.kind} link of a collection`,
		description: `The link stops at once; turning it on again gives a new address. \`disabled\` is false when it was off already. ${PUBLISHERS}`,
		input,
		output: z.object({ dryRun: z.boolean(), disabled: z.boolean() }),
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: true, idempotent: true },
		toolset: "sharing",
		mcp: true,
		dryRun: true,
		handler: async (ctx, { collectionId }) => {
			const sub = requireSubject(ctx);
			const access = await requirePublishable(sub, collectionId, null);
			if (ctx.dryRun) {
				const link = await findLink(access.collectionId, spec.kind);
				return { dryRun: true, disabled: link !== null };
			}
			return {
				dryRun: false,
				disabled: await disableLink(access.collectionId, spec.kind),
			};
		},
	});

	return [enable, get, disable] as const;
}
