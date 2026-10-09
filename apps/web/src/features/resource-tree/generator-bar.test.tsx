import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GeneratorBar, type GeneratorBarProps } from "./generator-bar";

function renderBar(props: Partial<GeneratorBarProps> = {}) {
	const onCommit = vi.fn();
	const onBlocked = vi.fn();
	const view = render(
		<GeneratorBar
			value={0}
			label="Records of users"
			blockedReason={null}
			onCommit={onCommit}
			onBlocked={onBlocked}
			data-id="bar"
			{...props}
		/>,
	);
	const slider = screen.getByRole("slider", { name: "Records of users" });
	// jsdom has no layout: give the bar its real 106px box at x = 100.
	slider.getBoundingClientRect = () => new DOMRect(100, 0, 106, 25);
	const tip = () => view.container.querySelector('[data-part="tip"]');
	return { slider, onCommit, onBlocked, tip, ...view };
}

describe("GeneratorBar with the mouse", () => {
	it("shows the count under the pointer and hides it on leave", () => {
		const { slider, tip } = renderBar();
		fireEvent.pointerMove(slider, { clientX: 153 });
		expect(tip()).toHaveTextContent("50");
		fireEvent.pointerMove(slider, { clientX: 206 });
		expect(tip()).toHaveTextContent("100");
		fireEvent.pointerMove(slider, { clientX: 40 });
		expect(tip()).toHaveTextContent("0");
		fireEvent.pointerLeave(slider);
		expect(tip()).toBeNull();
	});

	it("generates exactly the count clicked", () => {
		const { slider, onCommit } = renderBar();
		fireEvent.click(slider, { clientX: 100 + 106 * 0.25 });
		expect(onCommit).toHaveBeenCalledWith(25);
	});

	it("fills the bar to the current count", () => {
		const { container } = renderBar({ value: 40 });
		const fill = container.querySelector('[data-part="fill"]');
		expect(fill).toHaveStyle({ transform: "scaleX(0.4)" });
		expect(fill).toHaveClass(
			"duration-(--dur-base)",
			"motion-reduce:transition-none",
		);
	});
});

describe("GeneratorBar with the keyboard", () => {
	it("moves a pending value by 10 and generates on Enter", async () => {
		const user = userEvent.setup();
		const { slider, onCommit } = renderBar({ value: 20 });
		expect(slider).toHaveAttribute("aria-valuemin", "0");
		expect(slider).toHaveAttribute("aria-valuemax", "100");
		expect(slider).toHaveAttribute("aria-valuenow", "20");
		await user.tab();
		expect(slider).toHaveFocus();
		await user.keyboard("{ArrowRight}{ArrowRight}{ArrowUp}");
		expect(slider).toHaveAttribute("aria-valuenow", "50");
		expect(slider).toHaveAttribute("aria-valuetext", "50 records");
		expect(onCommit).not.toHaveBeenCalled();
		await user.keyboard("{ArrowLeft}{Enter}");
		expect(onCommit).toHaveBeenCalledWith(40);
	});

	it("ignores Enter until a value was picked with the keys", async () => {
		const user = userEvent.setup();
		const { onCommit } = renderBar({ value: 30 });
		await user.tab();
		await user.keyboard("{Enter}");
		expect(onCommit).not.toHaveBeenCalled();
		await user.keyboard("{ArrowLeft}{ArrowRight}{Enter}");
		expect(onCommit).toHaveBeenCalledWith(30);
	});

	it("clamps to 0–100 and jumps with Home and End", async () => {
		const user = userEvent.setup();
		const { slider, onCommit } = renderBar({ value: 90 });
		await user.tab();
		await user.keyboard("{ArrowRight}{ArrowRight}");
		expect(slider).toHaveAttribute("aria-valuenow", "100");
		await user.keyboard("{Home}{ArrowLeft}");
		expect(slider).toHaveAttribute("aria-valuenow", "0");
		await user.keyboard("{End}{Enter}");
		expect(onCommit).toHaveBeenCalledWith(100);
	});

	it("drops the pending value on Escape and on blur", async () => {
		const user = userEvent.setup();
		const { slider } = renderBar({ value: 30 });
		await user.tab();
		await user.keyboard("{ArrowRight}");
		expect(slider).toHaveAttribute("aria-valuenow", "40");
		await user.keyboard("{Escape}");
		expect(slider).toHaveAttribute("aria-valuenow", "30");
		await user.keyboard("{ArrowLeft}");
		await user.tab();
		expect(slider).toHaveAttribute("aria-valuenow", "30");
	});
});

describe("GeneratorBar when blocked", () => {
	it("explains why and reports clicks and Enter instead of generating", async () => {
		const user = userEvent.setup();
		const { slider, onCommit, onBlocked, tip } = renderBar({
			blockedReason: "Generate data for users first.",
		});
		expect(slider).toHaveAttribute("aria-disabled", "true");
		expect(slider).toHaveAttribute(
			"aria-valuetext",
			"0 records. Generate data for users first.",
		);
		fireEvent.pointerMove(slider, { clientX: 150 });
		expect(tip()).toBeNull();
		fireEvent.click(slider, { clientX: 150 });
		await user.tab();
		await user.keyboard("{ArrowRight}{Enter}");
		expect(slider).toHaveAttribute("aria-valuenow", "0");
		expect(onBlocked).toHaveBeenCalledTimes(2);
		expect(onCommit).not.toHaveBeenCalled();
	});
});
