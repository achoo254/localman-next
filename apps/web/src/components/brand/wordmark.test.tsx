import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
	it("reads Localman with 'Local' in the primary colour", () => {
		const { container } = render(<Wordmark data-id="brand" />);
		const root = container.firstElementChild;
		expect(root).toHaveTextContent(/^Localman$/);
		expect(root).toHaveClass("font-mono", "font-bold", "text-fg");
		expect(root).toHaveAttribute("data-id", "brand");
		expect(screen.getByText("Local")).toHaveClass("text-primary");
	});
});
