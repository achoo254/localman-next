import { useQuery } from "@tanstack/react-query";
import { useT } from "../../i18n/i18n-context";

/**
 * Asks the server (a dry run) whether an action could be undone, while a
 * confirm dialog is open; the dialog waits for the answer. A failed dry
 * run reads as reversible: the action itself still decides.
 */
export function useIrreversible<T extends { irreversible: boolean }>(
	key: readonly unknown[],
	preview: () => Promise<T>,
	open: boolean,
) {
	const query = useQuery({
		queryKey: ["collections", "preview", ...key],
		queryFn: preview,
		enabled: open,
		staleTime: 0,
		gcTime: 0,
		retry: false,
		// A dry run answers for this dialog only; coming back to the tab
		// must not ask again (and flip the warning) mid-confirmation.
		refetchOnWindowFocus: false,
	});
	return {
		pending: open && query.isPending && !query.isError,
		irreversible: query.data?.irreversible === true,
		data: query.data,
	};
}

/** The warning of an action that cannot be undone, inside a confirm dialog. */
export function IrreversibleNote({ show }: { show: boolean }) {
	const t = useT();
	if (!show) return null;
	return (
		<p
			data-id="confirm-irreversible"
			className="m-0 font-semibold text-error-text"
		>
			{t("collections.changelog.irreversible")}
		</p>
	);
}
