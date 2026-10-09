import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTurnstile } from "./turnstile";

describe("loadTurnstile", () => {
	afterEach(() => {
		window.turnstile = undefined;
	});

	it.each(["pro_interest", "contact"] as const)(
		"renders with the site key and the %s action",
		async (action) => {
			const render = vi.fn(() => "w1");
			const remove = vi.fn();
			window.turnstile = { render, remove };
			const client = await loadTurnstile();
			const container = document.createElement("div");
			const onToken = vi.fn();
			expect(
				client.render(container, "site-key", {
					onToken,
					onReset: vi.fn(),
					action,
				}),
			).toBe("w1");
			expect(render).toHaveBeenCalledWith(
				container,
				expect.objectContaining({
					sitekey: "site-key",
					action,
					callback: onToken,
				}),
			);
			client.remove("w1");
			expect(remove).toHaveBeenCalledWith("w1");
		},
	);
});
