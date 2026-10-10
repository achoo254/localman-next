import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TREE_GEOMETRY, layoutTree } from "./tree-layout";
import {
	nodeCard,
	renderTree,
	sampleResources,
	sizeViewport,
	tabIntoTree,
	treeItem,
	viewport,
} from "./tree-test-helpers";

const LAYOUT = layoutTree(sampleResources(), TREE_GEOMETRY);

function content(container: HTMLElement): HTMLElement {
	const element = container.querySelector<HTMLElement>(
		'[data-id="resource-tree-content"]',
	);
	if (!element) throw new Error("no canvas content");
	return element;
}

/** Renders the tree with a viewport of half the layout width. */
function renderSized() {
	const view = renderTree();
	sizeViewport(viewport(view.container), LAYOUT.width / 2, 2000);
	return view;
}

describe("canvas zoom and pan", () => {
	it("fits the tree with Fit and goes back with 100%", async () => {
		const { container } = renderSized();
		const fit = screen.getByRole("button", { name: /Fit/ });
		const actual = screen.getByRole("button", { name: /100%/ });
		expect(actual).toHaveAttribute("aria-pressed", "true");
		expect(content(container).style.transform).toBe("");

		await userEvent.click(fit);
		expect(fit).toHaveAttribute("aria-pressed", "true");
		expect(content(container).style.transform).toBe("scale(0.5)");
		// The sizer has the scaled size, so the scrollbars match the view.
		const sizer = content(container).parentElement;
		expect(sizer?.style.width).toBe(`${LAYOUT.width / 2}px`);

		await userEvent.click(actual);
		expect(content(container).style.transform).toBe("");
		expect(sizer?.style.width).toBe(`${LAYOUT.width}px`);
	});

	it("zooms with Shift+1 and Shift+0 from inside the canvas", async () => {
		const { container } = renderSized();
		await tabIntoTree();
		expect(treeItem("users")).toHaveFocus();
		fireEvent.keyDown(treeItem("users"), { code: "Digit1", shiftKey: true });
		expect(content(container).style.transform).toBe("scale(0.5)");
		fireEvent.keyDown(treeItem("users"), { code: "Digit0", shiftKey: true });
		expect(content(container).style.transform).toBe("");
	});

	it("pans by dragging the background, not a node", () => {
		const { container } = renderTree();
		const element = viewport(container);
		fireEvent.pointerDown(element, { button: 0, clientX: 300, clientY: 200 });
		fireEvent.pointerMove(element, { clientX: 220, clientY: 150 });
		fireEvent.pointerUp(element);
		expect(element.scrollLeft).toBe(80);
		expect(element.scrollTop).toBe(50);

		fireEvent.pointerDown(nodeCard("users"), { button: 0, clientX: 300 });
		fireEvent.pointerMove(element, { clientX: 100 });
		fireEvent.pointerUp(element);
		expect(element.scrollLeft).toBe(80);
	});

	it("reads the generator under the pointer correctly while zoomed", async () => {
		const { container, onGenerate } = renderSized();
		await userEvent.click(screen.getByRole("button", { name: /Fit/ }));
		expect(content(container).style.transform).toBe("scale(0.5)");
		const slider = within(nodeCard("users")).getByRole("slider");
		// At 50% the 106px bar spans 53 screen pixels.
		slider.getBoundingClientRect = () => new DOMRect(400, 100, 53, 12.5);
		// 3/4 of the scaled bar: 75 records, not 75 % of 106 unscaled pixels.
		fireEvent.click(slider, { clientX: 400 + 53 * 0.75 });
		expect(onGenerate).toHaveBeenCalledWith(
			expect.objectContaining({ id: "users" }),
			75,
		);
	});
});
