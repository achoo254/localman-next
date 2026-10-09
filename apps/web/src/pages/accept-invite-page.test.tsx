import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "../features/auth/use-current-user";
import { routes } from "../routes";
import { seriousViolations } from "../test/axe";
import { UNAUTHENTICATED, mockFetch } from "../test/mock-fetch";
import { renderRoutes } from "../test/render-app";
import { findToast } from "../test/toast";
import {
	ACCEPT,
	PREVIEW,
	TOKEN,
	preview,
	renderInvite,
	tokenError,
} from "./accept-invite-test-helpers";

describe("/invite/:token", () => {
	beforeEach(() => {
		resetCurrentUserCache();
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("asks anonymous visitors to sign in or sign up, outside the app shell", async () => {
		const { calls } = mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, `/invite/${TOKEN}`);
		const heading = await screen.findByRole("heading", {
			name: "Bạn được mời tham gia một project trên Localman",
		});
		expect(heading).toHaveFocus();
		const back = encodeURIComponent(`/invite/${TOKEN}`);
		// The public top bar signs in back to this invite as well.
		expect(
			within(screen.getByRole("banner")).getByRole("link", {
				name: "Sign in",
			}),
		).toHaveAttribute("href", `/auth/login?returnTo=${back}`);
		const page = within(screen.getByRole("main"));
		expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
			"href",
			`/auth/login?returnTo=${back}`,
		);
		expect(page.getByRole("link", { name: "Đăng ký" })).toHaveAttribute(
			"href",
			`/auth/login?returnTo=${back}&prompt=create`,
		);
		// The project stays private until sign-in.
		expect(calls.some((c) => c.path === "/api/v1/invites/preview")).toBe(false);
	});

	it("previews a valid invite and joins the project", async () => {
		const { calls, router, container } = renderInvite({
			[PREVIEW]: preview(),
			[ACCEPT]: { body: { projectId: "p1", alreadyMember: false } },
		});
		const heading = await screen.findByRole("heading", {
			name: "Tham gia Demo shop",
		});
		await waitFor(() => expect(heading).toHaveFocus());
		expect(
			screen.getByText("Hoà (@hoa) mời bạn cộng tác."),
		).toBeInTheDocument();
		expect(screen.getByText("Hết hạn 16/10/2026")).toBeInTheDocument();
		expect(container).toHaveTextContent(
			"Bạn đang đăng nhập bằng minhanh@example.com",
		);
		expect(
			calls.find((c) => c.path === "/api/v1/invites/preview")?.body,
		).toEqual({ token: TOKEN });
		expect(await seriousViolations(container)).toEqual([]);
		await userEvent.click(screen.getByRole("button", { name: "Tham gia" }));
		expect(await findToast("Đã tham gia Demo shop")).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/projects/p1");
	});

	it("labels a magic link as shared", async () => {
		renderInvite({ [PREVIEW]: preview({ kind: "magic", inviteeEmail: null }) });
		expect(
			await screen.findByText("Link dùng chung · hết hạn 16/10/2026"),
		).toBeInTheDocument();
	});

	it.each([
		[
			410,
			"INVITE_EXPIRED",
			"Link mời đã hết hạn",
			"Link hết hạn ngày 01/10/2026.",
		],
		[
			410,
			"INVITE_USED",
			"Link mời đã được dùng",
			"Mỗi link mời chỉ dùng được một lần.",
		],
		[
			410,
			"INVITE_REVOKED",
			"Link mời không còn hiệu lực",
			"Chủ project đã thu hồi",
		],
		[404, "INVITE_NOT_FOUND", "Link mời không còn hiệu lực", "link không đúng"],
	])("shows %s %s as its own state", async (status, code, title, text) => {
		renderInvite({
			[PREVIEW]: tokenError(status, code, {
				expiresAt: "2026-10-01T01:00:00.000Z",
			}),
		});
		const heading = await screen.findByRole("heading", { name: title });
		await waitFor(() => expect(heading).toHaveFocus());
		expect(
			document.querySelector('[data-id="invite-page-invalid"]'),
		).toHaveTextContent(text);
		expect(screen.getByRole("link", { name: "Về Projects" })).toHaveAttribute(
			"href",
			"/projects",
		);
	});
});
