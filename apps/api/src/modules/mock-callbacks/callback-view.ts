import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { z } from "zod";
import { CALLBACK_EVENTS } from "../mock-runtime/request-log-model.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	callbackHeaderView,
	hideUrlQuery,
	toHeaderViews,
} from "./callback-headers.js";
import type { StoredCallback } from "./callback-model.js";
import { deliveryView, toDeliveryView } from "./delivery-view.js";
import {
	type OutboundTarget,
	outboundTargetSchema,
	targetLabel,
} from "./outbound-target.js";

/** One callback of a resource with its last delivery. */
export const callbackView = z.object({
	id: z.string(),
	on: z.enum(CALLBACK_EVENTS),
	target: outboundTargetSchema,
	/**
	 * `https://…` or `tunnel:<port><path>`. A URL's query reads `?[hidden]`
	 * unless `revealsHeaderValues` (in `target` too).
	 */
	targetLabel: z.string(),
	bodyTemplate: z.string(),
	/** Values read `[hidden]` (`hidden: true`) unless `revealsHeaderValues`. */
	headers: z.array(callbackHeaderView),
	enabled: z.boolean(),
	/** How the last delivery ended; null before the first one. */
	last: deliveryView.nullable(),
});

export type CallbackView = z.infer<typeof callbackView>;

/** The target as shown: a URL's query hidden unless `reveal`. */
function shownTarget(target: OutboundTarget, reveal: boolean): OutboundTarget {
	if (reveal || target.kind !== "url") return target;
	return { kind: "url", url: hideUrlQuery(target.url) };
}

/**
 * `reveal`: header values and the URL's query as stored, else hidden
 * (see `callback-headers`).
 */
export function toCallbackView(
	callback: StoredCallback,
	reveal: boolean,
): CallbackView {
	const target = shownTarget(callback.target, reveal);
	return {
		id: callback.id,
		on: callback.on,
		target,
		targetLabel: targetLabel(target),
		bodyTemplate: callback.bodyTemplate,
		headers: toHeaderViews(callback.headers, reveal),
		enabled: callback.enabled,
		last: toDeliveryView(callback.last),
	};
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** The resource of the project the callbacks belong to; 404 otherwise. */
export async function requireCallbackResource(
	projectId: Types.ObjectId,
	resourceId: string,
): Promise<{ _id: Types.ObjectId; name: string }> {
	const resource = OBJECT_ID.test(resourceId)
		? await ResourceModel.findOne({
				_id: new Types.ObjectId(resourceId),
				projectId,
			})
				.select("_id name")
				.lean<{ _id: Types.ObjectId; name: string }>()
		: null;
	if (!resource) {
		throw new OperationError(404, "NOT_FOUND", "Resource not found");
	}
	return resource;
}
