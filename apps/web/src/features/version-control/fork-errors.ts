import { useT } from "../../i18n/i18n-context";
import { ApiError, errorMessage } from "../../lib/api-client";

const CODES = {
	PLAN_FEATURE_UNAVAILABLE: "planFeature",
	FORK_TARGET_NOT_ALLOWED: "target",
	MERGE_CONFLICTS: "conflicts",
	FORK_SOURCE_UNAVAILABLE: "sourceGone",
	FORBIDDEN: "forbidden",
} as const;

function isKnown(code: string): code is keyof typeof CODES {
	return Object.hasOwn(CODES, code);
}

/** Error codes of forks, pulls and merges in the reader's language. */
export function useForkErrorMessage(): (error: unknown) => string {
	const t = useT();
	return (error) =>
		error instanceof ApiError && isKnown(error.code)
			? t(`versionControl.errors.${CODES[error.code]}`)
			: errorMessage(error);
}
