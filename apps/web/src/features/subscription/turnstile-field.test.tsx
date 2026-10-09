import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTurnstile, resetFakeTurnstile } from "../../test/fake-turnstile";
import { TurnstileField } from "./turnstile-field";

vi.mock("../../platform/turnstile", async () => {
	const fake = await import("../../test/fake-turnstile");
	return fake.turnstileModule;
});

describe("TurnstileField", () => {
	afterEach(() => resetFakeTurnstile());

	it("renders one widget under StrictMode's double effect and removes it on unmount", async () => {
		const onTokenChange = vi.fn();
		const view = render(
			<StrictMode>
				<TurnstileField
					siteKey="site-key"
					onTokenChange={onTokenChange}
					errorId="ts-error"
				/>
			</StrictMode>,
		);
		await waitFor(() =>
			expect(onTokenChange).toHaveBeenCalledWith("turnstile-token"),
		);
		expect(fakeTurnstile.render).toHaveBeenCalledTimes(1);
		expect(fakeTurnstile.remove).not.toHaveBeenCalled();
		view.unmount();
		expect(fakeTurnstile.remove).toHaveBeenCalledWith("widget-1");
		expect(onTokenChange).toHaveBeenLastCalledWith(null);
	});
});
