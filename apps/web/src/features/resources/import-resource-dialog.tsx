import { useId, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../components/ui/tabs";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import { ImportFileDrop } from "./import-file-drop";
import { ImportJsonTab } from "./import-json-tab";
import { importErrorText } from "./import-messages";
import { ImportOpenApiTab } from "./import-openapi-tab";
import { ImportPreview, overPlan } from "./import-preview";
import { type ImportTab, importNameErrors, renamesOf } from "./import-source";
import {
	type ImportPreview as Preview,
	importResources,
} from "./resource-import-api";
import type { Resource } from "./resource-model";
import { useImportPreview } from "./use-import-preview";
import { useImportSources } from "./use-import-sources";

export interface ImportResourceDialogProps {
	projectId: string;
	/** Resources of the project: imported roots must not reuse a root name. */
	resources: readonly Resource[];
	/** Owner only: open the plans from the "no room" warning. */
	onManagePlan: (() => void) | null;
	onOpenChange: (open: boolean) => void;
	/** Created resources (the root first). */
	onImported: (result: Preview) => void;
	onPlanLimit: () => void;
	/** Where focus goes on close when the button that opened the dialog is gone. */
	fallbackFocus: () => HTMLElement | null;
}

const TABS: readonly ImportTab[] = ["json", "openapi", "file"];

/** "Import resource": sample JSON, OpenAPI or CSV/JSON file, previewed by a dry run. */
export function ImportResourceDialog({
	projectId,
	resources,
	onManagePlan,
	onOpenChange,
	onImported,
	onPlanLimit,
	fallbackFocus,
}: ImportResourceDialogProps) {
	const t = useT();
	const ids = useId();
	const firstTab = useRef<HTMLButtonElement>(null);
	const [opener] = useState(() => document.activeElement);
	const sources = useImportSources();
	const { check } = sources;
	const request = check.kind === "ready" ? check.request : null;
	const state = useImportPreview(projectId, request, sources.delay);
	const [busy, setBusy] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const preview = state.status === "ready" ? state.preview : null;
	const rootNames = resources
		.filter((r) => r.parentId === null)
		.map((r) => r.name);
	const nameErrors = preview
		? importNameErrors(preview.resources, sources.names, rootNames, t)
		: {};
	const sourceError =
		check.kind === "error"
			? check.message
			: state.status === "error" && request
				? importErrorText(state.error, request.format, t)
				: null;
	const errorId = sourceError ? `${ids}-error` : undefined;
	const canCreate =
		!busy &&
		request !== null &&
		preview !== null &&
		overPlan(preview) < 0 &&
		Object.keys(nameErrors).length === 0;

	async function create() {
		if (!canCreate || !request || !preview) return;
		setBusy(true);
		setSubmitError(null);
		try {
			const renames = renamesOf(preview.resources, sources.names);
			const created = await importResources(
				projectId,
				{ ...request, ...renames },
				false,
			);
			onImported(created);
		} catch (error) {
			if (isPlanLimitError(error)) onPlanLimit();
			else setSubmitError(importErrorText(error, request.format, t));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open
			onOpenChange={(open) => !busy && onOpenChange(open)}
			title={t("resourceImport.title")}
			description={t("resourceImport.description")}
			size="xl"
			initialFocusRef={firstTab}
			onCloseAutoFocus={(event) => {
				// The empty state's button disappears once a resource exists.
				if (opener?.isConnected) return;
				event.preventDefault();
				fallbackFocus()?.focus();
			}}
			data-id="modal-import-resource"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						disabled={!canCreate && !busy}
						loading={busy}
						data-id="resource-import-submit"
						onClick={() => void create()}
					>
						{t("resourceImport.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<div className="grid gap-4" inert={busy}>
				<Tabs
					value={sources.tab}
					onValueChange={(value) =>
						sources.setTab(TABS.find((tab) => tab === value) ?? "json")
					}
				>
					<TabsList className="px-0">
						{TABS.map((tab, index) => (
							<TabsTrigger
								key={tab}
								value={tab}
								ref={index === 0 ? firstTab : undefined}
								data-id={`resource-import-tab-${tab}`}
							>
								{t(`resourceImport.tabs.${tab}`)}
							</TabsTrigger>
						))}
					</TabsList>
					<TabsContent value="json" className="pt-4">
						<ImportJsonTab source={sources.json} errorId={errorId} />
					</TabsContent>
					<TabsContent value="openapi" className="pt-4">
						<ImportOpenApiTab
							source={sources.openApi}
							preview={
								preview ?? (state.status === "loading" ? state.previous : null)
							}
							errorId={errorId}
						/>
					</TabsContent>
					<TabsContent value="file" className="pt-4">
						<ImportFileDrop
							file={sources.file.file}
							reading={sources.file.reading}
							onFile={(file) => void sources.file.choose(file)}
							onRemove={sources.file.remove}
							errorId={errorId}
						/>
					</TabsContent>
				</Tabs>
				{sourceError ? (
					<Alert tone="danger" id={errorId} data-id="resource-import-error">
						{renderRich(sourceError)}
					</Alert>
				) : null}
				{sourceError ? null : (
					<ImportPreview
						state={state}
						names={sources.names}
						nameErrors={nameErrors}
						onRename={sources.rename}
						onManagePlan={onManagePlan}
					/>
				)}
				{submitError ? <Alert tone="danger">{submitError}</Alert> : null}
			</div>
		</Modal>
	);
}
