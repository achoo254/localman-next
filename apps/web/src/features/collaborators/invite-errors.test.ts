import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api-client";
import { inviteErrorMessage } from "./invite-errors";

describe("inviteErrorMessage", () => {
	it("asks for an email when several accounts share the username", () => {
		expect(
			inviteErrorMessage(
				new ApiError(409, "AMBIGUOUS_USERNAME", "Several accounts"),
			),
		).toBe("Có nhiều tài khoản dùng username này. Hãy mời bằng email.");
	});
});
