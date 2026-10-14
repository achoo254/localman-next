import type { SecretLikeValue } from "@localman/shared/api-client";
import { useEffect, useId, useRef } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { publicSharingErrorMessage } from "./public-sharing-errors";
import { SecretWarning } from "./secret-warning";

export interface PublishConfirmProps {
	title: string;
	warnings: readonly SecretLikeValue[];
	confirmLabel: string;
	busy: boolean;
	error: unknown;
	onConfirm: () => void;
	onCancel: () => void;
	"data-id": string;
}

/**
 * The confirm step before something goes public, inside the tab that
 * started it (the Share dialog is already a modal): the dry run's
 * warnings, then Cancel / publish. Focus moves to its heading.
 */
export function PublishConfirm({
	title,
	warnings,
	confirmLabel,
	busy,
	error,
	onConfirm,
	onCancel,
	"data-id": dataId,
}: PublishConfirmProps) {
	const t = useT();
	const headingId = useId();
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => heading.current?.focus(), []);
	return (
		<section
			aria-labelledby={headingId}
			data-id={dataId}
			className="grid gap-3 rounded-md border border-border bg-surface-subtle p-4"
		>
			<h4
				id={headingId}
				ref={heading}
				tabIndex={-1}
				className="m-0 font-mono font-semibold text-sm"
			>
				{title}
			</h4>
			<SecretWarning warnings={warnings} />
			{error ? (
				<Alert tone="danger" data-id={`${dataId}-error`}>
					{publicSharingErrorMessage(error, t)}
				</Alert>
			) : null}
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					variant="ghost"
					disabled={busy}
					onClick={onCancel}
					data-id={`${dataId}-cancel`}
				>
					{t("common.actions.cancel")}
				</Button>
				<Button
					variant="primary"
					loading={busy}
					onClick={onConfirm}
					data-id={`${dataId}-confirm`}
				>
					{confirmLabel}
				</Button>
			</div>
		</section>
	);
}
