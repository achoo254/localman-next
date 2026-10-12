import { IconStack2 } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { useOpenCollectionNode } from "../collections/open-node";
import { useEnvironmentCollections } from "./use-environments";

/** Where the environment is in use: collections linked to it or shared with it. */
export function EnvironmentUsage({ environmentId }: { environmentId: string }) {
	const t = useT();
	const query = useEnvironmentCollections(environmentId);
	const openNode = useOpenCollectionNode();
	let body = null;
	if (query.isPending) {
		body = (
			<SkeletonRegion label={t("environments.info.usedLoading")}>
				<Skeleton variant="text" lines={2} />
			</SkeletonRegion>
		);
	} else if (query.isError) {
		body = (
			<p className="m-0 text-error-text text-sm">
				{t("environments.info.usedFailed")}
			</p>
		);
	} else if (query.data.length === 0) {
		body = (
			<p className="m-0 text-muted text-sm" data-id="environment-used-empty">
				{t("environments.info.usedEmpty")}
			</p>
		);
	} else {
		body = (
			<ul className="m-0 grid list-none gap-1 p-0">
				{query.data.map((collection) => (
					<li key={`${collection.source}-${collection.id}`}>
						<button
							type="button"
							data-id="environment-used-item"
							aria-label={t("environments.info.openCollection", {
								name: collection.name,
							})}
							className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-sm hover:bg-fg/4"
							onClick={() =>
								openNode({
									kind: "collection",
									collectionId: collection.id,
									name: collection.name,
								})
							}
						>
							<IconStack2
								size={16}
								aria-hidden="true"
								className="flex-none text-icon-muted"
							/>
							<span className="min-w-0 flex-1 truncate">{collection.name}</span>
							<Badge tone="neutral">
								{t(`environments.info.source.${collection.source}`)}
							</Badge>
						</button>
					</li>
				))}
			</ul>
		);
	}
	return (
		<section className="grid gap-1" data-id="environment-used">
			<h3 className="m-0 text-muted text-sm font-normal">
				{t("environments.info.usedBy")}
			</h3>
			{body}
		</section>
	);
}
