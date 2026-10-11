import { useT } from "../../i18n/i18n-context";
import { collectionErrorMessage } from "./collection-errors";
import type { SaveStatus } from "./use-page-autosave";

/** "Saving…", "All changes saved" or the error with a retry, read out politely. */
export function PageSaveState({
	status,
	onRetry,
}: {
	status: SaveStatus;
	onRetry: () => void;
}) {
	const t = useT();
	return (
		<output
			aria-live="polite"
			data-id="collection-save-state"
			className="flex items-center gap-2 text-muted text-xs"
		>
			{status.state === "saving" ? t("collections.page.status.saving") : null}
			{status.state === "saved" ? t("collections.page.status.saved") : null}
			{status.state === "error" ? (
				<>
					<span className="text-error-text">
						{t("collections.page.status.error", {
							message: collectionErrorMessage(status.error, t),
						})}
					</span>
					<button
						type="button"
						className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline"
						onClick={onRetry}
					>
						{t("common.cta.retry")}
					</button>
				</>
			) : null}
		</output>
	);
}
