import { useShareableEnvironments } from "../environments/use-shareable-environments";
import { ShareDialog, type ShareDialogProps } from "../sharing/share-dialog";

/**
 * Share of a collection, offering the environments of its workspace the
 * caller may share along with it.
 */
export function CollectionShareDialog({
	workspaceId,
	...props
}: Omit<ShareDialogProps, "elementType" | "environments"> & {
	workspaceId: string;
}) {
	const environments = useShareableEnvironments(workspaceId);
	return (
		<ShareDialog
			{...props}
			elementType="collection"
			environments={environments}
		/>
	);
}
