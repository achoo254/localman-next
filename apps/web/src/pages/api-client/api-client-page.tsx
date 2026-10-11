import { Navigate } from "react-router";
import { useFeatures } from "../../config/features";
import { useRouter } from "../../features/api-client/routing/use-router";
import { WorkbenchProvider } from "../../features/api-client/workbench/workbench-context";
import { useCollectionSendContext } from "../../features/collections/use-send-context";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";
import { ApiClientScreen } from "./api-client-screen";

function ApiClientWorkbench() {
	const t = useT();
	useAppTitle(t("apiClient.title"));
	const router = useRouter();
	const sendContext = useCollectionSendContext();
	return (
		<WorkbenchProvider
			sender={router.sender}
			newDraft={router.newDraft}
			sendContext={sendContext}
		>
			<ApiClientScreen />
			{router.element}
		</WorkbenchProvider>
	);
}

/** `/api-client`: the web API client, while the `apiClient` flag is on. */
export function ApiClientPage() {
	const { apiClient } = useFeatures();
	return apiClient ? (
		<ApiClientWorkbench />
	) : (
		<Navigate to="/projects" replace />
	);
}
