/**
 * Parsers of the environments and globals API answers: every field goes
 * through the JSON guards, enums through the shared lists.
 */
import {
	type ActiveEnvironment,
	ENVIRONMENT_COLORS,
	type EnvironmentColor,
	type EnvironmentDetail,
	type EnvironmentSummary,
	type GlobalsDetail,
	type LocalValue,
	VARIABLE_TYPES,
	type VariableType,
	type VariableView,
} from "@localman/shared/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { parseElementRole } from "../sharing/sharing-api";

function parseColor(value: string): EnvironmentColor {
	const color = ENVIRONMENT_COLORS.find((item) => item === value);
	if (!color) throw new InvalidResponseError("environment color");
	return color;
}

function parseType(value: string): VariableType {
	const type = VARIABLE_TYPES.find((item) => item === value);
	if (!type) throw new InvalidResponseError("variable type");
	return type;
}

function parseVariable(value: unknown): VariableView {
	const data = expectRecord(value, "variable");
	return {
		id: expectString(data, "id"),
		key: expectString(data, "key"),
		type: parseType(expectString(data, "type")),
		enabled: expectBoolean(data, "enabled"),
		description: expectString(data, "description"),
		sharedValue: optionalString(data, "sharedValue"),
		sharedHidden: expectBoolean(data, "sharedHidden"),
	};
}

export function parseLocalValues(value: unknown): LocalValue[] {
	if (!Array.isArray(value)) throw new InvalidResponseError("local values");
	return value.map((item) => {
		const data = expectRecord(item, "local value");
		const entry = {
			key: expectString(data, "key"),
			value: expectString(data, "value"),
		};
		// The server keeps a copy for agents (ADR-0009): a new value of it
		// must carry the copy again, or the server drops it.
		return data.agentUse === true ? { ...entry, agentUse: true } : entry;
	});
}

export function parseEnvironmentSummary(value: unknown): EnvironmentSummary {
	const data = expectRecord(value, "environment");
	return {
		id: expectString(data, "id"),
		workspaceId: expectString(data, "workspaceId"),
		name: expectString(data, "name"),
		color: parseColor(expectString(data, "color")),
		role: parseElementRole(data.role, "role"),
		variableCount: expectNumber(data, "variableCount"),
		updatedAt: expectString(data, "updatedAt"),
	};
}

export function parseEnvironmentDetail(value: unknown): EnvironmentDetail {
	const data = expectRecord(value, "environment");
	return {
		...parseEnvironmentSummary(data),
		variables: expectArray(data, "variables").map(parseVariable),
		localValues: parseLocalValues(data.localValues),
		createdBy: expectString(data, "createdBy"),
		// A removed account has no name; an older API sends none.
		createdByName:
			typeof data.createdByName === "string" ? data.createdByName : null,
		createdAt: expectString(data, "createdAt"),
	};
}

/** An exported environment: the file's JSON and the name to save it as. */
export interface EnvironmentFile {
	fileName: string;
	environment: JsonRecord;
}

/** The file name is a plain `.json` name, never a path. */
export function parseEnvironmentFile(value: unknown): EnvironmentFile {
	const data = expectRecord(value, "environment file");
	const fileName = expectString(data, "fileName").trim();
	if (!/^[^/\\]+\.json$/i.test(fileName)) {
		throw new InvalidResponseError("fileName");
	}
	return {
		fileName,
		environment: expectRecord(data.environment, "environment"),
	};
}

export function parseGlobals(value: unknown): GlobalsDetail {
	const data = expectRecord(value, "globals");
	return {
		workspaceId: expectString(data, "workspaceId"),
		role: parseElementRole(data.role, "role"),
		variables: expectArray(data, "variables").map(parseVariable),
		localValues: parseLocalValues(data.localValues),
		updatedAt: optionalString(data, "updatedAt"),
	};
}

export function parseActiveEnvironment(value: unknown): ActiveEnvironment {
	const data = expectRecord(value, "active environment");
	return {
		workspaceId: expectString(data, "workspaceId"),
		environmentId: optionalString(data, "environmentId"),
	};
}

/** A collection using the environment: linked to it, or shared with it. */
export interface EnvironmentCollection {
	id: string;
	name: string;
	source: "linked" | "shared";
}

export function parseEnvironmentCollection(
	value: unknown,
): EnvironmentCollection {
	const data = expectRecord(value, "environment collection");
	const source = data.source;
	if (source !== "linked" && source !== "shared") {
		throw new InvalidResponseError("source");
	}
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		source,
	};
}
