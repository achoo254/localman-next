import type { ReactNode } from "react";
import {
	type FeatureFlags,
	FeaturesContext,
	NO_FEATURES,
} from "../../config/features";
import { renderRoutes } from "../../test/render-app";

export const ALL_FEATURES: FeatureFlags = Object.freeze({
	apiClient: true,
	liveMockSync: true,
	mockMcp: true,
	directMode: true,
	hybridMock: true,
});

/** Renders `element` at `/` under the app providers and the given flags. */
export function renderWithFeatures(
	element: ReactNode,
	flags: FeatureFlags = NO_FEATURES,
) {
	return renderRoutes(
		[
			{
				path: "*",
				element: <FeaturesContext value={flags}>{element}</FeaturesContext>,
			},
		],
		"/",
	);
}

/** Visible text of the `data-id` element's list items, in order. */
export function itemsOf(container: HTMLElement, dataId: string): string[] {
	const root = container.querySelector(`[data-id="${dataId}"]`);
	if (!root) throw new Error(`no [data-id="${dataId}"]`);
	return [...root.querySelectorAll("li")].map((li) => li.textContent ?? "");
}
