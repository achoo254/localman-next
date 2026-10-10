import {
	type ShareableElementType,
	elementRoleAllows,
} from "@localman/shared/access";
import type { ReactNode } from "react";
import { Alert } from "../../components/ui/alert";
import { CopyField } from "../../components/ui/copy-field";
import { Modal } from "../../components/ui/modal";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useT } from "../../i18n/i18n-context";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { appPageUrl } from "../../platform/navigation";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { ManageAccessList } from "./manage-access-list";
import {
	SharePeopleForm,
	type ShareableEnvironment,
} from "./share-people-form";
import { elementPath } from "./sharing-api";
import { sharingErrorMessage } from "./sharing-errors";
import { useElement, useElementAccess } from "./use-element-access";

export interface ShareDialogProps {
	elementType: ShareableElementType;
	elementId: string;
	elementName: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Environments a collection can be shared with; empty hides the field. */
	environments?: readonly ShareableEnvironment[];
}

const NO_ENVIRONMENTS: readonly ShareableEnvironment[] = [];

function PeopleTab(props: Omit<ShareDialogProps, "open" | "onOpenChange">) {
	const t = useT();
	const { elementType, elementId } = props;
	const summary = useElement(elementType, elementId);
	const access = useElementAccess(elementType, elementId);
	const skeleton = useDelayedFlag(summary.isPending || access.isPending);
	if (skeleton) {
		return (
			<SkeletonRegion className="grid gap-3">
				<Skeleton className="h-11 w-full" />
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</SkeletonRegion>
		);
	}
	const error = summary.error ?? access.error;
	if (error) {
		return (
			<Alert tone="danger" title={t("sharing.dialog.loadFailed")}>
				{sharingErrorMessage(error, t)}
			</Alert>
		);
	}
	if (!summary.data || !access.data) return null;
	const canManage = elementRoleAllows(
		elementType,
		summary.data.role,
		"manageRoles",
	);
	const personal = access.data.workspace?.type === "personal";
	const workspaceGone = access.data.workspace === null;
	return (
		<div className="grid gap-4">
			{personal ? (
				<Alert
					tone="info"
					title={t("sharing.people.personalTitle")}
					data-id="share-people-personal"
				>
					{t("sharing.people.personal")}
				</Alert>
			) : null}
			{workspaceGone ? (
				<Alert
					tone="warning"
					title={t("sharing.people.workspaceGoneTitle")}
					data-id="share-people-workspace-missing"
				>
					{t("sharing.errors.workspaceMissing")}
				</Alert>
			) : null}
			{!canManage ? (
				<Alert tone="info" data-id="share-people-read-only">
					{t("sharing.people.readOnly")}
				</Alert>
			) : null}
			<SharePeopleForm
				elementType={elementType}
				elementId={elementId}
				disabled={personal || workspaceGone || !canManage}
				environments={props.environments ?? NO_ENVIRONMENTS}
			/>
			<ManageAccessList
				elementType={elementType}
				elementId={elementId}
				access={access.data}
				canManage={canManage}
			/>
		</div>
	);
}

function LinkTab({ type, id }: { type: ShareableElementType; id: string }) {
	const t = useT();
	return (
		<CopyField
			label={t("sharing.link.label")}
			value={appPageUrl(elementPath(type, id))}
			hint={t("sharing.link.note")}
			data-id="share-link-input"
			copyDataId="share-copy-link"
		/>
	);
}

/**
 * Share a collection or environment: People (invite, Manage access) and,
 * for collections, Link. Environments have People only. Renders nothing
 * while the `workspaces` flag is off.
 */
export function ShareDialog({
	open,
	onOpenChange,
	...props
}: ShareDialogProps) {
	const t = useT();
	const workspaces = useWorkspacesEnabled();
	if (!workspaces) return null;
	const people = <PeopleTab {...props} />;
	let body: ReactNode = people;
	if (props.elementType === "collection") {
		body = (
			<Tabs defaultValue="people" className="grid gap-4">
				<TabsList aria-label={t("sharing.dialog.tabs")} className="px-0">
					<TabsTrigger value="people" data-id="share-tab-people">
						{t("sharing.dialog.people")}
					</TabsTrigger>
					<TabsTrigger value="link" data-id="share-tab-link">
						{t("sharing.dialog.link")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="people">{people}</TabsContent>
				<TabsContent value="link">
					<LinkTab type={props.elementType} id={props.elementId} />
				</TabsContent>
			</Tabs>
		);
	}
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			size="lg"
			title={t("sharing.dialog.title", { name: props.elementName })}
			data-id="share-dialog"
		>
			{open ? body : null}
		</Modal>
	);
}
