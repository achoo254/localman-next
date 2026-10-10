import { useLocation } from "react-router";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import type { Project } from "../../pages/projects/projects-api";
import { makeProject } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { RequestLogPanel } from "./request-log-panel";

export const PROJECT_ID = "p1";
export const LOGS_PATH = `/api/v1/projects/${PROJECT_ID}/request-logs`;
export const SETTINGS_PATH = `/api/v1/projects/${PROJECT_ID}/traffic-settings`;

export function logRow(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		at: "2026-10-10T03:04:05.000Z",
		method: "GET",
		path: `/users/${id}`,
		query: "",
		status: 200,
		ms: 12,
		source: "mock",
		requestSize: 0,
		responseSize: 40,
		...overrides,
	};
}

export function logLine(id: string, overrides: Record<string, unknown> = {}) {
	return {
		...logRow(id),
		request: {
			headers: [
				{ name: "Accept", value: "application/json" },
				{ name: "Authorization", value: "[redacted]" },
			],
			body: "",
			bodyEncoding: "utf8",
			size: 0,
			truncated: false,
		},
		response: {
			headers: [{ name: "X-Localman-Source", value: "mock" }],
			body: '{"id":"1","name":"An"}',
			bodyEncoding: "utf8",
			size: 22,
			truncated: false,
		},
		...overrides,
	};
}

export function settingsJson(overrides: Record<string, unknown> = {}) {
	return {
		upstream: { kind: "none" },
		tunnelUrl: null,
		redactHeaders: [],
		defaultRedactedHeaders: [
			"authorization",
			"cookie",
			"set-cookie",
			"x-api-key",
		],
		plan: "free",
		logDays: 7,
		canManage: true,
		...overrides,
	};
}

/** Shows where "Open in API Client" went and with which state. */
function ApiClientProbe() {
	const location = useLocation();
	return (
		<pre data-testid="api-client-state">{JSON.stringify(location.state)}</pre>
	);
}

export interface PanelRenderOptions {
	flags?: FeatureFlags;
	project?: Project;
	path?: string;
}

/** The request log panel at `/projects/p1` with the API stubbed by `routes`. */
export function renderLogPanel(
	routes: Record<string, MockRoute>,
	{
		flags = { ...NO_FEATURES, hybridMock: true, apiClient: true },
		project = makeProject(PROJECT_ID, {
			mockBaseUrl: "https://abc123.mock.localman.test",
		}),
		path = `/projects/${PROJECT_ID}`,
	}: PanelRenderOptions = {},
) {
	const api = mockFetch({
		[`GET ${SETTINGS_PATH}`]: { body: settingsJson() },
		...routes,
	});
	const view = renderRoutes(
		[
			{
				path: "/projects/:projectId",
				element: (
					<FeaturesContext value={flags}>
						<RequestLogPanel project={project} />
					</FeaturesContext>
				),
			},
			{ path: "/api-client", element: <ApiClientProbe /> },
		],
		path,
	);
	return { ...api, ...view };
}
