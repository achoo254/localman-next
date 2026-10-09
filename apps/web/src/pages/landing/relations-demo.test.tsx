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
		screen.getByRole("button", { name: `Chọn ${moving} để di chuyển` }),
	);
	await userEvent.click(
		target === null
			? screen.getByRole("button", { name: "Thêm vào root" })
			: screen.getByRole("button", { name: `Lồng ${moving} vào ${target}` }),
	);
}

describe("RelationsDemo", () => {
	it("starts from the seed with 25 endpoints and no API call", () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		expect(count(container)).toBe("25 endpoint");
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
		expect(count(container)).toBe("30 endpoint");
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
			await screen.findByText("Đã lồng comments vào posts."),
		).toBeInTheDocument();

		await nest("likes", "users");
		expect(count(container)).toBe("35 endpoint");

		await userEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
		expect(count(container)).toBe("25 endpoint");
	});

	it("moves a resource back to the root through the rail", async () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		await nest("posts", null);
		expect(count(container)).toBe("20 endpoint");
	});

	it("refuses a cycle and keeps the endpoints", async () => {
		const { container } = renderWithFeatures(<RelationsDemo />);
		await nest("users", "posts");
		expect(
			await screen.findByText(
				"Không thể lồng users vào posts vì sẽ tạo vòng lặp.",
			),
		).toBeInTheDocument();
		expect(count(container)).toBe("25 endpoint");
	});
});
