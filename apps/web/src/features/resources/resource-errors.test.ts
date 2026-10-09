import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { vi } from "../../i18n/messages/vi/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError, errorMessage } from "../../lib/api-client";
import { localizedError, resourceErrorMessage } from "./resource-errors";

const { t } = createTranslator("en", en);

const error = (status: number, code: string, details?: unknown) =>
	new ApiError(status, code, `${code} in English`, details);

describe("resourceErrorMessage", () => {
	it.each([
		[409, "PARENT_HAS_NO_DATA", "Generate data for the parent resource first."],
		[
			409,
			"RESOURCE_NAME_TAKEN",
			"There's already a resource with this name here.",
		],
		[
			409,
			"TREE_CYCLE",
			"Can't nest a resource into itself or into one of its child resources.",
		],
		[
			409,
			"TREE_TOO_DEEP",
			"The resource tree can be nested at most 10 levels deep.",
		],
		[
			404,
			"NOT_FOUND",
			"The resource or project no longer exists. Reload the page to see the latest data.",
		],
		[
			403,
			"PLAN_LIMIT_REACHED",
			"You've used all the resources your current plan allows.",
		],
		[403, "FORBIDDEN", "You can only view this project."],
		[400, "VALIDATION_ERROR", "The submitted data is invalid."],
		[
			413,
			"PAYLOAD_TOO_LARGE",
			"The submitted data is too large (2 MB max per resource).",
		],
	])("maps %i %s", (status, code, message) => {
		expect(resourceErrorMessage(error(status, code), t)).toBe(message);
	});

	it("leaves a rate limit to the shared API message", () => {
		const limited = error(429, "RATE_LIMITED");
		expect(resourceErrorMessage(limited, t)).toBe(errorMessage(limited));
	});

	it("names the field of a validation error and the resource of a size error", () => {
		expect(
			resourceErrorMessage(
				error(400, "VALIDATION_ERROR", [
					{ path: "schema.0.name", message: "x" },
				]),
				t,
			),
		).toBe("Invalid data at “schema.0.name”: VALIDATION_ERROR in English");
		expect(
			resourceErrorMessage(
				error(413, "DATA_TOO_LARGE", { limit: "resource", name: "posts" }),
				t,
			),
		).toBe(
			"The data of posts is over 2 MB. Reduce the number of records or the size of each record.",
		);
		expect(resourceErrorMessage(error(409, "FIELD_CONFLICT"), t)).toMatch(
			/userId/,
		);
		expect(resourceErrorMessage(error(400, "TEMPLATE_TOO_LARGE"), t)).toMatch(
			/32 KB/,
		);
	});

	it("speaks the current language instead of the API's English", () => {
		const viT = createTranslator("vi", vi).t;
		expect(resourceErrorMessage(error(409, "TREE_TOO_DEEP"), viT)).toBe(
			"Cây resource chỉ lồng được tối đa 10 cấp.",
		);
		expect(
			resourceErrorMessage(
				error(413, "DATA_TOO_LARGE", { limit: "record" }),
				viT,
			),
		).toBe("Dữ liệu có bản ghi vượt 32 KB. Hãy rút gọn bản ghi hoặc template.");
	});

	it("falls back to the API message, and keeps the code when localizing", () => {
		expect(resourceErrorMessage(error(409, "CONFLICT"), t)).toBe(
			"CONFLICT in English",
		);
		const localized = localizedError(error(409, "TREE_CYCLE"), t);
		expect(localized).toBeInstanceOf(ApiError);
		expect(localized).toMatchObject({ code: "TREE_CYCLE", status: 409 });
		expect((localized as ApiError).message).toMatch(/^Can't nest/);
	});
});
