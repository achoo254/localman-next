// Copied from chat-next/packages/brand @a5be0b4; keep in sync until shared package exists.
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { BrandConfig } from "./brand-config.js";

export const REPO_ROOT = new URL("../../../", import.meta.url);

function readJson(url: URL): unknown {
	return JSON.parse(readFileSync(url, "utf8"));
}

function isSchema(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates `value` against the schema at the repository root and returns
 * it typed, or throws with every schema violation listed.
 */
export function parseBrandConfig(value: unknown): BrandConfig {
	const schema = readJson(new URL("brand.config.schema.json", REPO_ROOT));
	if (!isSchema(schema)) {
		throw new Error("brand.config.schema.json is not a JSON object");
	}
	const ajv = new Ajv2020({ allErrors: true, strict: true });
	const validate = ajv.compile<BrandConfig>(schema);
	if (!validate(value)) {
		const details = (validate.errors ?? [])
			.map((error) => `${error.instancePath || "/"} ${error.message ?? ""}`)
			.join("; ");
		throw new Error(`brand.config.json is invalid: ${details}`);
	}
	return value;
}

/** Reads and validates brand.config.json at the repository root. */
export function loadBrandConfig(): BrandConfig {
	return parseBrandConfig(readJson(new URL("brand.config.json", REPO_ROOT)));
}
