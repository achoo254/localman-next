import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { held } from "../../pages/project-detail/project-detail-test-helpers";
import { seriousViolations } from "../../test/axe";
import { resetCurrentUserCache } from "../auth/use-current-user";
import { MEMBERS, listBody, openFromMenu } from "./collaborators-test-helpers";

const byId = (root: HTMLElement, id: string) =>
	root.querySelector(`[data-id="${id}"]`);

describe("collaborators dialog, loading", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows member rows as placeholders while the list is slow", async () => {
		const list = held();
		const { dialog } = await openFromMenu({ [`GET ${MEMBERS}`]: list.route });
		await waitFor(() =>
			expect(byId(dialog, "modal-collaborators-loading")).not.toBeNull(),
		);
		expect(byId(dialog, "modal-collaborators-loading")).toHaveAttribute(
			"aria-busy",
			"true",
		);
		await waitFor(() =>
			expect(
				within(dialog)
					.getAllByRole("status")
					.filter((node) => node.textContent === "Loading members…"),
			).toHaveLength(1),
		);
		expect(await seriousViolations(dialog)).toEqual([]);
		await act(async () => list.release(listBody([])));
		expect(
			await within(dialog).findByRole("list", { name: "Collaborator list" }),
		).toBeInTheDocument();
		expect(byId(dialog, "modal-collaborators-loading")).toBeNull();
		expect(screen.getByRole("dialog")).toBe(dialog);
	});
});
