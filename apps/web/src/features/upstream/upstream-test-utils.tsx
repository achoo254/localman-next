import { FeaturesContext, NO_FEATURES } from "../../config/features";
import { makeProject } from "../../test/fixtures";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { settingsJson } from "../request-log/request-log-test-utils";
import { UpstreamSettings } from "./upstream-settings";

export const BASE = "/api/v1/projects/p1";

/** The Upstream panel of project p1 with its settings and `routes` stubbed. */
export function renderUpstream(
	settings: Record<string, unknown>,
	routes: Record<string, MockRoute> = {},
) {
	const api = mockFetch({
		[`GET ${BASE}/traffic-settings`]: { body: settingsJson(settings) },
		...routes,
	});
	const project = makeProject("p1", {
		mockBaseUrl: "https://abc123.mock.localman.test",
	});
	const view = renderRoutes(
		[
			{
				path: "/projects/:projectId",
				element: (
					<FeaturesContext
						value={{ ...NO_FEATURES, hybridMock: true, apiClient: true }}
					>
						<UpstreamSettings project={project} />
					</FeaturesContext>
				),
			},
		],
		"/projects/p1",
	);
	return { ...api, ...view };
}
