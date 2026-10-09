import { useId, useState } from "react";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { JsonEditor } from "../../components/ui/json-editor";
import { cn } from "../../lib/cn";
import { type EndpointDraft, endpointKey } from "./resource-form-state";
import type { EndpointMethod } from "./resource-model";

export interface EndpointsEditorProps {
	endpoints: EndpointDraft[];
	onChange: (endpoints: EndpointDraft[]) => void;
	/** Resource name shown in the paths (`/users/:id`). */
	resourceName: string;
	/** Errors by `endpointKey`. */
	errors: Record<string, string>;
}

const METHOD_TONES: Readonly<Record<EndpointMethod, BadgeTone>> = {
	GET: "info",
	POST: "success",
	PUT: "warning",
	DELETE: "danger",
};

const LABELS: Readonly<Record<string, string>> = {
	"GET /:res": "Danh sách",
	"GET /:res/:id": "Một bản ghi",
	"POST /:res": "Tạo",
	"PUT /:res/:id": "Cập nhật (PUT, PATCH)",
	"DELETE /:res/:id": "Xoá",
};

/**
 * The five generated endpoints: each can be switched off (the mock then
 * answers 404) and has a response template. Open on every plan.
 */
export function EndpointsEditor({
	endpoints,
	onChange,
	resourceName,
	errors,
}: EndpointsEditorProps) {
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
							<button
								type="button"
								role="switch"
								aria-checked={endpoint.enabled}
								aria-label={`Bật ${title}`}
								className={cn(
									"relative inline-flex h-5 w-9 flex-none cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors",
									endpoint.enabled ? "bg-primary-solid" : "bg-border-strong",
								)}
								onClick={() => update(key, { enabled: !endpoint.enabled })}
							>
								<span
									aria-hidden="true"
									className={cn(
										"size-3.5 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none",
										endpoint.enabled && "translate-x-4",
									)}
								/>
							</button>
							<Badge tone={METHOD_TONES[endpoint.method]}>
								{endpoint.method}
							</Badge>
							<code className="font-semibold">{path}</code>
							<span className="ml-auto text-muted text-xs">{LABELS[key]}</span>
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
					</div>
				);
			})}
			<p className="m-0 text-[0.8125rem] text-muted">
				Biến trong template: <code>"$mockData"</code> dữ liệu đang lưu,{" "}
				<code>"$count"</code> số bản ghi, <code>"$category.method"</code> giá
				trị Faker sinh mỗi request (ví dụ <code>"$name.fullName"</code>).
			</p>
		</section>
	);
}
