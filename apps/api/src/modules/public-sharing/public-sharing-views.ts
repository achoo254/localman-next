import { SECRET_LIKE_PLACES } from "@localman/shared/api-client";
import { z } from "zod";

export const linkIdSchema = z.string().min(1).max(128);

export const collectionLinkView = z.object({
	kind: z.enum(["public", "guest"]),
	/** The page to hand out: `/public/c/<id>` or `/guest/<id>`. */
	url: z.string(),
	createdBy: z.string(),
	createdAt: z.string(),
});

/** Where the published data holds values that look like secrets; never the values. */
export const secretWarnings = z.array(
	z.object({
		where: z.enum(SECRET_LIKE_PLACES),
		path: z.array(z.string()),
		key: z.string(),
	}),
);

export const WARNINGS_NOTE =
	"`warnings` lists where the redacted collection still holds values that look like secrets (plain variables, scripts, bodies, headers, URLs), without the values: plain variables are published as they are.";
