import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ENV_PATH,
	byId,
	environment,
	renderEnvironments,
	variable,
} from "../environments/environments-test-utils";
import {
	ACTIVE_STAGING,
	kindOf,
	setAsVariable,
	typeUrl,
} from "./variable-assist-test-utils";

afterEach(() => vi.unstubAllGlobals());

const STAGING = {
	...ACTIVE_STAGING,
	[`GET ${ENV_PATH}`]: { body: environment() },
};

describe("variable assist from the keyboard", () => {
	it("opens the card with Shift+F10 and gives focus back on Escape", async () => {
		renderEnvironments(STAGING);
		const url = await typeUrl("{{baseUrl}}/users");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		url.focus();
		url.setSelectionRange(4, 4);
		fireEvent.keyDown(url, { key: "F10", shiftKey: true });
		const card = await waitFor(() => {
			const found = byId("var-tooltip");
			if (!found) throw new Error("no card");
			return found;
		});
		await waitFor(() => expect(card).toHaveFocus());
		expect(card).toHaveTextContent("https://staging.test");
		fireEvent.keyDown(card, { key: "Escape" });
		await waitFor(() => expect(byId("var-tooltip")).toBeNull());
		expect(url).toHaveFocus();
	});

	it("exposes the suggestions as a combobox and keeps Shift+Tab for focus", async () => {
		renderEnvironments(STAGING);
		const url = await typeUrl("{{baseUrl}}");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		expect(url).toHaveAttribute("role", "combobox");
		expect(url).toHaveAttribute("aria-expanded", "false");

		fireEvent.change(url, { target: { value: "x/{{" } });
		const list = await screen.findByRole("listbox", {
			name: "Variable suggestions",
		});
		const options = within(list).getAllByRole("option");
		await waitFor(() => expect(url).toHaveAttribute("aria-expanded", "true"));
		expect(url).toHaveAttribute("aria-controls", list.id);
		expect(url).toHaveAttribute("aria-activedescendant", options[0]?.id);
		fireEvent.keyDown(url, { key: "ArrowDown" });
		await waitFor(() =>
			expect(url).toHaveAttribute("aria-activedescendant", options[1]?.id),
		);

		fireEvent.keyDown(url, { key: "Tab", shiftKey: true });
		expect(url).toHaveValue("x/{{");
		fireEvent.keyDown(url, { key: "Escape" });
		await waitFor(() => expect(url).toHaveAttribute("aria-expanded", "false"));
		expect(url).not.toHaveAttribute("aria-activedescendant");
	});

	it("warns before replacing a shared value and resets the Editor's local value", async () => {
		const user = userEvent.setup();
		const withLocal = environment({
			variables: [variable("baseUrl", "https://staging.test")],
			localValues: [{ key: "baseUrl", value: "http://localhost:3000" }],
		});
		const { calls } = renderEnvironments({
			...ACTIVE_STAGING,
			[`GET ${ENV_PATH}`]: { body: withLocal },
			[`PUT ${ENV_PATH}/variables`]: { body: withLocal },
			[`PATCH ${ENV_PATH}/local-values`]: { body: { localValues: [] } },
		});
		const url = await typeUrl("https://qa.test/users");
		const modal = await setAsVariable(user, url, 0, 15);
		await user.type(
			within(modal).getByRole("textbox", { name: /Variable name/ }),
			"baseUrl",
		);
		const note = byId("modal-set-variable-existing");
		expect(note).toHaveTextContent(
			"baseUrl already exists here. Setting it replaces its shared value for everyone",
		);
		expect(note).toHaveTextContent("Your local value of it will be reset");
		await user.click(
			within(modal).getByRole("button", { name: "Set variable" }),
		);
		await waitFor(() =>
			expect(
				calls.some((call) => call.path === `${ENV_PATH}/local-values`),
			).toBe(true),
		);
		const order = calls
			.filter((call) => call.path.startsWith(ENV_PATH) && call.method !== "GET")
			.map((call) => call.method);
		expect(order).toEqual(["PUT", "PATCH"]);
		expect(
			calls.find((call) => call.path === `${ENV_PATH}/variables`)?.body,
		).toMatchObject({
			variables: [{ key: "baseUrl", sharedValue: "https://qa.test" }],
		});
	});
});
