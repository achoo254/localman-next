import { defineOperation } from "@localman/operations";
import { TURNSTILE_ACTIONS } from "@localman/shared";
import { z } from "zod";
import { contactAlertText } from "./contact-message-alert.js";
import { ContactMessageModel } from "./contact-message-model.js";
import {
	type ContactMessageSubmission,
	contactMessageSubmissionSchema,
	parseContact,
} from "./contact-message-schema.js";
import { assertHumanGuest, takeFeedbackSlot } from "./feedback-guards.js";
import { alertOwnerThrottled } from "./owner-alert-throttle.js";

/** Stores the message, then alerts the owner (throttled, in background). */
async function recordContactMessage(
	input: ContactMessageSubmission,
	userSub: string | null,
): Promise<void> {
	const contact = input.contact ? parseContact(input.contact) : null;
	await ContactMessageModel.create({
		type: "contact",
		category: input.category,
		message: input.message,
		source: input.source,
		status: "new",
		...(input.name ? { name: input.name } : {}),
		...(contact ?? {}),
		...(userSub ? { userSub } : {}),
	});
	const entry = {
		category: input.category,
		message: input.message,
		contact,
		signedIn: userSub !== null,
		source: input.source,
	};
	await alertOwnerThrottled("feedback.contact", (locale) =>
		contactAlertText(entry, locale),
	);
}

export const submitContactMessage = defineOperation({
	id: "feedback.submitContactMessage",
	method: "POST",
	path: "/feedback/contact",
	summary: "Send feedback or a question to the Localman owner",
	description:
		"Public. Stores a message (category, text, optional name and email or Telegram username to reply to, the app area it was sent from) for the owner's inbox and alerts the owner on Telegram. Guests need a Turnstile token (widget action `contact`, site key from `GET /feedback/pro-interest/config`) when it is enabled; a signed-in sender is linked to the message.",
	input: contactMessageSubmissionSchema,
	output: z.object({ received: z.boolean() }),
	scopes: [],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "feedback",
	mcp: {
		exempt:
			"Form công khai cho người: khách phải qua Cloudflare Turnstile (agent không giải được), và góp ý gửi owner phải do chính người dùng viết",
	},
	successStatus: 201,
	handler: async (ctx, input) => {
		const userSub = ctx.auth?.subjectId ?? null;
		const caller = { userSub, clientIp: ctx.clientIp };
		await takeFeedbackSlot("contact", caller);
		// Honeypot filled: only a bot sees the hidden field. Answer as if
		// stored, before any other check, so it learns nothing.
		if (input.website) return { received: true };
		await assertHumanGuest(
			caller,
			input.turnstileToken,
			TURNSTILE_ACTIONS.contact,
		);
		await recordContactMessage(input, userSub);
		return { received: true };
	},
});
