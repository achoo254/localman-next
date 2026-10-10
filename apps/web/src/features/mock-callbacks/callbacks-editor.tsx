import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, useId, useImperativeHandle, useRef } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { ReadonlyNote } from "../upstream/readonly-note";
import { CallbackItem } from "./callback-item";
import {
	type ResourceCallbacks,
	callbacksKey,
	fetchCallbacks,
} from "./callbacks-api";
import { CallbacksSkeleton } from "./callbacks-skeleton";
import {
	type CallbacksController,
	useCallbacksEditor,
} from "./use-callbacks-editor";

export interface CallbacksEditorProps {
	projectId: string;
	/** An existing resource: callbacks belong to a saved resource. */
	resourceId: string;
	/** Filled once the callbacks loaded; the resource form's Update saves them. */
	controller: RefObject<CallbacksController | null>;
}

const HELP = "m-0 text-muted text-sm";

/**
 * "Callbacks" of the resource form: requests the mock sends when a record
 * is created, updated or deleted through it. The form's Update saves them
 * (their own `PUT`, after the resource's). Read only for collaborators.
 */
export function CallbacksEditor({
	projectId,
	resourceId,
	controller,
}: CallbacksEditorProps) {
	const t = useT();
	const titleId = useId();
	const query = useQuery({
		queryKey: callbacksKey(projectId, resourceId),
		queryFn: () => fetchCallbacks(projectId, resourceId),
	});
	const skeleton = useDelayedFlag(query.isPending);
	return (
		<section
			aria-labelledby={titleId}
			data-id="resource-form-callbacks"
			className="grid gap-3 border-border-subtle border-t pt-6"
		>
			<div className="flex flex-wrap items-center gap-2">
				<h3 id={titleId} className="m-0 font-bold font-mono text-sm">
					{t("mockCallbacks.title")}
				</h3>
				<span className="text-[0.8125rem] text-muted">
					{t("mockCallbacks.subtitle")}
				</span>
			</div>
			{skeleton ? (
				<CallbacksSkeleton />
			) : query.isPending ? null : query.isError ? (
				<Alert tone="danger">
					{t("mockCallbacks.loadFailed")}{" "}
					<Button
						size="sm"
						variant="ghost"
						loading={query.isFetching}
						onClick={() => void query.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				</Alert>
			) : (
				<CallbacksForm
					projectId={projectId}
					resourceId={resourceId}
					controller={controller}
					data={query.data}
				/>
			)}
		</section>
	);
}

function CallbacksForm({
	projectId,
	resourceId,
	controller,
	data,
}: CallbacksEditorProps & { data: ResourceCallbacks }) {
	const t = useT();
	const root = useRef<HTMLDivElement>(null);
	const editor = useCallbacksEditor({
		projectId,
		resourceId,
		data,
		section: root,
	});
	useImperativeHandle(controller, () => ({
		check: editor.check,
		save: editor.save,
	}));
	const manage = data.canManage;
	const full = editor.drafts.length >= data.max;
	return (
		<div ref={root} className="grid gap-3">
			{manage ? null : (
				<ReadonlyNote data-id="resource-form-callbacks-readonly">
					{t("mockCallbacks.readonly")}
				</ReadonlyNote>
			)}
			{editor.drafts.length === 0 ? (
				<p className={HELP} data-id="resource-form-callbacks-empty">
					{t("mockCallbacks.empty")}
				</p>
			) : (
				editor.drafts.map((draft, index) => (
					<CallbackItem
						key={draft.key}
						projectId={projectId}
						resourceId={resourceId}
						index={index}
						draft={draft}
						errors={editor.errors[draft.key]}
						manage={manage}
						onChange={(field, value) => editor.update(draft.key, field, value)}
						onRemove={() => editor.remove(draft.key)}
						onErrors={(found) => editor.showErrors(draft.key, found)}
					/>
				))
			)}
			<p className={HELP}>
				{renderRich(
					t("mockCallbacks.variables", {
						record: "{{record}}",
						field: "{{record.name}}",
						event: "{{event}}",
						resource: "{{resource}}",
					}),
				)}
			</p>
			{editor.formError ? (
				<Alert tone="danger">{editor.formError}</Alert>
			) : null}
			{manage ? (
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						disabled={full}
						leadingIcon={<IconPlus size={16} aria-hidden="true" />}
						onClick={editor.add}
						data-id="resource-form-callback-add"
					>
						{t("mockCallbacks.add")}
					</Button>
					{editor.dirty ? (
						<span
							className="text-muted text-sm"
							data-id="resource-form-callbacks-unsaved"
						>
							{t("mockCallbacks.unsaved")}
						</span>
					) : null}
					{full ? (
						<span
							className="text-muted text-sm"
							data-id="resource-form-callbacks-max"
						>
							{t("mockCallbacks.max", { max: data.max })}
						</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}
