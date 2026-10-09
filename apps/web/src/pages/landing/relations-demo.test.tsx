import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithFeatures } from "./landing-test-helpers";
import { RelationsDemo } from "./relations-demo";

function count(container: HTMLElement): string {
	return (
		container.querySelector('[data-id="landing-relations-count"]')
			?.textContent ?? ""
	);
}

function groupOrder(container: HTMLElement): string[] {
	return [...container.querySelectorAll('[data-id^="landing-ep-"]')].map(
		(group) => group.getAttribute("data-id")?.replace("landing-ep-", "") ?? "",
	);
}

async function nest(moving: string, target: string | null) {
	await userEvent.click(
		screen.getByRole("button", { name: `Select ${moving} to move` }),
	);
	await userEvent.click(
		target === null
			? screen.getByRole("button", { name: "Add to root" })
			: screen.getByRole("button", { name: `Nest ${moving} into ${target}` }),
	);
}

describe("RelationsDemo", () => {
	it("starts from the seed with 25 endpoints and no API call", () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		expect(count(container)).toBe("25 endpoints");
		expect(groupOrder(container)).toEqual([
			"users",
			"comments",
			"likes",
			"posts",
		]);
		expect(container.querySelector('[data-id="demo-node-users"] a')).toBeNull();
	});

	it("updates the list live when comments is nested into posts, and resets", async () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		await nest("comments", "posts");
		expect(count(container)).toBe("30 endpoints");
		expect(groupOrder(container)).toEqual([
			"users",
			"likes",
			"posts",
			"comments",
		]);
		expect(
			container.querySelector('[data-id="landing-ep-comments"]'),
		).toHaveTextContent("/posts/:postId/comments/:id");
		expect(
			await screen.findByText("Nested comments into posts."),
		).toBeInTheDocument();

		await nest("likes", "users");
		expect(count(container)).toBe("35 endpoints");

		await userEvent.click(screen.getByRole("button", { name: "Reset" }));
		expect(count(container)).toBe("25 endpoints");
	});

	it("moves a resource back to the root through the rail", async () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		await nest("posts", null);
		expect(count(container)).toBe("20 endpoints");
	});

	it("refuses a cycle and keeps the endpoints", async () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		await nest("users", "posts");
		expect(
			await screen.findByText(
				"Can't nest users into posts because it would create a loop.",
			),
		).toBeInTheDocument();
		expect(count(container)).toBe("25 endpoints");
	});
});
