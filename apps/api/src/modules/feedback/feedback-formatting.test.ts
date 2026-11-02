import { describe, expect, it } from "vitest";
import { maskEmail } from "../../lib/mask-email.js";

describe("maskEmail", () => {
	it.each([
		["nguyen@gmail.com", "ng***@gm***.com"],
		["a@b.co", "a***@b***.co"],
		["dev@mail.example.vn", "de***@ma***.vn"],
		["broken", "***"],
	])("%s becomes %s", (email, masked) => {
		expect(maskEmail(email)).toBe(masked);
	});
});
