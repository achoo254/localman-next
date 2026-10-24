/**
 * TEST ONLY. An environment "Staging" (e1) with `baseUrl` and the secret
 * `token`, the vault and "Let agents use" served by `mockFetch`.
 */
import type { VariableView } from "@localman/shared/api-client";
import { screen } from "@testing-library/react";
import type { FetchCall } from "../../../test/mock-fetch";
import {
	ENV_FLAGS,
	ENV_PATH,
	LIST,
	environment,
	renderEnvironments,
	summary,
	variable,
} from "../../environments/environments-test-utils";

export const FLAGS = { ...ENV_FLAGS, secretVault: true };
export const VAULT_PATH = "/api/v1/users/me/secret-vault";
export const USES = "/api/v1/agent-secret-uses/environment/e1";
export const LOCAL = `${ENV_PATH}/local-values`;
export const LOCKED_PARAMS = {
	salt: "A".repeat(22),
	iterations: 600_000,
	check: `lmv1:${"B".repeat(60)}`,
};

/** A host the server refuses as one of its own, when set. */
export const agentServer = { refuse: "" };

export type Body = { hosts?: string[]; values?: Record<string, unknown>[] };
export const bodyOf = (call: FetchCall | undefined): Body =>
	(call?.body ?? {}) as Body;
export const sent = (calls: FetchCall[], method: string, path: string) =>
	calls.filter((call) => call.method === method && call.path === path);

const VARIABLES: VariableView[] = [
	variable("baseUrl", "https://staging.test/v1"),
	variable("token", "s3cret", { type: "secret" }),
];

export function renderStaging(
	localValues: { key: string; value: string; agentUse?: boolean }[],
	vault: unknown,
	uses: { key: string; hosts: string[] }[] = [],
	variables: VariableView[] = VARIABLES,
) {
	return renderEnvironments(
		{
			[`GET ${LIST}`]: { body: { items: [summary()] } },
			[`GET ${ENV_PATH}`]: {
				body: environment({ variables, localValues }),
			},
			[`PUT ${ENV_PATH}/variables`]: ({ body }) => ({
				body: environment({
					variables: (
						(body as { variables: Omit<VariableView, "id">[] }).variables ?? []
					).map((entry) => variable(entry.key, entry.sharedValue, entry)),
					localValues,
				}),
			}),
			[`GET ${VAULT_PATH}`]: { body: { vault } },
			[`GET ${USES}`]: { body: { uses } },
			[`PUT ${USES}/token`]: ({ body }) =>
				agentServer.refuse
					? {
							status: 400,
							body: {
								error: {
									code: "AGENT_HOST_NOT_ALLOWED",
									message: "no",
									details: { hosts: agentServer.refuse },
								},
							},
						}
					: { body: { key: "token", hosts: (body as Body).hosts } },
			[`DELETE ${USES}/token`]: { body: { removed: true } },
			[`PATCH ${LOCAL}`]: ({ body }) => ({
				body: {
					localValues: ((body as Body).values ?? []).map((value) => ({
						key: value.key,
						value: value.value,
						agentUse: typeof value.agentValue === "string",
					})),
				},
			}),
		},
		{ flags: FLAGS },
	);
}

export const toggle = (name: string) =>
	screen.findByRole("button", { name: new RegExp(`^Let agents use ${name}`) });
export const hostsBox = () =>
	screen.getByRole("textbox", { name: /Allowed hosts/ });
