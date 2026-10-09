import { z } from "zod";
import { maskEmail } from "../../lib/mask-email.js";
import type { InviteeAccount } from "./invitee-lookup.js";

/** The account card of the invite dialog: no full email, ever. */
export const inviteeView = z.object({
	username: z.string(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	/** e.g. `a***@gm***.com`; `null` when the account has no email. */
	maskedEmail: z.string().nullable(),
	/** `false`: show "email chưa xác minh" so the owner can spot a fake. */
	emailVerified: z.boolean(),
});
export type InviteeView = z.infer<typeof inviteeView>;

export function toInviteeView(account: InviteeAccount): InviteeView {
	return {
		username: account.username,
		name: account.name,
		picture: account.picture,
		maskedEmail: account.email ? maskEmail(account.email) : null,
		emailVerified: account.emailVerified,
	};
}
