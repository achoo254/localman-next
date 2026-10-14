/**
 * "Run in Localman" buttons: managed in the Share dialog, previewed and
 * imported on `/run/:buttonId`. Calls of the Run page never send the
 * visitor to sign in (the page asks first).
 */
import {
	RUN_BUTTON_VISIBILITIES,
	type RunButtonVisibility,
	type ScriptLocation,
	type SecretLikeValue,
} from "@localman/shared/api-client";
import { apiRequest, withDryRun } from "../../lib/api-client";
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
import {
	nullableRecord,
	parseStringList,
	parseWarnings,
} from "./public-sharing-parsers";

export interface RunButton {
	id: string;
	visibility: RunButtonVisibility;
	environmentId: string | null;
	/** Absolute URL of the import page. */
	url: string;
	/** Absolute URL of the badge image. */
	badgeUrl: string;
	createdBy: string;
	createdAt: string;
}

export interface CreateRunButtonInput {
	visibility: RunButtonVisibility;
	environmentId: string | null;
}

export interface CreateRunButtonResult {
	dryRun: boolean;
	button: RunButton | null;
	warnings: SecretLikeValue[];
}

export interface RunButtonPreview {
	name: string;
	description: string;
	requestCount: number;
	visibility: RunButtonVisibility;
	environmentName: string | null;
	environmentUnavailable: boolean;
	scripts: ScriptLocation[];
}

export interface RunButtonImportInput {
	buttonId: string;
	workspaceId: string;
	includeScripts: boolean;
	idempotencyKey: string;
}

export interface RunButtonImportResult {
	workspaceId: string;
	collectionId: string | null;
	environmentId: string | null;
	environmentError: { code: string; message: string } | null;
}

const buttonsPath = (collectionId: string) =>
	`/api/v1/collections/${encodeURIComponent(collectionId)}/run-buttons`;

function parseVisibility(value: unknown): RunButtonVisibility {
	const visibility = RUN_BUTTON_VISIBILITIES.find((v) => v === value);
	if (!visibility) throw new InvalidResponseError("visibility");
	return visibility;
}

function parseButton(value: unknown): RunButton {
	const data: JsonRecord = expectRecord(value, "run button");
	return {
		id: expectString(data, "id"),
		visibility: parseVisibility(data.visibility),
		environmentId: optionalString(data, "environmentId"),
		url: expectString(data, "url"),
		badgeUrl: expectString(data, "badgeUrl"),
		createdBy: expectString(data, "createdBy"),
		createdAt: expectString(data, "createdAt"),
	};
}

function parseScript(value: unknown): ScriptLocation {
	const data = expectRecord(value, "script");
	if (data.phase !== "pre" && data.phase !== "post") {
		throw new InvalidResponseError("script phase");
	}
	return { path: parseStringList(data.path, "script path"), phase: data.phase };
}

export async function fetchRunButtons(
	collectionId: string,
): Promise<RunButton[]> {
	const data = expectRecord(
		await apiRequest(buttonsPath(collectionId)),
		"run buttons",
	);
	return expectArray(data, "items").map(parseButton);
}

export async function createRunButton(
	collectionId: string,
	input: CreateRunButtonInput,
	dryRun: boolean,
): Promise<CreateRunButtonResult> {
	const data = expectRecord(
		await apiRequest(withDryRun(buttonsPath(collectionId), dryRun), {
			method: "POST",
			body: input,
		}),
		"run button",
	);
	const button = nullableRecord(data, "button");
	return {
		dryRun: expectBoolean(data, "dryRun"),
		button: button ? parseButton(button) : null,
		warnings: parseWarnings(data),
	};
}

export async function deleteRunButton(
	collectionId: string,
	buttonId: string,
): Promise<void> {
	await apiRequest(
		`${buttonsPath(collectionId)}/${encodeURIComponent(buttonId)}`,
		{ method: "DELETE" },
	);
}

export async function previewRunButton(
	buttonId: string,
): Promise<RunButtonPreview> {
	const data = expectRecord(
		await apiRequest("/api/v1/run-buttons/preview", {
			method: "POST",
			body: { buttonId },
			redirectOnUnauthorized: false,
		}),
		"run button preview",
	);
	return {
		name: expectString(data, "name"),
		description: expectString(data, "description"),
		requestCount: expectNumber(data, "requestCount"),
		visibility: parseVisibility(data.visibility),
		environmentName: optionalString(data, "environmentName"),
		environmentUnavailable: expectBoolean(data, "environmentUnavailable"),
		scripts: expectArray(data, "scripts").map(parseScript),
	};
}

export async function importRunButton(
	input: RunButtonImportInput,
): Promise<RunButtonImportResult> {
	const data = expectRecord(
		await apiRequest("/api/v1/run-buttons/import", {
			method: "POST",
			body: input,
			redirectOnUnauthorized: false,
		}),
		"run button import",
	);
	const envError = nullableRecord(data, "environmentError");
	return {
		workspaceId: expectString(data, "workspaceId"),
		collectionId: optionalString(data, "collectionId"),
		environmentId: optionalString(data, "environmentId"),
		environmentError: envError
			? {
					code: expectString(envError, "code"),
					message: expectString(envError, "message"),
				}
			: null,
	};
}

/** What a README embeds: the badge linking to the import page. */
export function embedCodes(button: Pick<RunButton, "url" | "badgeUrl">) {
	return {
		html: `<a href="${button.url}"><img src="${button.badgeUrl}" alt="Run in Localman"></a>`,
		markdown: `[![Run in Localman](${button.badgeUrl})](${button.url})`,
	};
}
