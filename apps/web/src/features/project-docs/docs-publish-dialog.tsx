import { IconBook } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { CopyField } from "../../components/ui/copy-field";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Switch } from "../../components/ui/switch";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import {
	useDocsSettings,
	useProjectDocsEnabled,
	useSetDocsPublished,
} from "./use-project-docs";

/**
 * "Docs" on a mock project's page: publish its docs at an unguessable
 * link, copy the link, take them down. Every member of a project edits
 * its resources, so every member may publish.
 */
export function DocsPublishButton({ projectId }: { projectId: string }) {
	const t = useT();
	const enabled = useProjectDocsEnabled();
	const [open, setOpen] = useState(false);
	const settings = useDocsSettings(projectId, enabled && open);
	const publish = useSetDocsPublished(projectId);
	const toggleId = useId();
	if (!enabled) return null;
	const published = settings.data?.published ?? false;
	return (
		<>
			<Button
				size="sm"
				data-id="project-detail-docs"
				leadingIcon={<IconBook size={16} aria-hidden="true" />}
				onClick={() => setOpen(true)}
			>
				{t("projectDocs.publish.button")}
			</Button>
			{open ? (
				<Modal
					open
					onOpenChange={setOpen}
					title={t("projectDocs.publish.title")}
					description={t("projectDocs.publish.intro")}
					size="md"
					footer={
						<ModalFooter>
							<ModalClose asChild>
								<Button variant="ghost">{t("common.actions.close")}</Button>
							</ModalClose>
						</ModalFooter>
					}
				>
					<div data-id="modal-project-docs" className="grid gap-4 text-sm">
						<div className="flex items-start justify-between gap-3">
							<div className="grid gap-1">
								<strong id={toggleId}>{t("projectDocs.publish.toggle")}</strong>
								<span className="text-muted text-xs">
									{t("projectDocs.publish.toggleHint", {
										baseUrl: "{baseUrl}",
									})}
								</span>
							</div>
							<Switch
								checked={published}
								disabled={!settings.data || publish.isPending}
								aria-labelledby={toggleId}
								data-id="modal-project-docs-published"
								onCheckedChange={(next) => publish.mutate(next)}
							/>
						</div>
						{settings.data?.url ? (
							<CopyField
								label={t("projectDocs.publish.link")}
								value={settings.data.url}
								data-id="modal-project-docs-link"
								copyDataId="modal-project-docs-copy"
							/>
						) : null}
						{settings.isError || publish.isError ? (
							<Alert tone="danger">
								{errorMessage(settings.error ?? publish.error)}
							</Alert>
						) : null}
					</div>
				</Modal>
			) : null}
		</>
	);
}
