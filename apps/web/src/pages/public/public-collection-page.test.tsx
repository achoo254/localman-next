import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	apiError,
	byId,
	publicView,
	renderPage,
} from "../../features/public-sharing/public-sharing-test-helpers";
import { navigateToLogin } from "../../platform/navigation";
import { seriousViolations } from "../../test/axe";
import { UNAUTHENTICATED } from "../../test/mock-fetch";
import { PublicCollectionPage } from "./public-collection-page";

vi.mock("../../platform/navigation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../platform/navigation")>()),
	navigateToLogin: vi.fn(),
}));

const VIEW = "GET /api/v1/public/links/lnk_1";

function renderPublic(
	routes: Parameters<typeof renderPage>[0],
	flags?: Parameters<typeof renderPage>[1]["flags"],
) {
	return renderPage(
		{ "GET /api/v1/users/me": UNAUTHENTICATED, ...routes },
		{
			path: "/public/c/:linkId",
			at: "/public/c/lnk_1",
			element: <PublicCollectionPage />,
			flags,
		},
	);
}

describe("/public/c/:linkId", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(navigateToLogin).mockClear();
	});

	it("goes home while the flag is off, without loading anything", async () => {
		const { calls } = renderPublic({}, NO_FEATURES);
		expect(await screen.findByText("Home page")).toBeInTheDocument();
		expect(calls.some((c) => c.path.includes("/public/"))).toBe(false);
	});

	it("shows the collection read-only to anonymous visitors", async () => {
		renderPublic({ [VIEW]: { body: publicView() } });
		expect(
			await screen.findByRole("heading", { level: 1, name: /Orders API/ }),
		).toBeInTheDocument();
		expect(screen.getByText(/2 requests/)).toBeInTheDocument();
		// Overview: variables, a secret one hidden.
		const variables = byId("public-variables");
		expect(variables).toHaveTextContent("baseUrlhttps://api.example.com");
		expect(variables).toHaveTextContent("apiKeyhidden");

		const tree = screen.getByRole("tree", { name: "Folders and requests" });
		const items = within(tree).getAllByRole("treeitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"Orders",
			"GETList orders",
			"GETHealth",
		]);
		expect(items[0]).toHaveAttribute("aria-expanded", "true");
		await userEvent.click(items[1] as HTMLElement);

		const request = await screen.findByRole("article");
		expect(
			within(request).getByRole("heading", { name: "List orders" }),
		).toBeInTheDocument();
		expect(byId("public-request-url")).toHaveTextContent(
			"{{baseUrl}}/orders?page=1",
		);
		expect(byId("public-request-headers")).toHaveTextContent("X-Api-Keyhidden");
		expect(byId("public-request-headers")).toHaveTextContent(
			"Acceptapplication/json",
		);
		expect(byId("public-request-auth")).toHaveTextContent(
			"Bearer tokenTokenhidden",
		);
		expect(within(request).getByText("every").tagName).toBe("STRONG");
		const example = byId("public-example");
		expect(example).toHaveTextContent("Two ordersStatus 200 OK");
		expect(example).toHaveTextContent("Content-Typeapplication/json");
		expect(navigateToLogin).not.toHaveBeenCalled();
		const canvas = vi
			.spyOn(HTMLCanvasElement.prototype, "getContext")
			.mockReturnValue(null);
		expect(await seriousViolations(document.body)).toEqual([]);
		canvas.mockRestore();
	});

	it("moves through the tree with the keyboard", async () => {
		renderPublic({ [VIEW]: { body: publicView() } });
		const tree = await screen.findByRole("tree");
		const [folder] = within(tree).getAllByRole("treeitem");
		folder?.focus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(within(tree).getAllByRole("treeitem")).toHaveLength(2);
		expect(folder).toHaveAttribute("aria-expanded", "false");
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		expect(
			within(tree).getByRole("treeitem", { name: /List orders/ }),
		).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		expect(
			await screen.findByRole("heading", { name: "List orders" }),
		).toBeInTheDocument();
		expect(
			within(tree).getByRole("treeitem", { name: /List orders/ }),
		).toHaveAttribute("aria-selected", "true");
	});

	it("says the link is gone on 404", async () => {
		renderPublic({ [VIEW]: apiError(404, "PUBLIC_LINK_NOT_FOUND") });
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "This link does not exist or was turned off",
			}),
		).toBeInTheDocument();
		expect(navigateToLogin).not.toHaveBeenCalled();
	});

	it("asks to wait when rate limited", async () => {
		renderPublic({ [VIEW]: apiError(429, "RATE_LIMITED") });
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "Too many requests",
			}),
		).toBeInTheDocument();
	});
});
