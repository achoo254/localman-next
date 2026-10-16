import { hasBlankedSecrets } from "@localman/shared/api-client";
import { IconLock } from "@tabler/icons-react";
import { type ReactNode, useContext } from "react";
import { Badge } from "../../../components/ui/badge";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "../../../components/ui/tabs";
import { useT } from "../../../i18n/i18n-context";
import { ScriptsTab } from "../scripts/scripts-tab";
import { useWorkbenchActions } from "../workbench/workbench-context";
import type { WorkbenchTab } from "../workbench/workbench-types";
import { AuthInheritContext } from "./auth-inherit-context";
import { AuthTab } from "./auth-tab";
import { BodyTab } from "./body-tab";
import type { DraftPaneProps } from "./draft-pane";
import { HeadersTab } from "./headers-tab";
import {
	InlineCommentHostContext,
	useInlineCommenting,
} from "./inline-comment-context";
import { ParamsTab } from "./params-tab";
import { RequestSettingsTab } from "./request-settings-tab";
import { UrlBar } from "./url-bar";

const PANES = [
	"params",
	"auth",
	"headers",
	"body",
	"scripts",
	"settings",
] as const;
type PaneId = (typeof PANES)[number];

export interface RequestEditorProps {
	tab: WorkbenchTab;
	/** Extra buttons in the request head (code snippet, save…). */
	headActions?: ReactNode;
}

/** Request builder of the active tab: name, URL bar and the six panes. */
export function RequestEditor({ tab, headActions }: RequestEditorProps) {
	const host = useContext(InlineCommentHostContext);
	const editor = <RequestEditorBody tab={tab} headActions={headActions} />;
	return host ? host(tab, editor) : editor;
}

function RequestEditorBody({ tab, headActions }: RequestEditorProps) {
	const t = useT();
	const commenting = useInlineCommenting();
	const workbench = useWorkbenchActions();
	const inheritNoteOf = useContext(AuthInheritContext);
	const { draft } = tab;
	const pane: DraftPaneProps = {
		draft,
		update: (change) => workbench.updateDraft(tab.id, change),
	};
	const marks: Record<PaneId, ReactNode> = {
		params:
			draft.params.filter((row) => row.enabled && row.key.trim()).length ||
			null,
		auth: null,
		headers:
			draft.headers.filter((row) => row.enabled && row.key.trim()).length ||
			null,
		body: draft.body.type === "none" ? null : "•",
		scripts: draft.scripts.pre.trim() || draft.scripts.post.trim() ? "•" : null,
		settings: null,
	};

	return (
		<div
			data-id="request"
			className="@container grid min-w-0 grid-cols-1 content-start gap-3 p-4"
		>
			<div data-id="request-head" className="flex min-w-0 items-center gap-2">
				<input
					type="text"
					value={draft.name}
					placeholder={t("apiClient.request.untitled")}
					aria-label={t("apiClient.request.name")}
					data-id="request-name"
					maxLength={200}
					className="min-h-9 min-w-0 flex-1 truncate rounded-sm border border-transparent bg-transparent px-2 font-bold font-mono text-sm placeholder:text-muted hover:border-border focus:border-primary focus:outline-none"
					onChange={(event) =>
						pane.update((current) => ({ ...current, name: event.target.value }))
					}
				/>
				{tab.dirty ? (
					<Badge tone="neutral">{t("apiClient.request.unsaved")}</Badge>
				) : null}
				{commenting?.head}
				{headActions}
			</div>
			<UrlBar
				{...pane}
				sending={tab.response.kind === "sending"}
				onSend={() => workbench.send(tab.id)}
			/>
			{tab.redacted && hasBlankedSecrets(draft) ? (
				<p
					data-id="request-redacted-note"
					className="m-0 flex items-center gap-1 text-muted text-xs"
				>
					<IconLock size={14} aria-hidden="true" />
					{t("apiClientTools.history.redacted")}
				</p>
			) : null}
			<Tabs defaultValue="params">
				<TabsList aria-label={t("apiClient.request.parts")}>
					{PANES.map((id) => (
						<TabsTrigger key={id} value={id} data-id={`request-tab-${id}`}>
							{t(`apiClient.request.tabs.${id}`)}
							{marks[id] !== null ? (
								<span className="ml-1 text-muted text-xs">{marks[id]}</span>
							) : null}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent
					value="params"
					data-id="request-pane-params"
					className="pt-3"
				>
					<ParamsTab {...pane} />
				</TabsContent>
				<TabsContent value="auth" data-id="request-pane-auth" className="pt-3">
					<AuthTab {...pane} inheritNote={inheritNoteOf?.(tab) ?? undefined} />
				</TabsContent>
				<TabsContent
					value="headers"
					data-id="request-pane-headers"
					className="pt-3"
				>
					<HeadersTab {...pane} />
				</TabsContent>
				<TabsContent value="body" data-id="request-pane-body" className="pt-3">
					<BodyTab
						{...pane}
						files={tab.files}
						setFile={(fileId, file) => workbench.setFile(tab.id, fileId, file)}
					/>
				</TabsContent>
				<TabsContent
					value="scripts"
					data-id="request-pane-scripts"
					className="pt-3"
				>
					<ScriptsTab {...pane} />
				</TabsContent>
				<TabsContent
					value="settings"
					data-id="request-pane-settings"
					className="pt-3"
				>
					<RequestSettingsTab {...pane} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
