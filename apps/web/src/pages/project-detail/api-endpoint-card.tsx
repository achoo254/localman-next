import type { MockToolNode } from "@localman/shared/constants";
import {
	IconBolt,
	IconFileImport,
	IconKey,
	IconPlus,
	IconRefresh,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { Tooltip } from "../../components/ui/tooltip";
import { useFeatures } from "../../config/features";
import { OpenProjectInClientButton } from "../../features/api-client/open-in/open-project-in-client-button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import type { Project } from "../projects/projects-api";
import { EndpointTabs } from "./endpoint-tabs";
import { splitMockBaseUrl } from "./mock-url-parts";

export interface ApiEndpointCardProps {
	project: Project;
	/** Resources of the project, for the tools of the MCP tab. */
	resources: readonly MockToolNode[];
	busy: boolean;
	onNewResource: () => void;
	/** Opens "Import resource" (released with `mockPowerUps`). */
	onImport: () => void;
	onGenerateAll: () => void;
	onResetAll: () => void;
	/** Owner only: "Change mock URL" (new secret); absent for collaborators. */
	onRotateSecret?: () => void;
	/**
	 * Content of the Inbox tab (webhook inboxes), shown with `hybridMock`;
	 * no Inbox tab without it.
	 */
	inbox?: ReactNode;
}

/** Tinted chip with a tooltip, focusable so keyboard users can read it. */
function UrlChip({
	tone,
	tip,
	children,
	"data-id": dataId,
}: {
	tone: string;
	tip: string;
	children: ReactNode;
	"data-id": string;
}) {
	return (
		<Tooltip content={tip}>
			<span
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the chip only reveals its tooltip; focus lets keyboard users reach that explanation.
				tabIndex={0}
				data-id={dataId}
				className={cn(
					"tint-soft cursor-help whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-semibold text-(--tone)",
					tone,
				)}
			>
				{children}
			</span>
		</Tooltip>
	);
}

/**
 * "API endpoint": the mock base URL with secret, prefix and `:endpoint`
 * coloured and explained, then New resource / Generate all / Reset all.
 * With Mock MCP or the hybrid mock released, REST becomes the first of
 * tabs (MCP, Upstream, Request log, Inbox) over the same footer.
 */
export function ApiEndpointCard({
	project,
	resources,
	busy,
	onNewResource,
	onImport,
	onGenerateAll,
	onResetAll,
	onRotateSecret,
	inbox,
}: ApiEndpointCardProps) {
	const t = useT();
	const flags = useFeatures();
	const url = splitMockBaseUrl(
		project.mockBaseUrl,
		project.secret,
		project.prefix,
	);
	const rest = (
		<div className="p-6">
			<h2 className="m-0 font-mono font-semibold text-[0.8125rem] text-muted">
				API endpoint
			</h2>
			<p
				data-id="project-detail-endpoint-url"
				className="m-0 mt-3 font-mono text-[0.9375rem] leading-[2.1] wrap-anywhere md:text-[1.0625rem]"
			>
				{url.scheme}
				{url.secret ? (
					<UrlChip
						tone="[--tone:var(--c-text-muted)]"
						tip={t("projectDetail.endpoint.secretTip")}
						data-id="project-detail-endpoint-secret"
					>
						{url.secret}
					</UrlChip>
				) : null}
				{url.host}
				{url.prefix ? (
					<UrlChip
						tone="[--tone:var(--c-accent)]"
						tip={t("projectDetail.endpoint.prefixTip")}
						data-id="project-detail-endpoint-prefix"
					>
						{url.prefix}
					</UrlChip>
				) : null}
				/
				<UrlChip
					tone="[--tone:var(--c-primary)]"
					tip={t("projectDetail.endpoint.resourceTip")}
					data-id="project-detail-endpoint-resource"
				>
					:endpoint
				</UrlChip>
			</p>
		</div>
	);
	return (
		<section
			data-id="project-detail-endpoint"
			aria-label="API endpoint"
			className={cn(cardClassName, "min-w-0 overflow-hidden")}
		>
			{flags.mockMcp || flags.hybridMock ? (
				<EndpointTabs
					project={project}
					resources={resources}
					rest={rest}
					inbox={inbox}
				/>
			) : (
				rest
			)}
			<div className="flex flex-wrap gap-2 border-border-subtle border-t bg-surface-subtle px-6 py-3">
				<Button
					variant="primary"
					data-id="project-detail-new-resource"
					leadingIcon={<IconPlus size={20} aria-hidden="true" />}
					onClick={onNewResource}
				>
					{t("projectDetail.addResource")}
				</Button>
				{flags.mockPowerUps ? (
					<Button
						data-id="project-detail-import-resource"
						leadingIcon={<IconFileImport size={20} aria-hidden="true" />}
						onClick={onImport}
					>
						{t("resourceImport.entry")}
					</Button>
				) : null}
				<Button
					data-id="project-detail-generate-all"
					disabled={busy}
					leadingIcon={<IconBolt size={20} aria-hidden="true" />}
					onClick={onGenerateAll}
				>
					{t("projectDetail.endpoint.generateAll")}
				</Button>
				<Button
					variant="ghost"
					data-id="project-detail-reset-all"
					disabled={busy}
					leadingIcon={<IconRefresh size={20} aria-hidden="true" />}
					onClick={onResetAll}
				>
					{t("projectDetail.endpoint.resetAll")}
				</Button>
				<OpenProjectInClientButton projectId={project.id} />
				{onRotateSecret ? (
					<Button
						variant="ghost"
						data-id="project-detail-rotate-secret"
						leadingIcon={<IconKey size={20} aria-hidden="true" />}
						onClick={onRotateSecret}
					>
						{t("projects.rotate.title")}
					</Button>
				) : null}
			</div>
		</section>
	);
}
