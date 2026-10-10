import { screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { type MockRoute, mockFetch } from "../../test/mock-fetch";
import { renderRoutes } from "../../test/render-app";
import { CallbacksEditor } from "./callbacks-editor";
import type { CallbacksController } from "./use-callbacks-editor";

export const BASE = "/api/v1/projects/p1/resources/r1/callbacks";
export const DEFAULT_TEMPLATE =
	'{"event":"{{event}}","resource":"{{resource}}","record":{{record}}}';

/** A callback as the API answers it; `overrides` replace whole fields. */
export function callbackJson(
	id: string,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		id,
		on: "create",
		target: { kind: "url", url: `https://hooks.example.com/${id}` },
		targetLabel: `https://hooks.example.com/${id}`,
		bodyTemplate: DEFAULT_TEMPLATE,
		headers: [],
		enabled: true,
		last: null,
		...overrides,
	};
}

export function callbacksJson(
	callbacks: Record<string, unknown>[],
	overrides: Record<string, unknown> = {},
) {
	return {
		callbacks,
		max: 10,
		defaultBodyTemplate: DEFAULT_TEMPLATE,
		canManage: true,
		...overrides,
	};
}

/**
 * The section with a "Save callbacks" button standing in for the resource
 * form's Update: it runs `controller.save()` and shows the outcome.
 */
function CallbacksHarness() {
	const controller = useRef<CallbacksController | null>(null);
	const [outcome, setOutcome] = useState("");
	return (
		<>
			<CallbacksEditor projectId="p1" resourceId="r1" controller={controller} />
			<button
				type="button"
				onClick={async () => {
					const result = await controller.current?.save();
					setOutcome(result?.status ?? "not loaded");
				}}
			>
				Save callbacks
			</button>
			<output data-testid="save-outcome">{outcome}</output>
		</>
	);
}

/** What the last "Save callbacks" of the harness came to. */
export const saveOutcome = (): HTMLElement =>
	screen.getByTestId("save-outcome");

/** The Callbacks section of resource r1 with its list and `routes` stubbed. */
export function renderCallbacks(
	data: Record<string, unknown>,
	routes: Record<string, MockRoute> = {},
) {
	const api = mockFetch({ [`GET ${BASE}`]: { body: data }, ...routes });
	const view = renderRoutes(
		[
			{
				path: "/",
				element: <CallbacksHarness />,
			},
		],
		"/",
	);
	return { ...api, ...view };
}

export const block = (n: number): HTMLElement => {
	const element = document.querySelector<HTMLElement>(
		`[data-id="resource-form-callback-${n}"]`,
	);
	if (!element) throw new Error(`no callback ${n}`);
	return element;
};
