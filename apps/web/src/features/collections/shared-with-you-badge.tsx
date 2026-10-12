import { Badge } from "../../components/ui/badge";
import { useT } from "../../i18n/i18n-context";
import { useWorkspaces } from "../workspaces/current-workspace";

/**
 * "Shared with you" on a collection of a workspace the caller is not a
 * member of (they hold a share on it): it opened from a link and is not in
 * their sidebar. Nothing until the workspace list is known.
 */
export function SharedWithYouBadge({
	workspaceId,
	"data-id": dataId = "collection-header-shared",
}: {
	workspaceId: string;
	"data-id"?: string;
}) {
	const t = useT();
	const workspaces = useWorkspaces().data;
	if (!workspaces || workspaces.some((w) => w.id === workspaceId)) {
		return null;
	}
	return (
		<Badge tone="accent" data-id={dataId}>
			{t("collections.page.sharedWithYou")}
		</Badge>
	);
}
