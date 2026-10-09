import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTurnstile } from "./turnstile";

describe("loadTurnstile", () => {
	afterEach(() => {
		window.turnstile = undefined;
	});

	it("renders with the site key and the pro_interest action", async () => {
		const render = vi.fn(() => "w1");
		const remove = vi.fn();
		window.turnstile = { render, remove };
		const client = await loadTurnstile();
		const container = document.createElement("div");
		const onToken = vi.fn();
		expect(
			client.render(container, "site-key", { onToken, onReset: vi.fn() }),
		).toBe("w1");
		expect(render).toHaveBeenCalledWith(
			container,
			expect.objectContaining({
				sitekey: "site-key",
				action: "pro_interest",
				callback: onToken,
			}),
		);
		client.remove("w1");
		expect(remove).toHaveBeenCalledWith("w1");
	});
});
