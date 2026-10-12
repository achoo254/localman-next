import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import type { MockRoute } from "../../test/mock-fetch";
import {
	PERSONAL,
	TEAM,
	chooseWorkspace,
	savedWorkspace,
} from "../workspaces/workspaces-test-helpers";
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
const ENVIRONMENT = "/api/v1/elements/environment/e1";
const REQUEST = `POST ${COLLECTION}/access-requests`;

function renderLink(
	routes: Record<string, MockRoute>,
	{ at = "/elements/collection/c1", flags = FLAGS_ON } = {},
) {
	const workspaces = { body: { items: [PERSONAL, TEAM] } };
	return renderSharing(
		{ "GET /api/v1/workspaces": workspaces, ...routes },
		{
			path: "/elements/:type/:id",
			at,
			flags,
			element: <ElementLinkPage />,
		},
	);
}

describe("/elements/:type/:id", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("redirects to the API client while the flag is off", async () => {
		renderLink({}, { flags: { ...NO_FEATURES, workspaces: false } });
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
	});

	it("switches to the item's workspace and opens it in the API client", async () => {
		chooseWorkspace("w-personal");
		const { router } = renderLink({
			[`GET ${COLLECTION}`]: summary({ role: "viewer" }),
		});
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(router.state.location.state).toEqual({
			openElement: { type: "collection", id: "c1" },
		});
		expect(savedWorkspace()).toBe("w-team");
	});

	it("keeps a node of the collection, and drops a malformed one", async () => {
		const routes = { [`GET ${COLLECTION}`]: summary() };
		const first = renderLink(routes, { at: "/elements/collection/c1?node=f1" });
		await screen.findByText("Workbench page");
		expect(first.router.state.location.state).toEqual({
			openElement: { type: "collection", id: "c1", nodeId: "f1" },
		});
		first.unmount();
		const second = renderLink(routes, {
			at: "/elements/collection/c1?node=%3Cscript%3E",
		});
		await screen.findByText("Workbench page");
		expect(second.router.state.location.state).toEqual({
			openElement: { type: "collection", id: "c1" },
		});
	});

	it("opens an environment too when environments are on", async () => {
		const { router } = renderLink(
			{ [`GET ${ENVIRONMENT}`]: summary({ type: "environment", id: "e1" }) },
			{
				at: "/elements/environment/e1",
				flags: { ...FLAGS_ON, environments: true },
			},
		);
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
		expect(router.state.location.state).toEqual({
			openElement: { type: "environment", id: "e1" },
		});
	});

	it("says plainly that an environment can't open while environments are off", async () => {
		renderLink(
			{
				[`GET ${ENVIRONMENT}`]: summary({
					type: "environment",
					id: "e1",
					name: "Staging",
					role: "viewer",
				}),
			},
			{ at: "/elements/environment/e1" },
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Staging" }),
		).toBeInTheDocument();
		expect(byId("element-page-role")).toHaveTextContent("Your role: Viewer");
		expect(byId("element-page-note")).toHaveTextContent(
			"Environments aren't turned on in the API client yet",
		);
		expect(screen.queryByText("Workbench page")).toBeNull();
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
		expect(await screen.findByText("Workbench page")).toBeInTheDocument();
	});

	it("explains a link with an unknown item type", async () => {
		renderLink({}, { at: "/elements/folder/x1" });
		expect(
			await screen.findByRole("heading", { name: "This link isn't valid" }),
		).toBeInTheDocument();
	});
});
