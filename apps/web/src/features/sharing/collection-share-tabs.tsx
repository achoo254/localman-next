import type { ReactNode } from "react";
import { CopyField } from "../../components/ui/copy-field";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { appPageUrl } from "../../platform/navigation";
import { AccessKeysTab } from "../public-sharing/access-keys-tab";
import { PublicLinkTab } from "../public-sharing/public-link-tab";
import { RunButtonTab } from "../public-sharing/run-button-tab";
import type { ShareableEnvironment } from "./share-people-form";
import { elementPath } from "./sharing-api";

function LinkTab({ id }: { id: string }) {
	const t = useT();
	return (
		<CopyField
			label={t("sharing.link.label")}
			value={appPageUrl(elementPath("collection", id))}
			hint={t("sharing.link.note")}
			data-id="share-link-input"
			copyDataId="share-copy-link"
		/>
	);
}

export interface CollectionShareTabsProps {
	collectionId: string;
	/** The People tab, built by the dialog. */
	people: ReactNode;
	environments: readonly ShareableEnvironment[];
}

/**
 * Tabs of a collection's Share dialog: People and Link, then (with
 * `publicSharing`) Public, Keys and Run. Keys stays mounted while hidden
 * (`forceMount`; the class hides it), so a key shown once survives a look
 * at another tab. Labels stay short: the row scrolls itself at 375px.
 */
export function CollectionShareTabs({
	collectionId,
	people,
	environments,
}: CollectionShareTabsProps) {
	const t = useT();
	const { publicSharing } = useFeatures();
	return (
		<Tabs defaultValue="people" className="grid gap-4">
			<TabsList aria-label={t("sharing.dialog.tabs")} className="px-0">
				<TabsTrigger value="people" data-id="share-tab-people">
					{t("sharing.dialog.people")}
				</TabsTrigger>
				<TabsTrigger value="link" data-id="share-tab-link">
					{t("sharing.dialog.link")}
				</TabsTrigger>
				{publicSharing ? (
					<>
						<TabsTrigger value="public" data-id="share-tab-public">
							{t("publicSharing.share.tabs.public")}
						</TabsTrigger>
						<TabsTrigger value="keys" data-id="share-tab-keys">
							{t("publicSharing.share.tabs.keys")}
						</TabsTrigger>
						<TabsTrigger value="run" data-id="share-tab-run">
							{t("publicSharing.share.tabs.run")}
						</TabsTrigger>
					</>
				) : null}
			</TabsList>
			<TabsContent value="people">{people}</TabsContent>
			<TabsContent value="link">
				<LinkTab id={collectionId} />
			</TabsContent>
			{publicSharing ? (
				<>
					<TabsContent value="public">
						<PublicLinkTab collectionId={collectionId} />
					</TabsContent>
					<TabsContent
						value="keys"
						forceMount
						className="data-[state=inactive]:hidden"
					>
						<AccessKeysTab collectionId={collectionId} />
					</TabsContent>
					<TabsContent value="run">
						<RunButtonTab
							collectionId={collectionId}
							environments={environments}
						/>
					</TabsContent>
				</>
			) : null}
		</Tabs>
	);
}
