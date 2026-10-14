import { screen } from "@testing-library/react";
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
import { GuestCollectionPage } from "./guest-collection-page";

const VIEW = "POST /api/v1/guest-links/view";

function guestView(canRequestAccess: boolean, alreadyHasAccess: boolean) {
	return {
		body: {
			...publicView(),
			collectionId: "c1",
			canRequestAccess,
			alreadyHasAccess,
		},
	};
}

function renderGuest(
	routes: Parameters<typeof renderPage>[0],
	flags?: Parameters<typeof renderPage>[1]["flags"],
) {
	return renderPage(routes, {
		path: "/guest/:linkId",
		at: "/guest/lnk_9",
		element: <GuestCollectionPage />,
		flags,
	});
}

describe("/guest/:linkId", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("goes to the API client while the flag is off", async () => {
		const { calls } = renderGuest({}, NO_FEATURES);
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(calls.some((c) => c.path.includes("guest-links"))).toBe(false);
	});

	it("shows the redacted collection, without a request button when access can't be asked", async () => {
		const { calls } = renderGuest({ [VIEW]: guestView(false, false) });
		expect(
			await screen.findByRole("heading", { level: 1, name: /Orders API/ }),
		).toBeInTheDocument();
		expect(screen.getByRole("tree")).toBeInTheDocument();
		expect(byId("guest-note")).toHaveTextContent(
			"Opening this link gives you no access",
		);
		expect(
			screen.queryByRole("button", { name: "Request edit access" }),
		).toBeNull();
		expect(
			screen.queryByRole("link", { name: "Open in workspace" }),
		).toBeNull();
		expect(
			calls.find((c) => c.path === "/api/v1/guest-links/view")?.body,
		).toEqual({ linkId: "lnk_9" });
	});

	it("opens the access request form for Editor", async () => {
		const { calls } = renderGuest({
			[VIEW]: guestView(true, false),
			"POST /api/v1/elements/collection/c1/access-requests": {
				status: 201,
				body: { sent: true },
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Request edit access" }),
		);
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "You don't have access",
			}),
		).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: /Editor/ })).toBeChecked();
		await userEvent.click(
			screen.getByRole("button", { name: "Request access" }),
		);
		expect(await screen.findByText("Request sent")).toBeInTheDocument();
		expect(
			calls.find((c) => c.path.endsWith("/access-requests"))?.body,
		).toEqual({ role: "editor" });
	});

	it("links people who already have access to the collection", async () => {
		renderGuest({ [VIEW]: guestView(true, true) });
		const open = await screen.findByRole("link", { name: "Open in workspace" });
		expect(open).toHaveAttribute("href", "/elements/collection/c1");
		expect(
			screen.queryByRole("button", { name: "Request edit access" }),
		).toBeNull();
	});

	it("says the link is gone on 404", async () => {
		renderGuest({ [VIEW]: apiError(404, "PUBLIC_LINK_NOT_FOUND") });
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: "This link does not exist or was turned off",
			}),
		).toBeInTheDocument();
	});
});
