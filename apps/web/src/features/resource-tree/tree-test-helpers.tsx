import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { FeatureFlags } from "../../config/features";
import {
	ALL_FEATURES,
	renderWithFeatures,
} from "../../pages/landing/landing-test-helpers";
import type { Resource } from "../resources/resource-model";
import { ResourceTreeCanvas } from "./resource-tree-canvas";

/** A saved resource with an empty schema. */
export function resource(
	id: string,
	overrides: Partial<Resource> = {},
): Resource {
	return {
		id,
		parentId: null,
		name: id,
		parentKey: null,
		schema: [],
		template: null,
		endpoints: [],
		count: 0,
		...overrides,
	};
}

/** users (10 records) → posts → comments, and likes at the root. */
export function sampleResources(): Resource[] {
	return [
		resource("users", { count: 10 }),
		resource("posts", { parentId: "users", parentKey: "userId" }),
		resource("comments", { parentId: "posts", parentKey: "postId" }),
		resource("likes"),
	];
}

/** The project page canvas with spied handlers, every feature on. */
export function renderTree(
	resources: readonly Resource[] = sampleResources(),
	flags: FeatureFlags = ALL_FEATURES,
) {
	const handlers = {
		onGenerate: vi.fn(),
		onAction: vi.fn(),
		onMove: vi.fn(),
		onOpenInClient: vi.fn(),
	};
	const view = renderWithFeatures(
		<ResourceTreeCanvas
			resources={resources}
			mockBaseUrl="https://abc123.mock.localman.test/api/v1"
			{...handlers}
		/>,
		flags,
	);
	return { ...view, ...handlers };
}

/** The tree item of a resource (the keyboard focus target). */
export function treeItem(name: string): HTMLElement {
	return screen.getByRole("treeitem", { name });
}

/** The card of a resource, with its link, slider and buttons. */
export function nodeCard(name: string): HTMLElement {
	const card = document.querySelector<HTMLElement>(
		`[data-tree-node][data-name="${name}"]`,
	);
	if (!card) throw new Error(`no card for ${name}`);
	return card;
}

/** Scroll viewport of the project canvas. */
export function viewport(container: HTMLElement): HTMLElement {
	const element = container.querySelector<HTMLElement>(
		'[data-id="resource-tree-viewport"]',
	);
	if (!element) throw new Error("no canvas viewport");
	return element;
}

/** Gives the viewport a layout size (jsdom lays nothing out). */
export function sizeViewport(
	element: HTMLElement,
	width: number,
	height: number,
) {
	Object.defineProperty(element, "clientWidth", {
		value: width,
		configurable: true,
	});
	Object.defineProperty(element, "clientHeight", {
		value: height,
		configurable: true,
	});
}

/** Presses Tab until a tree item holds the focus (past the zoom buttons and the rail). */
export async function tabIntoTree(): Promise<void> {
	for (let presses = 0; presses < 10; presses += 1) {
		await userEvent.tab();
		if (document.activeElement?.getAttribute("role") === "treeitem") return;
	}
	throw new Error("Tab never reached the tree");
}

/** Opens the ⋯ menu of the node named `name` and returns the menu. */
export async function openNodeMenu(name: string): Promise<HTMLElement> {
	await userEvent.click(
		within(nodeCard(name)).getByRole("button", {
			name: `More actions for ${name}`,
		}),
	);
	return screen.findByRole("menu");
}
