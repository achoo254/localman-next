import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
	it("reads Localman in the sans font with 'Local' in the primary colour", () => {
		const { container } = render(<Wordmark data-id="brand" />);
		const root = container.firstElementChild;
		expect(root).toHaveTextContent(/^Localman$/);
		expect(root).toHaveClass("font-sans", "font-bold", "text-fg");
		expect(root).toHaveAttribute("data-id", "brand");
		expect(screen.getByText("Local")).toHaveClass("text-primary");
	});

	it("shows the app mark as a decorative image before the name", () => {
		const { container } = render(<Wordmark />);
		const mark = container.querySelector("img");
		expect(mark).toHaveAttribute("alt", "");
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(mark?.getAttribute("src")).toMatch(/localman-mark-128/);
	});
});
