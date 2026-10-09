import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { downloadText } from "../../platform/download";
import { item, renderAdmin } from "./pro-interest-test-helpers";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

describe("ProInterestPage", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(downloadText).mockClear();
	});

	it("blocks users who are not the owner without calling the admin API", async () => {
		const { calls } = renderAdmin(false, {});
		expect(
			await screen.findByRole("heading", {
				name: "403 · Chỉ owner xem được trang này",
			}),
		).toBeInTheDocument();
		expect(calls.some((c) => c.path.startsWith("/api/v1/admin"))).toBe(false);
	});

	it("falls back to the 403 page when the API refuses", async () => {
		renderAdmin(true, {
			"GET /api/v1/admin/pro-interest/stats": {
				status: 403,
				body: { error: { code: "FORBIDDEN", message: "Không có quyền." } },
			},
		});
		expect(
			await screen.findByText("403 · Chỉ owner xem được trang này"),
		).toBeInTheDocument();
	});

	it("shows totals, charts and the masked list", async () => {
		renderAdmin(true, {});
		const total = await screen.findByText("Tổng người quan tâm");
		expect(total.parentElement).toHaveTextContent("12");
		const bySource = screen.getByRole("region", { name: "Theo nguồn mở form" });
		const bars = within(bySource).getAllByRole("listitem");
		expect(bars[0]).toHaveTextContent("Giới hạn project7");
		expect(await screen.findByText("a1***@example.com")).toBeInTheDocument();
		expect(screen.getByText("Mock API, API Client")).toBeInTheDocument();
	});

	it("filters the list through query parameters", async () => {
		const { calls } = renderAdmin(true, {});
		await screen.findByText("a1***@example.com");
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Nguồn" }),
			"plan_limit_projects",
		);
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Trạng thái" }),
			"false",
		);
		await waitFor(() => {
			const last = calls
				.filter((c) => c.path === "/api/v1/admin/pro-interest")
				.at(-1);
			expect(last?.query.get("source")).toBe("plan_limit_projects");
			expect(last?.query.get("contacted")).toBe("false");
			expect(last?.query.get("page")).toBe("1");
		});
	});

	it("downloads the CSV with the current filter", async () => {
		const { calls } = renderAdmin(true, {
			"GET /api/v1/admin/pro-interest/export": {
				body: { filename: "pro-interest.csv", csv: "email\na@x.vn" },
			},
		});
		await screen.findByText("a1***@example.com");
		await userEvent.selectOptions(
			screen.getByRole("combobox", { name: "Nhu cầu" }),
			"mock",
		);
		await userEvent.click(screen.getByRole("button", { name: "Xuất CSV" }));
		await waitFor(() =>
			expect(downloadText).toHaveBeenCalledWith(
				"pro-interest.csv",
				"email\na@x.vn",
			),
		);
		const exported = calls.find((c) => c.path.endsWith("/export"));
		expect(exported?.query.get("need")).toBe("mock");
	});

	it("marks a sign-up as contacted", async () => {
		const { calls } = renderAdmin(true, {
			"PUT /api/v1/admin/pro-interest/a1/contacted": {
				body: item("a1", { contactedAt: "2026-10-09T02:00:00.000Z" }),
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Đánh dấu đã liên hệ" }),
		);
		await waitFor(() =>
			expect(
				document.querySelector('[data-id="admin-pro-row-a1-status"]'),
			).toHaveTextContent("Đã liên hệ"),
		);
		expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
			contacted: true,
		});
	});

	it("deletes on request after confirming, dry run first", async () => {
		const { calls } = renderAdmin(true, {
			"DELETE /api/v1/admin/pro-interest/a1": ({ query }) => ({
				body: {
					id: "a1",
					deleted: !query.has("dryRun"),
					dryRun: query.has("dryRun"),
				},
			}),
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Xoá theo yêu cầu" }),
		);
		const dialog = screen.getByRole("dialog", { name: "Xoá theo yêu cầu" });
		expect(dialog).toHaveTextContent("Xoá đăng ký của a1***@example.com?");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xoá vĩnh viễn" }),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		const deletes = calls.filter((c) => c.method === "DELETE");
		expect(deletes.map((c) => c.query.get("dryRun"))).toEqual(["true", null]);
		// Stats are reloaded after the delete.
		expect(calls.filter((c) => c.path.endsWith("/stats"))).toHaveLength(2);
	});
});
