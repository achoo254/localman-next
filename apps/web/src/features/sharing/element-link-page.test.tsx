import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import type { MockRoute } from "../../test/mock-fetch";
import { ElementLinkPage } from "./element-link-page";
import {
	COLLECTION,
	FLAGS_ON,
	apiError,
	byId,
	renderSharing,
	summary,
} from "./sharing-test-helpers";

const NOT_FOUND = apiError(404, "NOT_FOUND");
const REQUEST = `POST ${COLLECTION}/access-requests`;

function renderLink(
	routes: Record<string, MockRoute>,
	{ at = "/elements/collection/c1", flags = FLAGS_ON } = {},
) {
	return renderSharing(routes, {
		path: "/elements/:type/:id",
		at,
		flags,
		element: <ElementLinkPage />,
	});
}

describe("/elements/:type/:id", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("redirects to the API client while the flag is off", async () => {
		renderLink({}, { flags: { ...NO_FEATURES, workspaces: false } });
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
	});

	it("shows the item and the caller's role when they have access", async () => {
		renderLink({ [`GET ${COLLECTION}`]: summary({ role: "viewer" }) });
		expect(
			await screen.findByRole("heading", { level: 1, name: "Orders API" }),
		).toBeInTheDocument();
		expect(byId("element-page-role")).toHaveTextContent("Your role: Viewer");
		expect(byId("element-page")).toHaveTextContent(
			"Opening it in the workbench arrives with collections.",
		);
	});

	it("asks for access on 404, without naming the item", async () => {
		renderLink({ [`GET ${COLLECTION}`]: NOT_FOUND });
		expect(
			await screen.findByRole("heading", { name: "You don't have access" }),
		).toBeInTheDocument();
		expect(byId("request-access-page")).not.toHaveTextContent("Orders API");
		expect(screen.getByRole("radio", { name: /^Viewer/ })).toBeChecked();
		expect(byId("request-access-editor")).toHaveTextContent(
			"Edit the collection, shared values, merge",
		);
	});

	it("sends the request and confirms it", async () => {
		const { calls } = renderLink({
			[`GET ${COLLECTION}`]: NOT_FOUND,
			[REQUEST]: { body: { status: "sent" } },
		});
		await userEvent.type(
			await screen.findByLabelText(/Message/),
			"Need it for the release",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Request access" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Request sent" }),
		).toHaveFocus();
		expect(byId("request-access-sent")).toHaveTextContent(
			"Request sent. If you can be given access, its editors will be notified.",
		);
		expect(byId("request-access-back")).toHaveAttribute("href", "/api-client");
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			role: "viewer",
			message: "Need it for the release",
		});
	});

	it("preselects Editor from ?role=editor", async () => {
		const { calls } = renderLink(
			{
				[`GET ${COLLECTION}`]: NOT_FOUND,
				[REQUEST]: { body: { status: "sent" } },
			},
			{ at: "/elements/collection/c1?role=editor" },
		);
		expect(await screen.findByRole("radio", { name: /^Editor/ })).toBeChecked();
		expect(byId("request-access-message")).toHaveAttribute("maxlength", "500");
		await userEvent.click(
			screen.getByRole("button", { name: "Request access" }),
		);
		await screen.findByRole("heading", { name: "Request sent" });
		expect(calls.find((c) => c.method === "POST")?.body).toEqual({
			role: "editor",
		});
	});

	it("opens the item when the caller turns out to have access", async () => {
		// Access was granted between opening the link and asking.
		let granted = false;
		renderLink({
			[`GET ${COLLECTION}`]: () => (granted ? summary() : NOT_FOUND),
			[REQUEST]: () => {
				granted = true;
				return apiError(409, "ALREADY_HAS_ACCESS");
			},
		});
		await userEvent.click(
			await screen.findByRole("button", { name: "Request access" }),
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Orders API" }),
		).toBeInTheDocument();
		expect(byId("element-page-role")).toHaveTextContent("Your role: Editor");
	});

	it("explains a link with an unknown item type", async () => {
		renderLink({}, { at: "/elements/folder/x1" });
		expect(
			await screen.findByRole("heading", { name: "This link isn't valid" }),
		).toBeInTheDocument();
	});
});
