import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadText } from "../../platform/download";
import {
	ENV_PATH,
	LIST,
	byId,
	environment,
	openStaging,
	renderEnvironments,
	summary,
} from "./environments-test-utils";

vi.mock("../../platform/download", () => ({ downloadText: vi.fn() }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(downloadText).mockClear();
});

const IMPORT = `${LIST}/import`;
const FILE = {
	id: "e1",
	name: "Staging",
	values: [
		{
			key: "baseUrl",
			value: "https://staging.test",
			type: "default",
			enabled: true,
		},
	],
	_postman_variable_scope: "environment",
};

const importInput = (): HTMLInputElement => {
	const input = byId("sidebar-envs-import-file");
	if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
	return input;
};

const jsonFile = (text: string, name = "staging.json") =>
	new File([text], name, { type: "application/json" });

describe("environment import", () => {
	it("imports a file, opens the new environment and caches it", async () => {
		const user = userEvent.setup();
		const imported = environment({ id: "e9", name: "Imported" });
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`POST ${IMPORT}`]: { status: 201, body: imported },
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await screen.findByRole("button", { name: "Import environment" });
		await user.upload(importInput(), jsonFile(JSON.stringify(FILE)));
		expect(
			await screen.findByRole("table", { name: "Variables of Imported" }),
		).toBeVisible();
		const post = calls.find((c) => c.method === "POST" && c.path === IMPORT);
		expect(post?.body).toEqual({ environment: FILE });
		// The tab reads the cached detail: no fetch of the new environment.
		expect(calls.some((c) => c.path === "/api/v1/environments/e9")).toBe(false);
		expect(await screen.findByText("Imported Imported.")).toBeVisible();
	});

	it("shows the server's message for an invalid environment file", async () => {
		const user = userEvent.setup();
		renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
			[`POST ${IMPORT}`]: {
				status: 400,
				body: {
					error: {
						code: "INVALID_ENVIRONMENT_FILE",
						message: "Variable 1 has no key",
					},
				},
			},
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await screen.findByRole("button", { name: "Import environment" });
		await user.upload(importInput(), jsonFile('{"values":[{}]}'));
		expect(
			await screen.findByText("We couldn't import the environment."),
		).toBeVisible();
		expect(screen.getByText("Variable 1 has no key")).toBeVisible();
	});

	it("refuses a file over 10 MB before reading or sending it", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await screen.findByRole("button", { name: "Import environment" });
		const big = jsonFile("{}");
		Object.defineProperty(big, "size", { value: 10 * 1024 * 1024 + 1 });
		await user.upload(importInput(), big);
		expect(
			await screen.findByText("That file is larger than 10 MB."),
		).toBeVisible();
		expect(calls.some((c) => c.path === IMPORT)).toBe(false);
	});

	it("refuses a file that is not JSON before sending it", async () => {
		const user = userEvent.setup();
		const { calls } = renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [] } },
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		await screen.findByRole("button", { name: "Import environment" });
		await user.upload(importInput(), jsonFile("baseUrl=https://x.test"));
		expect(
			await screen.findByText(
				"That file isn't valid JSON. Pick an environment file (.json).",
			),
		).toBeVisible();
		expect(calls.some((c) => c.path === IMPORT)).toBe(false);
	});

	it("keeps Import off for a Viewer of the workspace", async () => {
		renderEnvironments(
			{ [`GET ${LIST}`]: { body: { items: [] } } },
			{ role: "viewer" },
		);
		await userEvent
			.setup()
			.click(await screen.findByRole("button", { name: "Envs" }));
		expect(
			await screen.findByRole("button", { name: "Import environment" }),
		).toBeDisabled();
	});
});

describe("environment export", () => {
	it("downloads the file under the name the API gives", async () => {
		const user = userEvent.setup();
		renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: { body: environment() },
			[`GET ${ENV_PATH}/export`]: {
				body: {
					fileName: "Staging.postman_environment.json",
					environment: FILE,
				},
			},
		});
		await openStaging(user);
		const more = byId("environment-header-more");
		if (!more) throw new Error("no More button");
		await user.click(more);
		await user.click(await screen.findByRole("menuitem", { name: "Export" }));
		await waitFor(() => expect(downloadText).toHaveBeenCalledTimes(1));
		const [name, text, type] = vi.mocked(downloadText).mock.calls[0] ?? [];
		expect(name).toBe("Staging.postman_environment.json");
		expect(JSON.parse(text ?? "")).toEqual(FILE);
		expect(type).toBe("application/json;charset=utf-8");
	});

	it("reports a failed export without downloading", async () => {
		const user = userEvent.setup();
		renderEnvironments({
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}/export`]: {
				status: 500,
				body: { error: { code: "INTERNAL", message: "Something broke" } },
			},
		});
		await user.click(await screen.findByRole("button", { name: "Envs" }));
		const row = await screen.findByRole("button", {
			name: "More actions for Staging",
		});
		await user.click(row);
		await user.click(await screen.findByRole("menuitem", { name: "Export" }));
		expect(
			await screen.findByText("We couldn't export Staging."),
		).toBeVisible();
		expect(downloadText).not.toHaveBeenCalled();
	});
});
