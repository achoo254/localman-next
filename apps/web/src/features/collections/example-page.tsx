import { IconBookmark, IconCopy, IconDeviceFloppy } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { METHOD_TEXT_CLASS } from "../../lib/method-tone";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import { collectionErrorMessage } from "./collection-errors";
import { EditableName } from "./editable-name";
import { ExampleResponseForm } from "./example-response-form";
import type { OpenNode } from "./open-node";
import { PageSaveState } from "./page-save-state";
import { useExampleModel } from "./use-example-model";
import { useDuplicateNode } from "./use-node-mutations";

/** Tab of a saved example: name, the request (read-only), the response. */
export function ExamplePage({
	page,
	onOpen,
}: { page: PageTab; onOpen: OpenNode }) {
	const t = useT();
	const toast = useToast();
	const model = useExampleModel(page);
	const duplicate = useDuplicateNode();
	const skeleton = useDelayedFlag(model.query.isPending);
	if (skeleton) {
		return (
			<SkeletonRegion className="grid gap-4 p-4">
				<Skeleton className="h-9 w-64 max-w-full" />
				<Skeleton variant="text" lines={4} />
			</SkeletonRegion>
		);
	}
	if (model.query.isError) {
		return (
			<Alert
				tone="danger"
				className="m-4"
				title={t("collections.page.loadFailed")}
			>
				{collectionErrorMessage(model.query.error, t)}
			</Alert>
		);
	}
	const { example, fields } = model;
	if (!model.query.isPending && !example) {
		return (
			<p className="m-0 p-4 text-muted text-sm">
				{t("collections.example.gone")}
			</p>
		);
	}
	if (!example || !fields) return null;
	const readOnly = !model.canEdit;
	const copy = () =>
		duplicate.mutate(
			{ collectionId: page.collectionId, nodeId: example.id },
			{
				onSuccess: ([node]) => {
					if (!node) return;
					onOpen({
						kind: "example",
						collectionId: page.collectionId,
						nodeId: node.id,
						name: node.name,
					});
				},
				onError: (error) =>
					toast.show({
						tone: "error",
						title: collectionErrorMessage(error, t),
					}),
			},
		);

	return (
		<div data-id="example-editor" className="flex min-w-0 flex-col">
			<header className="flex flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-3">
				<IconBookmark
					size={20}
					aria-hidden="true"
					className="flex-none text-viz-cyan"
				/>
				<EditableName
					name={fields.name}
					label={t("collections.page.nameLabel.example")}
					readOnly={readOnly}
					data-id="example-name"
					onRename={(next) => model.edit({ name: next })}
				/>
				<PageSaveState
					status={model.status}
					onRetry={() => void model.flush()}
				/>
				{readOnly ? null : (
					<>
						<Button
							size="sm"
							variant="ghost"
							data-id="example-duplicate"
							loading={duplicate.isPending}
							onClick={copy}
						>
							<IconCopy size={16} aria-hidden="true" />
							{t("collections.menu.duplicate")}
						</Button>
						<Button
							size="sm"
							variant="secondary"
							data-id="example-save"
							onClick={() => void model.flush()}
						>
							<IconDeviceFloppy size={16} aria-hidden="true" />
							{t("collections.save.button")}
						</Button>
					</>
				)}
			</header>
			<div className="grid gap-4 p-4">
				{readOnly ? (
					<Alert tone="info">{t("collections.page.readOnly")}</Alert>
				) : null}
				<p className="m-0 text-muted text-sm">
					{t("collections.example.note")}
				</p>
				<div
					data-id="example-request"
					className="flex min-w-0 items-center gap-2 rounded-md border border-border-subtle bg-surface-subtle px-3 py-2 font-mono text-xs"
				>
					<span
						className={cn(
							"font-bold",
							METHOD_TEXT_CLASS[example.request.method],
						)}
					>
						{example.request.method}
					</span>
					<span className="min-w-0 truncate">{example.request.url}</span>
				</div>
				<ExampleResponseForm
					response={fields.response}
					canEdit={model.canEdit}
					onChange={(response) => model.edit({ response })}
				/>
			</div>
		</div>
	);
}
