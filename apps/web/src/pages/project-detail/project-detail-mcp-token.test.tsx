import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import { seriousViolations } from "../../test/axe";
import type { MockRoute } from "../../test/mock-fetch";
import { findToast } from "../../test/toast";
import { ALL_FEATURES } from "../landing/landing-test-helpers";
import {
	PROJECT_ID,
	RESOURCES_PATH,
	renderDetail,
} from "./project-detail-test-helpers";

const TOKEN_PATH = `/api/v1/projects/${PROJECT_ID}/mcp-token`;
const ROTATE_PATH = `${TOKEN_PATH}/rotate`;
const TOKEN = "lmmcp_FIRSTsecretValue00000000000000000a9e5";
const ROTATED = "lmmcp_SECONDsecretValue0000000000000000b7c1";
const HINT = { last4: "a9e5", createdAt: "2026-10-09T01:00:00.000Z" };
const ON = { required: true, token: HINT };

function renderToken(routes: Record<string, MockRoute>) {
	return renderDetail(
		{ [`GET ${RESOURCES_PATH}`]: { body: { items: [] } }, ...routes },
		undefined,
		{ flags: ALL_FEATURES, path: `/projects/${PROJECT_ID}?endpoint=mcp` },
	);
}

const tokenSwitch = () =>
	screen.findByRole("switch", { name: "Yêu cầu token cho MCP" });

describe("MCP token setting", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("turns the token on after confirmation and shows it only once", async () => {
		const { calls, queryClient } = renderToken({
			[`GET ${TOKEN_PATH}`]: { body: { required: false, token: null } },
			[`PUT ${TOKEN_PATH}`]: { body: { ...ON, issuedToken: TOKEN } },
		});
		const toggle = await tokenSwitch();
		expect(toggle).toHaveAttribute("aria-checked", "false");
		await userEvent.click(toggle);
		const dialog = screen.getByRole("dialog", { name: "Bật token cho MCP" });
		expect(dialog).toHaveTextContent("Token mới chỉ hiện một lần");
		expect(toggle).toHaveAttribute("aria-checked", "false");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Bật token" }),
		);

		expect(await screen.findByDisplayValue(TOKEN)).toBeInTheDocument();
		const copy = screen.getByRole("button", { name: "Sao chép token" });
		await waitFor(() => expect(copy).toHaveFocus());
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		const panel = document.querySelector('[data-id="project-detail-mcp"]');
		if (!panel) throw new Error("no MCP panel");
		expect(await seriousViolations(panel)).toEqual([]);
		expect(toggle).toHaveAttribute("aria-checked", "true");
		expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
			required: true,
		});
		// Snippets read the token from a variable; the cache never holds it.
		const output = document.querySelector(
			'[data-id="project-detail-mcp-config-output"]',
		);
		expect(output).toHaveTextContent("$LOCALMAN_MCP_TOKEN_DEMO_SHOP");
		expect(output).not.toHaveTextContent(TOKEN);
		expect(
			JSON.stringify(queryClient.getQueryData(["mcp-token", PROJECT_ID])),
		).not.toContain(TOKEN);

		await userEvent.click(screen.getByRole("button", { name: "Đã lưu token" }));
		expect(screen.queryByDisplayValue(TOKEN)).toBeNull();
		expect(document.body).not.toHaveTextContent(TOKEN);
		expect(
			document.querySelector('[data-id="project-detail-mcp-token-hint"]'),
		).toHaveTextContent("Token lmmcp_…a9e5 · tạo 09/10/2026");
		expect(screen.getByRole("button", { name: "Xoay token" })).toHaveFocus();
	});

	it("rotates only after confirmation and shows the new token", async () => {
		const { calls } = renderToken({
			[`GET ${TOKEN_PATH}`]: { body: ON },
			[`POST ${ROTATE_PATH}`]: {
				body: { dryRun: false, ...ON, issuedToken: ROTATED },
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Xoay token" }),
		);
		let dialog = screen.getByRole("dialog", { name: "Xoay token MCP" });
		expect(dialog).toHaveTextContent("Token cũ hết hiệu lực ngay");
		await userEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
		expect(calls.some((call) => call.path === ROTATE_PATH)).toBe(false);

		await userEvent.click(screen.getByRole("button", { name: "Xoay token" }));
		dialog = screen.getByRole("dialog", { name: "Xoay token MCP" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Xoay token" }),
		);
		expect(await screen.findByDisplayValue(ROTATED)).toBeInTheDocument();
		expect(calls.filter((call) => call.path === ROTATE_PATH)).toHaveLength(1);
	});

	it("turns it off, keeping the token, and says so", async () => {
		renderToken({
			[`GET ${TOKEN_PATH}`]: { body: ON },
			[`PUT ${TOKEN_PATH}`]: { body: { required: false, token: HINT } },
		});
		const toggle = await tokenSwitch();
		await userEvent.click(toggle);
		const dialog = screen.getByRole("dialog", { name: "Tắt token cho MCP" });
		expect(dialog).toHaveTextContent("Token hiện tại được giữ lại");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Tắt token" }),
		);
		expect(await findToast("Đã tắt yêu cầu token MCP.")).toBeInTheDocument();
		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(screen.queryByDisplayValue(/lmmcp_/)).toBeNull();
	});

	it("keeps the dialog open and the switch unchanged when the call fails", async () => {
		renderToken({
			[`GET ${TOKEN_PATH}`]: { body: { required: false, token: null } },
			[`PUT ${TOKEN_PATH}`]: {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Lỗi máy chủ." } },
			},
		});
		const toggle = await tokenSwitch();
		await userEvent.click(toggle);
		const dialog = screen.getByRole("dialog", { name: "Bật token cho MCP" });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Bật token" }),
		);
		expect(await within(dialog).findByText("Lỗi máy chủ.")).toBeVisible();
		expect(toggle).toHaveAttribute("aria-checked", "false");
	});

	it("offers a retry when the setting cannot be loaded", async () => {
		renderToken({
			[`GET ${TOKEN_PATH}`]: {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Lỗi máy chủ." } },
			},
		});
		expect(
			await screen.findByText("Không tải được cài đặt token"),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
		expect(screen.queryByRole("switch")).toBeNull();
	});
});
