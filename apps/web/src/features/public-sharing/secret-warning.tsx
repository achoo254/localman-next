import type { SecretLikeValue } from "@localman/shared/api-client";
import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";

/**
 * Before publishing: where the collection still holds values that look
 * like secrets (place, path, name; never the value), and what redaction
 * does not hide.
 */
export function SecretWarning({
	warnings,
}: {
	warnings: readonly SecretLikeValue[];
}) {
	const t = useT();
	const note = (
		<p
			className="m-0 text-muted text-[0.8125rem]"
			data-id="secret-warning-note"
		>
			{t("publicSharing.warning.plainNote")}
		</p>
	);
	if (warnings.length === 0) {
		return (
			<div className="grid gap-2" data-id="secret-warning">
				<Alert tone="info">{t("publicSharing.warning.none")}</Alert>
				{note}
			</div>
		);
	}
	return (
		<div className="grid gap-2" data-id="secret-warning">
			<Alert
				tone="warning"
				title={t("publicSharing.warning.found", { count: warnings.length })}
			>
				<p className="m-0">{t("publicSharing.warning.foundText")}</p>
				<ul
					aria-label={t("publicSharing.warning.list")}
					className="m-0 mt-2 grid list-none gap-1 p-0"
				>
					{warnings.map((warning, index) => (
						<li
							// The same place can repeat (two rows of one table).
							key={`${warning.where}-${warning.path.join("/")}-${warning.key}-${index}`}
							data-id="secret-warning-item"
							className="flex min-w-0 flex-wrap gap-x-2 break-words"
						>
							<b>{t(`publicSharing.warning.places.${warning.where}`)}</b>
							<span className="min-w-0 break-all">
								{warning.path.length > 0
									? warning.path.join(" / ")
									: t("publicSharing.warning.root")}
							</span>
							<code className="break-all font-mono">{warning.key}</code>
						</li>
					))}
				</ul>
			</Alert>
			{note}
		</div>
	);
}
