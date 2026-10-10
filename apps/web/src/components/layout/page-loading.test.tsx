import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageLoading } from "./page-loading";

describe("PageLoading", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("shows nothing for 150 ms, then a page skeleton announced once", () => {
		const { container } = render(<PageLoading />);
		expect(container).toBeEmptyDOMElement();
		act(() => {
			vi.advanceTimersByTime(150);
		});
		const region = container.querySelector('[data-id="page-loading"]');
		expect(region).toHaveAttribute("aria-busy", "true");
		expect(
			region?.querySelectorAll('[aria-hidden="true"]').length,
		).toBeGreaterThan(3);
		expect(screen.getByRole("status")).toHaveTextContent("Loading page…");
	});
});
