import { describe, expect, it, vi } from "vitest";

// A Capacitor plugin is a Proxy that answers every property with a native
// call, `then` included, and that call throws on a method the plugin lacks:
// the store must never be awaited or returned from an async function.
const stored = new Map<string, string>();
vi.mock("@aparajita/capacitor-secure-storage", () => ({
	SecureStorage: new Proxy(
		{},
		{
			get(_target, property) {
				if (property === "get")
					return async (key: string) => stored.get(key) ?? null;
				if (property === "set")
					return async (key: string, value: string) =>
						void stored.set(key, value);
				if (property === "remove")
					return async (key: string) => void stored.delete(key);
				return () => {
					throw new Error(
						`"SecureStorage.${String(property)}()" is not implemented on ios`,
					);
				};
			},
		},
	),
}));

const {
	forgetMobileSession,
	loadMobileSession,
	mobileSessionToken,
	saveMobileSession,
} = await import("./mobile-session");

describe("mobile session", () => {
	it("loads, saves and forgets the token through the plugin proxy", async () => {
		await loadMobileSession();
		expect(mobileSessionToken()).toBeNull();
		await saveMobileSession("tok");
		expect(mobileSessionToken()).toBe("tok");
		await loadMobileSession();
		expect(mobileSessionToken()).toBe("tok");
		await forgetMobileSession();
		await loadMobileSession();
		expect(mobileSessionToken()).toBeNull();
	});
});
