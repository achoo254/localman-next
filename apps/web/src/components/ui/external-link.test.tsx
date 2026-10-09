import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openExternal, safeExternalUrl } from "../../platform/navigation";
import { ExternalLink } from "./external-link";

describe("external links", () => {
	afterEach(() => vi.restoreAllMocks());

	it("accepts only absolute http(s) URLs", () => {
		expect(safeExternalUrl("https://abc.mock.test/users")).toBe(
			"https://abc.mock.test/users",
		);
		expect(safeExternalUrl("http://abc.localhost:4100/x")).not.toBeNull();
		for (const url of [
			"javascript:alert(1)",
			"data:text/html,x",
			"file:///etc",
			"/relative",
			"mock.test",
		]) {
			expect(safeExternalUrl(url), url).toBeNull();
		}
	});

	it("opens a new tab for http(s) and refuses other schemes", () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		expect(openExternal("javascript:alert(1)")).toBe(false);
		expect(open).not.toHaveBeenCalled();
		expect(openExternal("https://t.me/localman")).toBe(true);
		expect(open).toHaveBeenCalledWith(
			"https://t.me/localman",
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("renders an unsafe href as plain text that does nothing", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		render(<ExternalLink href="javascript:alert(1)">users</ExternalLink>);
		const text = screen.getByText("users");
		expect(text).not.toHaveAttribute("href");
		expect(screen.queryByRole("link")).toBeNull();
		await userEvent.click(text);
		expect(open).not.toHaveBeenCalled();
	});

	it("keeps safe links as real links opened through the platform", async () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null);
		render(
			<ExternalLink href="https://abc.mock.test/users">users</ExternalLink>,
		);
		const link = screen.getByRole("link", { name: "users" });
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		await userEvent.click(link);
		expect(open).toHaveBeenCalledWith(
			"https://abc.mock.test/users",
			"_blank",
			"noopener,noreferrer",
		);
	});
});
