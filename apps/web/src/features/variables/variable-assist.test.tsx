import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EMPTY_GLOBALS,
	ENV_PATH,
	GLOBALS,
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

describe("variable assist in the request editor", () => {
	it("colours references and shows the value and scope on hover", async () => {
		renderEnvironments({
			...ACTIVE_STAGING,
			[`GET ${ENV_PATH}`]: { body: environment() },
		});
		const url = await typeUrl("{{baseUrl}}/users?q={{missing}}");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		expect(kindOf("missing")).toBe("undeclared");

		// jsdom lays nothing out: every mark sits at (0, 0), the first one wins.
		fireEvent.mouseMove(url, { clientX: 0, clientY: 0 });
		const card = await waitFor(() => {
			const found = byId("var-tooltip");
			if (!found) throw new Error("no card");
			return found;
		});
		expect(within(card).getByText("https://staging.test")).toBeInTheDocument();
		expect(card).toHaveTextContent("Value from Environment · Staging");
	});

	it("suggests declared and dynamic names after {{ and completes with Enter", async () => {
		renderEnvironments({
			...ACTIVE_STAGING,
			[`GET ${ENV_PATH}`]: { body: environment() },
		});
		const url = await typeUrl("{{baseUrl}}");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		fireEvent.change(url, { target: { value: "https://x.test/{{ba" } });
		const list = await screen.findByRole("listbox", {
			name: "Variable suggestions",
		});
		expect(within(list).getAllByRole("option")[0]).toHaveTextContent("baseUrl");
		fireEvent.keyDown(url, { key: "Enter" });
		await waitFor(() => expect(url).toHaveValue("https://x.test/{{baseUrl}}"));
		expect(screen.queryByRole("listbox")).toBeNull();
	});

	it("lets an Editor set a selection as a shared environment variable", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			...ACTIVE_STAGING,
			[`GET ${ENV_PATH}`]: { body: environment() },
			[`PUT ${ENV_PATH}/variables`]: {
				body: environment({
					variables: [
						variable("baseUrl", "https://staging.test"),
						variable("token", "s3cret", { type: "secret" }),
						variable("path", "/users"),
					],
				}),
			},
		});
		const url = await typeUrl("{{baseUrl}}/users");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		const modal = await setAsVariable(user, url, 11, 17);
		expect(within(modal).getByRole("textbox", { name: "Value" })).toHaveValue(
			"/users",
		);
		expect(
			within(modal).getByRole("radio", { name: /Environment · Staging/ }),
		).toBeChecked();
		await user.type(
			within(modal).getByRole("textbox", { name: /Variable name/ }),
			"path",
		);
		await user.click(
			within(modal).getByRole("button", { name: "Set variable" }),
		);

		await waitFor(() =>
			expect(calls.some((call) => call.path === `${ENV_PATH}/variables`)).toBe(
				true,
			),
		);
		const put = calls.find((call) => call.path === `${ENV_PATH}/variables`);
		expect(put?.body).toEqual({
			variables: [
				{
					id: "v-baseUrl",
					key: "baseUrl",
					type: "default",
					enabled: true,
					description: "",
					sharedValue: "https://staging.test",
				},
				{
					id: "v-token",
					key: "token",
					type: "secret",
					enabled: true,
					description: "",
					sharedValue: "s3cret",
				},
				{
					key: "path",
					type: "default",
					enabled: true,
					description: "",
					sharedValue: "/users",
				},
			],
		});
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Set as variable" }),
			).toBeNull(),
		);
	});

	it("leaves a Viewer only temporary variables, which resolve in the tab", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			...ACTIVE_STAGING,
			[`GET ${ENV_PATH}`]: { body: environment({ role: "viewer" }) },
			[`GET ${GLOBALS}`]: { body: { ...EMPTY_GLOBALS, role: "viewer" } },
		});
		const url = await typeUrl("{{baseUrl}}/users/{{id}}");
		await waitFor(() => expect(kindOf("baseUrl")).toBe("resolved"));
		expect(kindOf("id")).toBe("undeclared");
		const modal = await setAsVariable(user, url, 11, 17);
		const radio = (name: RegExp) => within(modal).getByRole("radio", { name });
		expect(radio(/Environment · Staging/)).toBeDisabled();
		expect(radio(/^Collection/)).toBeDisabled();
		expect(radio(/^Globals/)).toBeDisabled();
		expect(radio(/^Temporary/)).toBeChecked();
		expect(modal).toHaveTextContent("Only Editors can change this scope");
		await user.type(
			within(modal).getByRole("textbox", { name: /Variable name/ }),
			"id",
		);
		await user.click(
			within(modal).getByRole("button", { name: "Set variable" }),
		);

		await waitFor(() => expect(kindOf("id")).toBe("resolved"));
		const writes = calls.filter(
			(call) =>
				call.method !== "GET" && !call.path.startsWith("/api/v1/client/"),
		);
		expect(writes).toEqual([]);
	});
});
