import type { ResolverLayer, ScopeVariable } from "@localman/shared/api-client";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VariableCard } from "./variable-card";
import type { VariableKind } from "./variable-kinds";
import {
	type VariableTargets,
	scopeChoices,
	scopeTarget,
} from "./variable-targets";

const value = (
	key: string,
	text: string | null,
	extra: Partial<ScopeVariable> = {},
): ScopeVariable => ({
	key,
	value: text,
	enabled: true,
	secret: false,
	source: text === null ? "none" : "shared",
	withheld: false,
	...extra,
});

const LAYERS: ResolverLayer[] = [
	{ kind: "global", variables: [value("host", "global.test")] },
	{
		kind: "collection",
		label: "Shop",
		variables: [value("host", "shop.test", { enabled: false })],
	},
	{
		kind: "environment",
		label: "Staging",
		variables: [
			value("host", "staging.test"),
			value("token", "s3cret", { secret: true }),
			value("hidden", null, { secret: true, withheld: true }),
		],
	},
];

const EDITOR: VariableTargets = {
	workspaceId: "w1",
	environment: {
		id: "e1",
		name: "Staging",
		...scopeTarget(
			true,
			[{ key: "taken", enabled: false }],
			[{ key: "taken", value: "mine" }],
		),
	},
	collection: null,
	globals: scopeTarget(true, [], []),
};
const VIEWER: VariableTargets = {
	workspaceId: "w1",
	environment: { id: "e1", name: "Staging", ...scopeTarget(false, [], []) },
	collection: { id: "c1", name: "Shop", ...scopeTarget(false, [], []) },
	globals: scopeTarget(false, [], []),
};

function card(name: string, targets = EDITOR, kind?: VariableKind) {
	const apply = vi.fn(async () => undefined);
	const onDone = vi.fn();
	const openScope = vi.fn();
	render(
		<VariableCard
			name={name}
			kind={kind ?? (name === "missing" ? "undeclared" : "resolved")}
			layers={LAYERS}
			choices={scopeChoices(targets)}
			apply={apply}
			onDone={onDone}
			openScope={openScope}
		/>,
	);
	return { apply, onDone, openScope };
}

const byId = (id: string) => document.querySelectorAll(`[data-id="${id}"]`);

describe("VariableCard", () => {
	it("shows the value, the winning scope and overridden values struck through", () => {
		card("host");
		expect(byId("var-tooltip-current")[0]).toHaveTextContent("staging.test");
		expect(byId("var-tooltip-winner")[0]).toHaveTextContent(
			"Value from Environment · Staging",
		);
		const overridden = [...byId("var-tooltip-overridden")];
		expect(overridden.map((item) => item.textContent)).toEqual([
			"Globalglobal.test",
			"Collectionshop.test(disabled)",
		]);
		expect(overridden[0]?.querySelector("s")).toHaveTextContent("global.test");
	});

	it("masks a secret value", () => {
		card("token");
		expect(byId("var-tooltip-current")[0]).toHaveTextContent("••••••");
		expect(screen.queryByText("s3cret")).toBeNull();
	});

	it("says a withheld secret needs your own local value and opens its scope", async () => {
		const user = userEvent.setup();
		const { openScope } = card("hidden");
		expect(byId("var-tooltip-current")[0]).toHaveTextContent(
			"Hidden from you: set your own local value to use it",
		);
		await user.click(screen.getByRole("button", { name: "Open Staging" }));
		expect(openScope).toHaveBeenCalledWith("environment");
	});

	it("warns before Add to replaces an existing shared value", () => {
		card("taken", EDITOR, "undeclared");
		const note = byId("var-tooltip-existing")[0];
		expect(note).toHaveTextContent(
			"taken already exists here. Setting it replaces its shared value for everyone",
		);
		expect(note).toHaveTextContent("It is disabled and stays disabled");
		expect(note).toHaveTextContent("Your local value of it will be reset");
	});

	it("refuses to add a name the modal would refuse", () => {
		card("my var", EDITOR, "undeclared");
		expect(byId("var-tooltip-name-error")[0]).toHaveTextContent(
			"Use a name without spaces or braces",
		);
		expect(screen.queryByRole("button", { name: "Add variable" })).toBeNull();
	});

	it("offers Add to for an undeclared name, defaulting to the environment", async () => {
		const user = userEvent.setup();
		const { apply, onDone } = card("missing");
		expect(screen.getByText("Undeclared")).toBeInTheDocument();
		const scope = screen.getByRole("combobox", { name: "Add to" });
		expect(scope).toHaveValue("environment");
		await user.type(screen.getByRole("textbox", { name: "Value" }), "42");
		await user.click(screen.getByRole("button", { name: "Add variable" }));
		expect(apply).toHaveBeenCalledWith("environment", "missing", "42");
		expect(onDone).toHaveBeenCalled();
	});

	it("leaves a Viewer only the temporary scope, saying why", async () => {
		const user = userEvent.setup();
		const { apply } = card("missing", VIEWER);
		const scope = screen.getByRole("combobox", { name: "Add to" });
		expect(scope).toHaveValue("temporary");
		const options = within(scope).getAllByRole("option");
		expect(options.map((option) => option.hasAttribute("disabled"))).toEqual([
			true,
			true,
			true,
			false,
		]);
		expect(options[0]).toHaveTextContent(
			"Environment · Staging (Only Editors can change this scope)",
		);
		expect(
			screen.getByText("Viewers can add temporary variables only."),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Add variable" }));
		expect(apply).toHaveBeenCalledWith("temporary", "missing", "");
	});
});
