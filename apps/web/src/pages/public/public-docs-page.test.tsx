import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FEATURES } from "../../config/features";
import { resetCurrentUserCache } from "../../features/auth/use-current-user";
import {
	apiError,
	byId,
	renderPage,
} from "../../features/public-sharing/public-sharing-test-helpers";
import { UNAUTHENTICATED } from "../../test/mock-fetch";
import { PublicDocsPage } from "./public-docs-page";

const DOCS = "GET /api/v1/public/docs/slug_1";
const FLAGS = { ...NO_FEATURES, projectDocs: true };

function renderDocs(routes: Parameters<typeof renderPage>[0], flags = FLAGS) {
	return renderPage(
		{ "GET /api/v1/users/me": UNAUTHENTICATED, ...routes },
		{
			path: "/p/:slug/docs",
			at: "/p/slug_1/docs",
			element: <PublicDocsPage />,
			flags,
		},
	);
}

const docs = {
	name: "Shop",
	version: "v1",
	resources: [
		{
			name: "users",
			depth: 0,
			fields: [
				{ name: "name", type: "String", detail: null },
				{ name: "email", type: "Faker.js", detail: "internet.email" },
			],
			endpoints: [
				{ method: "GET", path: "/users" },
				{ method: "GET", path: "/users/{id}" },
			],
			example: { id: "1", name: "", email: "" },
		},
	],
};

describe("/p/:slug/docs", () => {
	beforeEach(() => resetCurrentUserCache());
	afterEach(() => vi.unstubAllGlobals());

	it("goes home while the flag is off", async () => {
		const { calls } = renderDocs({}, NO_FEATURES);
		expect(await screen.findByText("Home page")).toBeInTheDocument();
		expect(calls.some((c) => c.path.includes("/public/docs"))).toBe(false);
	});

	it("shows every resource with its endpoints, fields and example", async () => {
		renderDocs({ [DOCS]: { body: docs } });
		expect(
			await screen.findByRole("heading", { name: "Shop", level: 1 }),
		).toBeInTheDocument();
		const users = await screen.findByRole("region", { name: "users" });
		expect(within(users).getByText("{baseUrl}/users/{id}")).toBeInTheDocument();
		expect(within(users).getByText("internet.email")).toBeInTheDocument();
		expect(within(users).getByText(/"email": ""/)).toBeInTheDocument();
	});

	it("says the docs are not published for an unknown link", async () => {
		renderDocs({ [DOCS]: apiError(404, "DOCS_NOT_FOUND") });
		expect(
			await screen.findByText("These docs are not published"),
		).toBeInTheDocument();
		expect(byId("public-view-not-found")).not.toBeNull();
	});
});
