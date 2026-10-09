import {
	PROJECT_NAME_MAX,
	PROJECT_PREFIX_MAX,
	normalizePrefix,
	projectNameSchema,
	projectPrefixSchema,
} from "@localman/shared";
import type { Translate } from "../../i18n/translate";
import type { ProjectInput } from "./projects-api";

export interface ProjectFormErrors {
	name?: string;
	prefix?: string;
}

function nameError(name: string, t: Translate): string | undefined {
	const result = projectNameSchema.safeParse(name);
	if (result.success) return undefined;
	const issue = result.error.issues[0];
	if (issue?.code === "too_small") return t("projects.validation.nameRequired");
	if (issue?.code === "too_big") {
		return t("projects.validation.nameTooLong", { max: PROJECT_NAME_MAX });
	}
	if (!/^[\p{L}\p{N}]/u.test(name.trim())) {
		return t("projects.validation.nameStart");
	}
	return t("projects.validation.namePattern");
}

function prefixError(prefix: string, t: Translate): string | undefined {
	const result = projectPrefixSchema.safeParse(prefix);
	if (result.success) return undefined;
	if (result.error.issues[0]?.code === "too_big") {
		return t("projects.validation.prefixTooLong", { max: PROJECT_PREFIX_MAX });
	}
	return t("projects.validation.prefixPattern");
}

/**
 * Validates with the API's shared schemas. Returns the body to send (name
 * trimmed, prefix normalized to `/x/y`) or field errors in the language of `t`.
 */
export function validateProject(
	name: string,
	prefix: string,
	t: Translate,
): { input: ProjectInput | null; errors: ProjectFormErrors } {
	const errors: ProjectFormErrors = {
		name: nameError(name, t),
		prefix: prefixError(prefix, t),
	};
	if (errors.name || errors.prefix) return { input: null, errors };
	return {
		input: {
			name: name.trim().normalize("NFC"),
			prefix: normalizePrefix(prefix),
		},
		errors: {},
	};
}

/**
 * Preview of the mock URL. The secret of a new project is only known after
 * saving, so the host is taken from another project with the secret masked.
 */
export function mockUrlPreview(
	baseUrl: string | null,
	currentPrefix: string,
	prefix: string,
): string {
	const path = `${normalizePrefix(prefix)}/:endpoint`;
	if (!baseUrl) return `https://‹secret›…${path}`;
	const base =
		currentPrefix && baseUrl.endsWith(currentPrefix)
			? baseUrl.slice(0, -currentPrefix.length)
			: baseUrl;
	return `${base.replace(/\/+$/, "")}${path}`;
}

/** `https://abc.mock.host` → `https://‹secret›.mock.host`. */
export function maskSecretHost(baseUrl: string): string | null {
	try {
		const url = new URL(baseUrl);
		const [, ...rest] = url.host.split(".");
		return rest.length > 0
			? `${url.protocol}//‹secret›.${rest.join(".")}`
			: null;
	} catch {
		return null;
	}
}
