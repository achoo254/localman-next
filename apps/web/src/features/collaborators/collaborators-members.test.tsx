import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeProject, makeUser } from "../../test/fixtures";
import { findToast } from "../../test/toast";
import { resetCurrentUserCache } from "../auth/use-current-user";
import {
	EXPIRES,
	MEMBERS,
	listBody,
	member,
	openFromMenu,
	person,
} from "./collaborators-test-helpers";

const SECRET = "/api/v1/projects/p1/rotate-secret";
const row = (dialog: HTMLElement, id: string) =>
	dialog.querySelector(`[data-id="${id}"]`);

describe("members of a project", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("cancels a pending invitation at once and labels expired ones", async () => {
		const pending = member("lan", {
			status: "pending",
			acceptedAt: null,
			expiresAt: EXPIRES,
			user: person("lan", { emailVerified: false }),
		});
		const expired = member("x9", {
			status: "expired",
			user: null,
			inviteeEmail: "old@example.com",
			acceptedAt: null,
			expiresAt: "2026-10-01T01:00:00.000Z",
		});
		const { calls, dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: listBody([pending, expired]),
			[`DELETE ${MEMBERS}/lan`]: { body: { removed: true } },
		});
		await within(dialog).findByText("Lan · @lan");
		expect(row(dialog, "collaborator-lan")).toHaveTextContent(
			"email chưa xác minh",
		);
		// 200ms fold in/out from the motion token, off with reduced motion.
		expect(row(dialog, "collaborator-lan")).toHaveClass(
			"duration-(--dur-base)",
			"motion-reduce:transition-none",
		);
		expect(row(dialog, "collaborator-link-x9")).toHaveTextContent(
			"Link mời · old@example.com · đã hết hạn 01/10/2026",
		);
		expect(row(dialog, "collaborator-link-x9")).toHaveTextContent("Hết hạn");
		expect(
			within(dialog).getByRole("button", {
				name: /^Xoá lời mời Link mời · old@example.com/,
			}),
		).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Huỷ lời mời Lan · @lan" }),
		);
		expect(await findToast("Đã huỷ lời mời Lan · @lan")).toBeInTheDocument();
		expect(row(dialog, "modal-collaborators-status")).toHaveTextContent(
			"Đã huỷ lời mời Lan · @lan",
		);
		expect(calls.some((c) => c.method === "DELETE")).toBe(true);
		await waitFor(() => expect(row(dialog, "collaborator-lan")).toBeNull());
		// Focus moved to the next row's X button, not to <body>.
		expect(
			within(dialog).getByRole("button", { name: /^Xoá lời mời Link mời/ }),
		).toHaveFocus();
	});

	it("confirms removing a joined member, then offers to change the mock URL", async () => {
		const rotated = makeProject("p1", {
			name: "Demo",
			secret: "new42",
			mockBaseUrl: "https://new42.mock.localman.test",
		});
		const { dialog } = await openFromMenu({
			[`GET ${MEMBERS}`]: listBody([member("an"), member("binh")]),
			[`DELETE ${MEMBERS}/an`]: { body: { removed: true } },
			[`POST ${SECRET}`]: ({ query }) =>
				query.get("dryRun") === "true"
					? { body: { dryRun: true, collaborators: 1, project: rotated } }
					: { body: { dryRun: false, collaborators: 1, project: rotated } },
		});
		await within(dialog).findByText("An · @an");
		const list = document.querySelector('[data-id="project-row-p1"]');
		await waitFor(() => expect(list).toHaveTextContent("2 cộng tác viên"));
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xoá An · @an khỏi project" }),
		);
		const confirm = screen.getByRole("dialog", { name: "Xoá cộng tác viên" });
		expect(confirm).toHaveTextContent("Xoá An khỏi Demo?");
		expect(within(confirm).getByRole("button", { name: "Huỷ" })).toHaveFocus();
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Xoá khỏi project" }),
		);
		expect(await findToast("Đã xoá An khỏi project")).toBeInTheDocument();
		// Focus moved on to the next row's X button once the confirmation closed.
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", {
					name: "Xoá Binh · @binh khỏi project",
				}),
			).toHaveFocus(),
		);
		await waitFor(() => expect(row(dialog, "collaborator-an")).toBeNull());
		await waitFor(() => expect(list).toHaveTextContent("1 cộng tác viên"));

		const hint = row(dialog, "modal-collaborators-rotate-hint");
		expect(hint).toHaveTextContent("Người này vẫn biết URL mock");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Đổi URL mock" }),
		);
		const rotate = screen.getByRole("dialog", { name: "Đổi URL mock" });
		await within(rotate).findByText(/1 cộng tác viên sẽ nhận thông báo/);
		await userEvent.click(
			within(rotate).getByRole("button", { name: "Đổi URL" }),
		);
		await within(dialog).findByText(/Đã đổi URL mock/);
		expect(list).toHaveTextContent("https://new42.mock.localman.test");
	});

	it("shows a collaborator the members only and lets them leave", async () => {
		const shared = makeProject("p1", {
			name: "Demo",
			role: "collaborator",
			memberCount: 3,
		});
		const { calls, dialog, queryClient } = await openFromMenu(
			{
				[`GET ${MEMBERS}`]: listBody(
					[
						member("lan", { user: person("lan", { sub: "user-1" }) }),
						member("binh"),
					],
					{ canManage: false },
				),
				[`DELETE ${MEMBERS}/lan`]: { body: { removed: true } },
			},
			{
				project: shared,
				others: [makeProject("p2", { name: "Khác" })],
				user: makeUser({ username: "lan" }),
			},
		);
		queryClient.setQueryData(["project", "p1"], shared);
		await within(dialog).findByText("Lan · @lan");
		expect(row(dialog, "collaborator-lan")).toHaveTextContent("Bạn");
		expect(within(dialog).queryByLabelText("Username hoặc email")).toBeNull();
		expect(within(dialog).queryByRole("button", { name: /^Xoá/ })).toBeNull();
		expect(row(dialog, "modal-collaborators-close")).toHaveFocus();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rời project" }),
		);
		const confirm = screen.getByRole("dialog", { name: "Rời project" });
		expect(confirm).toHaveTextContent("Rời Demo?");
		await userEvent.click(
			within(confirm).getByRole("button", { name: "Rời project" }),
		);
		expect(await findToast("Đã rời Demo")).toBeInTheDocument();
		await waitFor(() =>
			expect(document.querySelector('[data-id="project-row-p1"]')).toBeNull(),
		);
		// Focus lands on the next project, and the cached project is gone.
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="project-row-p2-open"]'),
			).toHaveFocus(),
		);
		expect(queryClient.getQueryData(["project", "p1"])).toBeUndefined();
		expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
	});
});
