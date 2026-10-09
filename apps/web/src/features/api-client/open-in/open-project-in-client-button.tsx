import { IconSend } from "@tabler/icons-react";
import { Button } from "../../../components/ui/button";
import { useFeatures } from "../../../config/features";
import { useT } from "../../../i18n/i18n-context";
import { useOpenInApiClient } from "./use-open-in-api-client";

/**
 * "Open in API Client" of the project page: every CRUD request of the
 * project as tabs. Nothing while the `apiClient` flag is off.
 */
export function OpenProjectInClientButton({
	projectId,
}: { projectId: string }) {
	const t = useT();
	const { apiClient } = useFeatures();
	const openInClient = useOpenInApiClient();
	if (!apiClient) return null;
	return (
		<Button
			variant="ghost"
			data-id="project-detail-open-client"
			leadingIcon={<IconSend size={20} aria-hidden="true" />}
			onClick={() => openInClient({ projectId })}
		>
			{t("apiClientOpen.project.open")}
		</Button>
	);
}
