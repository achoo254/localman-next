import { describe, expect, it } from "vitest";
import { decodeBase64Url, pushSupport } from "./push-support";

describe("pushSupport", () => {
	it("decodes URL-safe base64 VAPID keys", () => {
		expect([...decodeBase64Url("AQID")]).toEqual([1, 2, 3]);
		expect([...decodeBase64Url("-_8")]).toEqual([251, 255]);
	});

	it("reports jsdom as unsupported", () => {
		expect(pushSupport.isSupported()).toBe(false);
		expect(pushSupport.permission()).toBe("unsupported");
	});
});
