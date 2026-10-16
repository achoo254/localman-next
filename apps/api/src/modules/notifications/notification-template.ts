import type { Locale } from "@localman/shared";
import type { z } from "zod";
import {
	type ServerMessages,
	messagesFor,
} from "../../i18n/server-messages.js";

/** Title and body of one notification in one language. */
export interface NotificationText {
	readonly title: string;
	readonly body: string;
}

export type Template = (
	params: unknown,
	locale: Locale,
) => NotificationText | null;

/** Validates stored params against `schema` before rendering them. */
export function template<S extends z.ZodType>(
	schema: S,
	render: (
		params: z.output<S>,
		messages: ServerMessages,
		locale: Locale,
	) => NotificationText,
): Template {
	return (params, locale) => {
		const parsed = schema.safeParse(params);
		return parsed.success
			? render(parsed.data, messagesFor(locale), locale)
			: null;
	};
}
