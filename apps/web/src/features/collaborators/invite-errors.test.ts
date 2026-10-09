import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en/dictionary";
import { vi } from "../../i18n/messages/vi/dictionary";
import { createTranslator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { inviteErrorMessage, invitePageErrorMessage } from "./invite-errors";

const english = createTranslator("en", en).t;

describe("inviteErrorMessage", () => {
	it("asks for an email when several accounts share the username", () => {
		expect(
			inviteErrorMessage(
				new ApiError(409, "AMBIGUOUS_USERNAME", "Several accounts"),
				english,
			),
		).toBe("Several accounts use this username. Invite them by email instead.");
	});

	it("speaks the current language", () => {
		const vietnamese = createTranslator("vi", vi).t;
		expect(
			inviteErrorMessage(
				new ApiError(409, "AMBIGUOUS_USERNAME", "Several accounts"),
				vietnamese,
			),
		).toBe(vi.collaborators.errors.ambiguousUsername);
	});

	it("falls back to a generic text for an unmapped API code", () => {
		expect(
			inviteErrorMessage(new ApiError(500, "INTERNAL", "Boom"), english),
		).toBe(en.collaborators.errors.fallback);
	});
});

describe("invitePageErrorMessage", () => {
	it("maps a rate limit to the page text", () => {
		expect(
			invitePageErrorMessage(
				new ApiError(429, "RATE_LIMITED", "Slow down"),
				english,
			),
		).toBe(en.invite.errors.rateLimited);
	});
});
