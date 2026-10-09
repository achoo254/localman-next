import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	listBody,
	member,
	person,
} from "../../features/collaborators/collaborators-test-helpers";
import { makeProject } from "../../test/fixtures";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	renderDetail,
	sampleTree,
} from "./project-detail-test-helpers";

const MEMBERS = `/api/v1/projects/${PROJECT_ID}/collaborators`;
const TREE = { [`GET ${RESOURCES_PATH}`]: { body: { items: sampleTree() } } };

describe("members from the project page", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("does not open New resource over the members dialog of an empty project", async () => {
		renderDetail({
			[`GET ${RESOURCES_PATH}`]: { body: { items: [] } },
			[`GET ${MEMBERS}`]: listBody([]),
		});
		await screen.findByText(/Chưa có resource nào/);
		await userEvent.click(
			screen.getByRole("button", { name: /^Cộng tác viên/ }),
		);
		await screen.findByRole("dialog", { name: "Cộng tác viên · Demo shop" });
		await new Promise((resolve) => setTimeout(resolve, 800));
		expect(screen.queryByRole("dialog", { name: "Resource mới" })).toBeNull();
	});

	it("gives the owner the collaborators and magic link dialogs", async () => {
		renderDetail({
			...TREE,
			[`GET ${MEMBERS}`]: listBody([member("an")]),
			[`GET /api/v1/projects/${PROJECT_ID}/magic-link`]: {
				body: { status: "none", expiresAt: null, createdAt: null },
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: /^Cộng tác viên/ }),
		);
		const dialog = await screen.findByRole("dialog", {
			name: "Cộng tác viên · Demo shop",
		});
		await within(dialog).findByText("An · @an");
		await userEvent.click(within(dialog).getByRole("button", { name: "Xong" }));
		// The page learnt the member count from the dialog.
		expect(
			await screen.findByRole("button", { name: "Cộng tác viên · 1" }),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Magic link" }));
		expect(
			await screen.findByRole("dialog", { name: "Magic link · Demo shop" }),
		).toBeInTheDocument();
	});

	it("lets a collaborator leave and returns to /projects", async () => {
		const shared = makeProject(PROJECT_ID, {
			name: "Demo shop",
			role: "collaborator",
			memberCount: 2,
		});
		const { router, queryClient } = renderDetail(
			{
				...TREE,
				[`GET ${MEMBERS}`]: listBody(
					[member("me", { user: person("me", { sub: "user-1" }) })],
					{ canManage: false },
				),
				[`DELETE ${MEMBERS}/me`]: { body: { removed: true } },
			},
			shared,
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Cộng tác viên · 1" }),
		);
		expect(screen.queryByRole("button", { name: "Magic link" })).toBeNull();
		const dialog = await screen.findByRole("dialog", {
			name: "Cộng tác viên · Demo shop",
		});
		await userEvent.click(
			await within(dialog).findByRole("button", { name: "Rời project" }),
		);
		const confirm = screen.getByRole("dialog", { name: "Rời project" });
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Rời project" }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/projects"),
		);
		expect(queryClient.getQueryData(["project", PROJECT_ID])).toBeUndefined();
	});
});
