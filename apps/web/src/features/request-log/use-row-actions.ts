import { useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { errorMessage } from "../../lib/api-client";
import { useOpenInApiClient } from "../api-client/open-in/use-open-in-api-client";
import { replayLogLine } from "./request-log-api";
import type { LogSummary, ReplayResult } from "./request-log-parse";
import { fullPath } from "./request-log-row";
import type { RowAction } from "./request-log-row";
import type { RowBusy } from "./request-log-table";

export interface RowActions {
	busy: RowBusy | null;
	run: (row: LogSummary, action: RowAction) => void;
}

/**
 * Replay (the answer goes to `onReplayed` and a toast) and "Open in API
 * Client" (`/api-client` opens the line as a draft tab).
 */
export function useRowActions(
	projectId: string,
	onReplayed: (row: LogSummary, result: ReplayResult) => void,
): RowActions {
	const t = useT();
	const toast = useToast();
	const openInClient = useOpenInApiClient();
	const [busy, setBusy] = useState<RowBusy | null>(null);

	const replay = async (row: LogSummary) => {
		const target = { method: row.method, path: fullPath(row) };
		try {
			const result = await replayLogLine(projectId, row.id);
			onReplayed(row, result);
			const key =
				result.source === "upstream"
					? "trafficLog.replay.doneUpstream"
					: "trafficLog.replay.doneMock";
			toast.show({ tone: "success", title: renderRich(t(key, target)) });
		} catch (error) {
			toast.show({
				tone: "error",
				title: t("trafficLog.replay.failed"),
				description: errorMessage(error),
			});
		}
	};

	const run = (row: LogSummary, action: RowAction) => {
		if (busy) return;
		// Ids only: `/api-client` loads the draft (its URL carries the secret).
		if (action === "open") {
			openInClient({ projectId, logId: row.id });
			return;
		}
		setBusy({ id: row.id, action });
		void replay(row).finally(() => setBusy(null));
	};

	return { busy, run };
}
