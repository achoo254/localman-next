import { CollectionLinkSection } from "./collection-link-section";

/**
 * "Public" tab of the Share dialog: the public link (anyone, no sign-in)
 * and the guest link (signed-in people, who may ask for edit access).
 * Both are the same redacted read-only view, so one section serves both.
 */
export function PublicLinkTab({ collectionId }: { collectionId: string }) {
	return (
		<div className="grid gap-6">
			<CollectionLinkSection collectionId={collectionId} kind="public" />
			<div className="border-border-subtle border-t pt-6">
				<CollectionLinkSection collectionId={collectionId} kind="guest" />
			</div>
		</div>
	);
}
