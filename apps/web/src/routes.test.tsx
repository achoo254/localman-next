import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCurrentUserCache } from "./features/auth/use-current-user";
import { navigateToLogin } from "./platform/navigation";
import { routes } from "./routes";
import { makeUser } from "./test/fixtures";
import { UNAUTHENTICATED, mockFetch } from "./test/mock-fetch";
import { renderRoutes } from "./test/render-app";

// The shared header's guest button: "Sign up free", the short "Sign up" for phones beside it (CSS picks one).
const SIGN_UP = /^Sign up free/;

vi.mock("./platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("./platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

const EMPTY_BELL = { body: { items: [], nextCursor: null, unreadCount: 0 } };

const SIGNED_IN_FOR_LOGIN = {
	"GET /api/v1/users/me": { body: makeUser() },
	"GET /api/v1/notifications": EMPTY_BELL,
	"GET /api/v1/projects": { body: { items: [] } },
};

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
			await screen.findByText("Redirecting to sign-in…"),
		).toBeInTheDocument();
		expect(navigateToLogin).toHaveBeenCalledWith({
			returnTo: "/projects/demo?tab=log",
		});
		expect(screen.queryByRole("banner")).not.toBeInTheDocument();
	});

	it("keeps signed-in users on the landing at /", async () => {
		mockFetch({
			"GET /api/v1/users/me": { body: makeUser() },
			"GET /api/v1/notifications": EMPTY_BELL,
		});
		const { router } = renderRoutes(routes, "/");
		expect(
			await screen.findAllByRole("link", { name: "Open app" }),
		).not.toHaveLength(0);
		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/");
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("shows the landing with one sign-in call to action to anonymous visitors", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/");
		const header = await screen.findByRole("link", { name: SIGN_UP });
		// The header goes to the sign-in card of /login; the landing's own
		// card signs in at once and comes back to the projects.
		expect(header).toHaveAttribute("data-id", "public-sign-in");
		expect(header).toHaveAttribute("href", "/login");
		const cta = screen.getByRole("link", { name: "Sign in with hoandat.com" });
		expect(cta).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects");
		expect(
			screen.queryByRole("link", { name: /Get started|Start free/ }),
		).toBeNull();
		await userEvent.click(cta);
		expect(navigateToLogin).toHaveBeenCalledWith({ returnTo: "/projects" });
	});

	it("shows the sign-in card at /login and comes back to ?returnTo=", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/login?returnTo=%2Finvite%2Fabc");
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Sign in to Localman",
			}),
		).toBeInTheDocument();
		const cta = screen.getByRole("link", { name: "Sign in with hoandat.com" });
		expect(cta).toHaveAttribute("href", "/auth/login?returnTo=%2Finvite%2Fabc");
		await userEvent.click(cta);
		expect(navigateToLogin).toHaveBeenCalledWith({ returnTo: "/invite/abc" });
	});

	it("ignores a ?returnTo= on /login that is not an in-app path", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/login?returnTo=%2F%2Fevil.example");
		const cta = await screen.findByRole("link", {
			name: "Sign in with hoandat.com",
		});
		expect(cta).toHaveAttribute("href", "/auth/login?returnTo=%2Fprojects");
	});

	it("sends a signed-in visitor of /login on to ?returnTo=", async () => {
		mockFetch(SIGNED_IN_FOR_LOGIN);
		const { router } = renderRoutes(routes, "/login?returnTo=%2Fprojects");
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/projects"),
		);
	});

	it("shows an error instead of looping when login keeps bouncing back", async () => {
		window.sessionStorage.setItem(
			"localman-login-redirects",
			JSON.stringify({ count: 2, since: Date.now() }),
		);
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		const { container } = renderRoutes(routes, "/projects");
		expect(
			await screen.findByText(/sent to sign-in several times/),
		).toBeInTheDocument();
		expect(container.querySelector('[data-id="auth-error"]')).not.toBeNull();
		expect(navigateToLogin).not.toHaveBeenCalled();

		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
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
		["access_denied", "You cancelled sign-in"],
		["login_expired", "Your sign-in expired"],
		["login_failed", "Sign-in failed"],
		["idp_unavailable", "Can't reach your hoandat.com account"],
		[
			"rate_limited",
			"You tried to sign in too many times. Please wait a minute and try again.",
		],
	])("explains ?authError=%s on the landing", async (code, title) => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, `/?authError=${code}`);
		expect(await screen.findByRole("alert")).toHaveTextContent(title);
	});

	it("offers to make a new account after a deletion, only on a click", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/?authError=account_deleted");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This Localman account was deleted",
		);
		expect(
			screen.getByRole("link", { name: "Create a new account" }),
		).toHaveAttribute(
			"href",
			expect.stringMatching(/\/auth\/login\?.*recreate=1/),
		);
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("ignores unknown authError values", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		renderRoutes(routes, "/?authError=<script>");
		await screen.findByRole("link", { name: SIGN_UP });
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
		await userEvent.click(screen.getByRole("button", { name: "Try again" }));
		await waitFor(() => expect(calls).toHaveLength(2));
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it.each(["/account", "/admin/pro-interest"])(
		"keeps %s behind sign-in",
		async (path) => {
			mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
			renderRoutes(routes, path);
			await screen.findByText("Redirecting to sign-in…");
			expect(navigateToLogin).toHaveBeenCalledWith({ returnTo: path });
		},
	);

	it("sends old /pricing links to the landing", async () => {
		mockFetch({ "GET /api/v1/users/me": UNAUTHENTICATED });
		const { router } = renderRoutes(routes, "/pricing");
		await screen.findByRole("heading", { level: 1 });
		expect(router.state.location.pathname).toBe("/");
		expect(document.body).not.toHaveTextContent(/pricing|Pro plan/i);
	});
});
