import { OperationError } from "@localman/operations";
import {
	ENVIRONMENT_NAME_MAX,
	ENVIRONMENT_VARIABLES_MAX,
	type EnvironmentDetail,
	type PostmanEnvironmentFile,
	type PostmanEnvironmentIssue,
	VARIABLE_KEY_MAX,
	VARIABLE_VALUE_MAX,
	type VariableInput,
	importedSharedValue,
	parsePostmanEnvironment,
	postmanEnvironmentFileName,
	toPostmanEnvironment,
} from "@localman/shared/api-client";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { createEnvironment, getEnvironment } from "./environment-service.js";

const ISSUE_MESSAGES: Readonly<Record<PostmanEnvironmentIssue, string>> = {
	not_an_environment:
		"The file is not a Postman environment (an object with a `values` array)",
	invalid_variable:
		"A variable is malformed: it needs a string `key` and a text `value`",
	too_many_variables: `An environment holds at most ${ENVIRONMENT_VARIABLES_MAX} variables`,
	empty_key: "A variable has an empty name",
	key_too_long: `A variable name is longer than ${VARIABLE_KEY_MAX} characters`,
	duplicate_key: "Two variables have the same name",
	value_too_long: `A variable value is longer than ${VARIABLE_VALUE_MAX} characters`,
	name_too_long: `The environment name is longer than ${ENVIRONMENT_NAME_MAX} characters`,
};

function invalidFile(
	message: string,
	details: Readonly<Record<string, string | number>>,
): OperationError {
	return new OperationError(400, "INVALID_ENVIRONMENT_FILE", message, details);
}

/**
 * The environment as a Postman file, for any role that can view it. Built
 * from what the caller may read, then stripped to shared values: secrets
 * are blank whoever asks, local values are never part of it.
 */
export async function exportEnvironment(
	sub: string,
	environmentId: string,
): Promise<{ fileName: string; environment: PostmanEnvironmentFile }> {
	const detail = await getEnvironment(sub, environmentId);
	return {
		fileName: postmanEnvironmentFileName(detail.name),
		environment: toPostmanEnvironment(detail, new Date()),
	};
}

export interface EnvironmentImport {
	readonly file: unknown;
	/** Replaces the file's name when given. */
	readonly name?: string;
}

/**
 * Creates an environment from a Postman file, as `createEnvironment` would
 * (same role, limit and encryption of secrets). The role is checked before
 * the file, so someone who may not create learns nothing about it.
 */
export async function importEnvironment(
	sub: string,
	workspaceId: string,
	input: EnvironmentImport,
): Promise<EnvironmentDetail> {
	await requireWorkspace(sub, "addElements", workspaceId);
	const parsed = parsePostmanEnvironment(input.file);
	if (!parsed.ok) {
		const { issue, index } = parsed;
		const where = index === undefined ? "" : ` (variable ${index + 1})`;
		throw invalidFile(`${ISSUE_MESSAGES[issue]}${where}`, {
			issue,
			...(index === undefined ? {} : { index }),
		});
	}
	const name = input.name ?? parsed.name;
	if (!name) {
		throw invalidFile("The file has no environment name; send `name`", {
			issue: "missing_name",
		});
	}
	const variables = parsed.variables.map(
		(variable): VariableInput => ({
			key: variable.key,
			type: variable.type,
			enabled: variable.enabled,
			description: "",
			sharedValue: importedSharedValue(variable),
		}),
	);
	return createEnvironment(sub, workspaceId, { name, variables });
}
