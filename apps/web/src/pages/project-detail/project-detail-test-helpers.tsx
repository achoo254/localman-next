import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import { makeProject, makeUser } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import type { Project } from "../projects/projects-api";
import { ProjectDetailPage } from "./project-detail-page";

export const PROJECT_ID = "p1";
export const RESOURCES_PATH = `/api/v1/projects/${PROJECT_ID}/resources`;

const ENDPOINTS = [
	{ method: "GET", path: "/:res" },
	{ method: "GET", path: "/:res/:id" },
	{ method: "POST", path: "/:res" },
	{ method: "PUT", path: "/:res/:id" },
	{ method: "DELETE", path: "/:res/:id" },
].map((endpoint) => ({ ...endpoint, enabled: true, response: "$mockData" }));

export interface ResourceJson {
	id: string;
	parentId: string | null;
	name: string;
	parentKey: string | null;
	count: number;
	[key: string]: unknown;
}

/** A resource as `GET …/resources` returns it. */
export function resourceJson(
	id: string,
	overrides: Partial<ResourceJson> = {},
): ResourceJson {
	return {
		id,
		projectId: PROJECT_ID,
		parentId: null,
		name: id,
		parentKey: null,
		schema: [{ name: "name", type: "Faker.js", fakerMethod: "name.fullName" }],
		template: null,
		endpoints: ENDPOINTS,
		count: 0,
		depth: 0,
		createdAt: "2026-10-09T01:00:00.000Z",
		updatedAt: "2026-10-09T01:00:00.000Z",
		...overrides,
	};
}

/** users (10 records) → posts → comments, and likes at the root. */
export function sampleTree(): ResourceJson[] {
	return [
		resourceJson("users", { count: 10 }),
		resourceJson("posts", { parentId: "users", parentKey: "userId", depth: 1 }),
		resourceJson("comments", {
			parentId: "posts",
			parentKey: "postId",
			depth: 2,
		}),
		resourceJson("likes"),
	];
}

export function change(name: string, countBefore: number, countAfter: number) {
	return { resourceId: name, name, countBefore, countAfter };
}

export function apiError(status: number, code: string, details?: unknown) {
	return { status, body: { error: { code, message: code, details } } };
}

export interface DetailRenderOptions {
	flags?: FeatureFlags;
	/** Initial location, e.g. with `?endpoint=mcp`. */
	path?: string;
}

/**
 * Renders `/projects/p1` (or `path`) with the user, the project and
 * `routes` mocked, under the given feature flags.
 */
export function renderDetail(
	routes: Record<string, MockRoute>,
	project: Project = makeProject(PROJECT_ID, {
		name: "Demo shop",
		prefix: "/api/v1",
		secret: "abc123",
		mockBaseUrl: "https://abc123.mock.localman.test/api/v1",
	}),
	{
		flags = NO_FEATURES,
		path = `/projects/${PROJECT_ID}`,
	}: DetailRenderOptions = {},
) {
	const api = mockFetch({
		"GET /api/v1/users/me": { body: makeUser() },
		// Another id than p1 leaves `GET /projects/p1` unmocked: a 404.
		[`GET /api/v1/projects/${project.id}`]: { body: project },
		...routes,
	});
	const view = renderRoutes(
		[
			{
				path: "/projects/:projectId",
				element: (
					<FeaturesContext value={flags}>
						<ProjectDetailPage />
					</FeaturesContext>
				),
			},
			{ path: "/projects", element: <p>Projects list</p> },
		],
		path,
	);
	return { ...api, ...view };
}

/** The card of a resource on the canvas. */
export async function findNode(name: string): Promise<HTMLElement> {
	const link = await screen.findByRole("link", { name });
	const node = link.closest<HTMLElement>(`[data-name="${name}"]`);
	if (!node) throw new Error(`no node for ${name}`);
	return node;
}

export function bar(node: HTMLElement): HTMLElement {
	return within(node).getByRole("slider");
}

/** Opens "New resource" from the endpoint card once the tree is shown. */
export async function openNewResource() {
	await findNode("users");
	await userEvent.click(screen.getByRole("button", { name: "Add resource" }));
	return screen.findByRole("dialog", { name: "New resource" });
}
