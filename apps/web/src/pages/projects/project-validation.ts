import {
	PROJECT_NAME_MAX,
	PROJECT_PREFIX_MAX,
	normalizePrefix,
	projectNameSchema,
	projectPrefixSchema,
} from "@localman/shared";
import type { ProjectInput } from "./projects-api";

export interface ProjectFormErrors {
	name?: string;
	prefix?: string;
}

function nameError(name: string): string | undefined {
	const result = projectNameSchema.safeParse(name);
	if (result.success) return undefined;
	const issue = result.error.issues[0];
	if (issue?.code === "too_small") return "Nhập tên project.";
	if (issue?.code === "too_big") {
		return `Tên tối đa ${PROJECT_NAME_MAX} ký tự.`;
	}
	if (!/^[\p{L}\p{N}]/u.test(name.trim())) {
		return "Tên phải bắt đầu bằng chữ hoặc số.";
	}
	return "Tên chỉ gồm chữ, số, khoảng trắng, -, _ và dấu ngoặc đơn.";
}

function prefixError(prefix: string): string | undefined {
	const result = projectPrefixSchema.safeParse(prefix);
	if (result.success) return undefined;
	if (result.error.issues[0]?.code === "too_big") {
		return `Prefix tối đa ${PROJECT_PREFIX_MAX} ký tự.`;
	}
	return "Prefix chỉ gồm chữ không dấu, số, -, _ và /.";
}

/**
 * Validates with the API's shared schemas. Returns the body to send (name
 * trimmed, prefix normalized to `/x/y`) or Vietnamese field errors.
 */
export function validateProject(
	name: string,
	prefix: string,
): { input: ProjectInput | null; errors: ProjectFormErrors } {
	const errors: ProjectFormErrors = {
		name: nameError(name),
		prefix: prefixError(prefix),
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
