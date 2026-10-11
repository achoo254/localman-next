import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";

export interface TreeStatusRowProps {
	status: "loading" | "error";
	onRetry: () => void;
}

/** Under an expanded collection whose folders and requests are not here yet. */
export function TreeStatusRow({ status, onRetry }: TreeStatusRowProps) {
	const t = useT();
	if (status === "loading") {
		return (
			<li
				role="presentation"
				aria-busy="true"
				className="flex min-h-7.5 items-center gap-2 pr-2 pl-9"
			>
				<Skeleton className="h-3 w-8" />
				<Skeleton className="h-3 flex-1" />
				<span className="sr-only">{t("collections.sidebar.itemsLoading")}</span>
			</li>
		);
	}
	return (
		<li
			role="presentation"
			className="flex min-h-7.5 flex-wrap items-center gap-2 pr-2 pl-9 text-error-text text-xs"
		>
			{t("collections.sidebar.itemsFailed")}
			<button
				type="button"
				className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary text-xs underline"
				onClick={onRetry}
			>
				{t("common.cta.retry")}
			</button>
		</li>
	);
}
