import { useId, useState } from "react";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { JsonEditor } from "../../components/ui/json-editor";
import { Switch } from "../../components/ui/switch";
import { useFeatures } from "../../config/features";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { EndpointBehaviorSection } from "./endpoint-behavior-section";
import {
	type BehaviorErrors,
	type EndpointDraft,
	endpointKey,
} from "./resource-form-state";
import type { EndpointMethod } from "./resource-model";

export interface EndpointsEditorProps {
	endpoints: EndpointDraft[];
	onChange: (endpoints: EndpointDraft[]) => void;
	/** Resource name shown in the paths (`/users/:id`). */
	resourceName: string;
	/** Errors by `endpointKey`. */
	errors: Record<string, string>;
	/** Chaos and rule errors by `endpointKey`. */
	behaviorErrors: Record<string, BehaviorErrors>;
}

const METHOD_TONES: Readonly<Record<EndpointMethod, BadgeTone>> = {
	GET: "info",
	POST: "success",
	PUT: "warning",
	DELETE: "danger",
};

/** Dictionary key of the short label of each endpoint, by `endpointKey`. */
const LABEL_KEYS = {
	"GET /:res": "resources.endpoints.list",
	"GET /:res/:id": "resources.endpoints.one",
	"POST /:res": "resources.endpoints.create",
	"PUT /:res/:id": "resources.endpoints.update",
	"DELETE /:res/:id": "resources.endpoints.delete",
} as const;

function isLabelled(key: string): key is keyof typeof LABEL_KEYS {
	return key in LABEL_KEYS;
}

/**
 * The five generated endpoints: each can be switched off (the mock then
 * answers 404) and has a response template, then (released with the
 * `mockPowerUps` flag) conditional rules and chaos. Open on every plan.
 */
export function EndpointsEditor({
	endpoints,
	onChange,
	resourceName,
	errors,
	behaviorErrors,
}: EndpointsEditorProps) {
	const t = useT();
	const { mockPowerUps } = useFeatures();
	const ids = useId();
	const [blurErrors, setBlurErrors] = useState<Record<string, string | null>>(
		{},
	);
	const name = resourceName.trim() || "resource";
	const update = (key: string, patch: Partial<EndpointDraft>) =>
		onChange(
			endpoints.map((endpoint) =>
				endpointKey(endpoint) === key ? { ...endpoint, ...patch } : endpoint,
			),
		);

	return (
		<section className="grid gap-3" data-id="resource-form-endpoints">
			<h3 className="m-0 font-bold font-mono text-sm">Endpoints</h3>
			{endpoints.map((endpoint) => {
				const key = endpointKey(endpoint);
				const slug = `${endpoint.method.toLowerCase()}${endpoint.path === "/:res" ? "-list" : "-one"}`;
				const path = `/${name}${endpoint.path === "/:res" ? "" : "/:id"}`;
				const title = `${endpoint.method} ${path}`;
				const error = blurErrors[key] ?? errors[key];
				return (
					<div
						key={key}
						data-id={`resource-form-endpoint-${slug}`}
						className={cn(
							"grid gap-2 rounded-md border border-border-subtle p-3",
							!endpoint.enabled && "bg-surface-subtle",
						)}
					>
						<div className="flex flex-wrap items-center gap-2 font-mono text-[0.8125rem]">
							<Switch
								checked={endpoint.enabled}
								aria-label={t("resources.endpoints.enable", {
									endpoint: title,
								})}
								onCheckedChange={(enabled) => update(key, { enabled })}
							/>
							<Badge tone={METHOD_TONES[endpoint.method]}>
								{endpoint.method}
							</Badge>
							<code className="font-semibold">{path}</code>
							<span className="ml-auto text-muted text-xs">
								{isLabelled(key) ? t(LABEL_KEYS[key]) : null}
							</span>
						</div>
						<JsonEditor
							value={endpoint.response}
							onChange={(response) => {
								update(key, { response });
								if (blurErrors[key])
									setBlurErrors((all) => ({ ...all, [key]: null }));
							}}
							label={`Response template ${title}`}
							describedBy={error ? `${ids}-${slug}-error` : undefined}
							disabled={!endpoint.enabled}
							lineWrapping
							invalid={Boolean(error)}
							onValidate={(problem) =>
								setBlurErrors((all) => ({ ...all, [key]: problem }))
							}
							className="min-h-14"
						/>
						{error ? (
							<p id={`${ids}-${slug}-error`} className="m-0 text-error text-xs">
								{error}
							</p>
						) : null}
						{mockPowerUps ? (
							<EndpointBehaviorSection
								endpoint={endpoint}
								title={title}
								slug={slug}
								errors={behaviorErrors[key]}
								onChange={(patch) => update(key, patch)}
							/>
						) : null}
					</div>
				);
			})}
			<p className="m-0 text-[0.8125rem] text-muted">
				{renderRich(t("resources.endpoints.variables"))}
			</p>
		</section>
	);
}
