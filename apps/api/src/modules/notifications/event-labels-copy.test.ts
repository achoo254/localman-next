import { SUPPORTED_LOCALES } from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	NOTIFICATION_EVENT_TYPES,
	OWNER_EVENT_TYPES,
} from "./notification-events.js";
import { eventLabel } from "./notification-texts.js";

/** Plan, price and trial wording in the three locales (ADR-0002). */
const COMMERCIAL =
	/\b(pro|plans?|pricing|trial|upgrade)\b|gói|nâng cấp|dùng thử|套餐|升级|试用/i;

describe("notification setting labels seen by users", () => {
	it.each(SUPPORTED_LOCALES)("name no plan, price or trial in %s", (locale) => {
		const shown = NOTIFICATION_EVENT_TYPES.filter(
			(type) => !OWNER_EVENT_TYPES.includes(type),
		);
		const commercial = shown
			.map((type) => eventLabel(type, locale))
			.filter((label) => COMMERCIAL.test(label));
		expect(commercial).toEqual([]);
	});
});
