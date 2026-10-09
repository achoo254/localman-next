import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "./features/auth/use-current-user";
import { navigateToLogin } from "./platform/navigation";
import { routes } from "./routes";
import { makeUser } from "./test/fixtures";
import { UNAUTHENTICATED, mockFetch } from "./test/mock-fetch";
import { expectProInterestSource } from "./test/pro-interest";
import { renderRoutes } from "./test/render-app";

vi.mock("./platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("./platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

const EMPTY_BELL = { body: { items: [], nextCursor: null, unreadCount: 0 } };

describe("route guards", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("sends anonymous visitors of /projects* to the IdP with returnTo", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/projects/demo?tab=log");
		expect(
			await screen.findByText("Đang chuyển tới trang đăng nhập…"),
		).toBeInTheDocument();
		expect(navigateToLogin).toHaveBeenCalledWith({
			returnTo: "/projects/demo?tab=log",
		});
		expect(screen.queryByRole("banner")).not.toBeInTheDocument();
	});

	it("moves signed-in users from / to /projects", async () => {
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/notifications": EMPTY_BELL,
			"GET /api/v1/projects": { body: { items: [] } },
		});
		const { router } = renderRoutes(routes, "/");
		expect(
			await screen.findByRole("heading", { name: "Projects" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/projects");
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("shows the landing with login and sign-up links to anonymous visitors", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/");
		const login = await screen.findByRole("link", { name: "Đăng nhập" });
		const signUp = screen.getByRole("link", { name: "Bắt đầu miễn phí" });
		expect(login).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects");
		expect(signUp).toHaveAttribute(
			"href",
			"/auth/login?returnTo=%2Fprojects&prompt=create",
		);
		await userEvent.click(signUp);
		expect(navigateToLogin).toHaveBeenCalledWith({
			returnTo: "/projects",
			prompt: "create",
		});
	});

	it("shows an error instead of looping when login keeps bouncing back", async () => {
		window.sessionStorage.setItem(
			"localman-login-redirects",
			JSON.stringify({ count: 2, since: Date.now() }),
		);
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		const { container } = renderRoutes(routes, "/projects");
		expect(
			await screen.findByText(/nhiều lần mà phiên vẫn chưa được giữ lại/),
		).toBeInTheDocument();
		expect(container.querySelector('[data-id="auth-error"]')).not.toBeNull();
		expect(navigateToLogin).not.toHaveBeenCalled();

		await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		await waitFor(() =>
			expect(navigateToLogin).toHaveBeenCalledWith({ returnTo: "/projects" }),
		);
		expect(
			JSON.parse(
				window.sessionStorage.getItem("localman-login-redirects") ?? "",
			),
		).toMatchObject({ count: 1 });
	});

	it.each([
		["access_denied", "Bạn đã huỷ đăng nhập"],
		["login_expired", "Phiên đăng nhập đã hết hạn"],
		["login_failed", "Đăng nhập không thành công"],
		["idp_unavailable", "Không kết nối được tài khoản hoandat"],
		[
			"rate_limited",
			"Bạn thử đăng nhập quá nhiều lần, vui lòng đợi một phút rồi thử lại.",
		],
	])("explains ?authError=%s on the landing", async (code, title) => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, `/?authError=${code}`);
		expect(await screen.findByRole("alert")).toHaveTextContent(title);
	});

	it("ignores unknown authError values", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/?authError=<script>");
		await screen.findByRole("link", { name: "Đăng nhập" });
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers a retry when the session check fails", async () => {
		const { calls } = mockFetch({
			"GET /api/v1/users/me": {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Lỗi máy chủ." } },
			},
		});
		renderRoutes(routes, "/projects");
		expect(await screen.findByText("Lỗi máy chủ.")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		await waitFor(() => expect(calls).toHaveLength(2));
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it.each(["/account", "/admin/pro-interest"])(
		"keeps %s behind sign-in",
		async (path) => {
			mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
			renderRoutes(routes, path);
			await screen.findByText("Đang chuyển tới trang đăng nhập…");
			expect(navigateToLogin).toHaveBeenCalledWith({ returnTo: path });
		},
	);

	it("lets visitors open the Pro interest form from the landing", async () => {
		mockFetch({
			"GET /api/v1/users/me": UNAUTHENTICATED,
			"GET /api/v1/feedback/pro-interest/config": {
				body: { turnstileSiteKey: null },
			},
		});
		renderRoutes(routes, "/");
		await userEvent.click(
			await screen.findByRole("button", { name: "Liên hệ" }),
		);
		await expectProInterestSource("landing");
		expect(navigateToLogin).not.toHaveBeenCalled();
	});
});
