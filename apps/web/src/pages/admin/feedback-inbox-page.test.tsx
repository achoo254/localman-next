import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { LIST_PATH, message, renderInbox } from "./feedback-inbox-test-helpers";

describe("FeedbackInboxPage", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("blocks users who are not the owner without calling the admin API", async () => {
		const { calls } = renderInbox(false);
		expect(
			await screen.findByRole("heading", {
				name: "403 · Only the owner can see this page",
			}),
		).toBeInTheDocument();
		expect(calls.some((c) => c.path.startsWith("/api/v1/admin"))).toBe(false);
	});

	it("falls back to the 403 page when the API refuses", async () => {
		renderInbox(true, {
			[`GET ${LIST_PATH}`]: {
				status: 403,
				body: { error: { code: "FORBIDDEN", message: "Không có quyền." } },
			},
		});
		expect(
			await screen.findByText("403 · Only the owner can see this page"),
		).toBeInTheDocument();
	});

	it("lists messages with their sender, reply address and status", async () => {
		renderInbox(true);
		expect(
			await screen.findByRole("heading", { name: "Bug report · Lan" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Feedback · Visitor" }),
		).toBeVisible();
		expect(screen.getAllByText(/Nút Lưu không chạy/)[0]).toHaveTextContent(
			"Nút Lưu không chạy khi có 20 field",
		);
		expect(screen.getByText("Email: lan@example.com")).toBeInTheDocument();
		expect(screen.getByText("No contact left")).toBeInTheDocument();
		expect(
			document.querySelector('[data-id="admin-feedback-item-m1-status"]'),
		).toHaveTextContent("New");
		expect(
			screen.getByRole("link", { name: "Pro plan interest" }),
		).toBeVisible();
	});

	it("filters by status and category through query parameters", async () => {
		const { calls } = renderInbox(true);
		await screen.findByRole("heading", { name: "Bug report · Lan" });
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Status" }),
			"resolved",
		);
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Type" }),
			"plan_question",
		);
		await waitFor(() => {
			const last = calls.filter((c) => c.path === LIST_PATH).at(-1);
			expect(last?.query.get("status")).toBe("resolved");
			expect(last?.query.get("category")).toBe("plan_question");
			expect(last?.query.get("page")).toBe("1");
		});
	});

	it("marks a message read, then shows the next actions", async () => {
		const { calls } = renderInbox(true, {
			"PUT /api/v1/admin/contact-messages/m1/status": {
				body: message("m1", {
					status: "read",
					readAt: "2026-10-09T04:00:00.000Z",
				}),
			},
		});
		const [markRead] = await screen.findAllByRole("button", {
			name: "Mark as read",
		});
		if (!markRead) throw new Error("no mark-read button");
		await userEvent.click(markRead);
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="admin-feedback-item-m1-status"]'),
			).toHaveTextContent("Read"),
		);
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			status: "read",
		});
		expect(
			document.querySelector('[data-id="admin-feedback-item-m1-new"]'),
		).toHaveTextContent("Mark as unread");
	});
});
