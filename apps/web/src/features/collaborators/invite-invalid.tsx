import { IconLinkOff } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useI18n } from "../../i18n/i18n-context";
import type { Translator } from "../../i18n/translate";
import { ApiError } from "../../lib/api-client";
import { isRecord } from "../../lib/json-guards";

const TOKEN_ERRORS = [
	"INVITE_NOT_FOUND",
	"INVITE_EXPIRED",
	"INVITE_USED",
	"INVITE_REVOKED",
] as const;
export type TokenErrorCode = (typeof TOKEN_ERRORS)[number];

/**
 * The token can no longer be used by anyone (404/410 of preview or accept).
 * A token of the wrong shape (400 `VALIDATION_ERROR`) is a bad link too.
 */
export function tokenErrorOf(error: unknown): TokenErrorCode | null {
	if (!(error instanceof ApiError)) return null;
	if (error.code === "VALIDATION_ERROR") return "INVITE_NOT_FOUND";
	return TOKEN_ERRORS.find((code) => code === error.code) ?? null;
}

function expiredOn(error: unknown): string | null {
	if (!(error instanceof ApiError) || !isRecord(error.details)) return null;
	const at = error.details.expiresAt;
	return typeof at === "string" ? at : null;
}

function copyOf(
	code: TokenErrorCode,
	error: unknown,
	{ t, formatDate }: Translator,
) {
	if (code === "INVITE_EXPIRED") {
		const at = expiredOn(error);
		const date = at ? formatDate(at) : "";
		return {
			title: t("invite.invalid.expiredTitle"),
			text: date
				? t("invite.invalid.expiredText", { date })
				: t("invite.invalid.expiredTextNoDate"),
		};
	}
	if (code === "INVITE_USED") {
		return {
			title: t("invite.invalid.usedTitle"),
			text: t("invite.invalid.usedText"),
		};
	}
	return {
		title: t("invite.invalid.revokedTitle"),
		text: t("invite.invalid.revokedText"),
	};
}

/** Expired, used, revoked or unknown invite link. */
export function InviteInvalid({
	code,
	error,
}: {
	code: TokenErrorCode;
	error: unknown;
}) {
	const i18n = useI18n();
	const { title, text } = copyOf(code, error, i18n);
	return (
		<EmptyState
			data-id="invite-page-invalid"
			headingLevel={1}
			icon={<IconLinkOff size={32} aria-hidden="true" />}
			title={title}
			action={
				<Link
					to="/projects"
					data-id="invite-page-back"
					className={buttonClassName({ variant: "primary" })}
				>
					{i18n.t("invite.backToProjects")}
				</Link>
			}
		>
			{text}
		</EmptyState>
	);
}
