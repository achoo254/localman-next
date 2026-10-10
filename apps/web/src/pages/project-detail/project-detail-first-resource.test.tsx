import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { RESOURCES_PATH, renderDetail } from "./project-detail-test-helpers";
import {
	EMPTY_PROMPT_DELAY_MS,
	markProjectCreated,
} from "./use-first-resource-prompt";

const EMPTY = { [`GET ${RESOURCES_PATH}`]: { body: { items: [] } } };

/** Waits past the prompt's delay, then reports whether a dialog is open. */
async function dialogAfterDelay() {
	await screen.findByText(/No resources yet/);
	await new Promise((resolve) =>
		setTimeout(resolve, EMPTY_PROMPT_DELAY_MS + 200),
	);
	return screen.queryByRole("dialog");
}

describe("first resource prompt", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("opens New resource 500ms after a just-created empty project loads", async () => {
		markProjectCreated("p1");
		renderDetail(EMPTY);
		await screen.findByText(/No resources yet/);
		const shownAt = Date.now();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			await screen.findByRole(
				"dialog",
				{ name: "New resource" },
				{ timeout: 3000 },
			),
		).toBeInTheDocument();
		expect(Date.now() - shownAt).toBeGreaterThanOrEqual(
			EMPTY_PROMPT_DELAY_MS - 50,
		);
	});

	it("does not open it again on the next visit", async () => {
		markProjectCreated("p1");
		const first = renderDetail(EMPTY);
		await screen.findByRole(
			"dialog",
			{ name: "New resource" },
			{ timeout: 3000 },
		);
		first.unmount();
		renderDetail(EMPTY);
		expect(await dialogAfterDelay()).toBeNull();
	});

	it("does not open it for an empty project opened from the list", async () => {
		renderDetail(EMPTY);
		expect(await dialogAfterDelay()).toBeNull();
	});
});
