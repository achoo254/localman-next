import {
	type KeyValueRow,
	type RequestAuth,
	type RequestBody,
	isSensitiveName,
} from "@localman/shared/api-client";
import { type ReactNode, useId } from "react";
import { Badge } from "../../components/ui/badge";
import { CodeBlock } from "../../components/ui/code-block";
import { useT } from "../../i18n/i18n-context";

/** A credential the server blanked before publishing. */
export function HiddenValue() {
	const t = useT();
	return <Badge tone="neutral">{t("publicSharing.view.page.hidden")}</Badge>;
}

/** The value as published; an empty credential reads "hidden". */
export function PublishedValue({
	value,
	credential,
}: {
	value: string;
	/** Redaction blanks this value when it was typed in. */
	credential: boolean;
}) {
	if (value === "" && credential) return <HiddenValue />;
	return <span className="break-all font-mono text-[0.8125rem]">{value}</span>;
}

export function ViewSection({
	title,
	children,
	"data-id": dataId,
}: {
	title: string;
	children: ReactNode;
	"data-id"?: string;
}) {
	const id = useId();
	return (
		<section aria-labelledby={id} className="grid gap-2" data-id={dataId}>
			<h3 id={id} className="m-0 font-mono font-semibold text-sm">
				{title}
			</h3>
			{children}
		</section>
	);
}

/** Rows of a params or headers table; disabled rows are marked "off". */
export function KeyValueList({ rows }: { rows: readonly KeyValueRow[] }) {
	const t = useT();
	return (
		<dl className="m-0 grid gap-1 text-sm">
			{rows.map((row) => (
				<div
					key={row.id}
					className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-border-subtle border-b py-1.5 last:border-b-0"
				>
					<dt className="break-all font-mono text-[0.8125rem]">
						{row.key}
						{row.enabled ? null : (
							<span className="ml-2 text-muted">
								{t("publicSharing.view.request.disabled")}
							</span>
						)}
					</dt>
					<dd className="m-0 min-w-0">
						<PublishedValue
							value={row.value}
							credential={isSensitiveName(row.key)}
						/>
					</dd>
				</div>
			))}
		</dl>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-sm">
			<dt className="text-muted">{label}</dt>
			<dd className="m-0 min-w-0">{children}</dd>
		</div>
	);
}

/** Auth of a request or folder; typed-in credentials read "hidden". */
export function AuthView({ auth }: { auth: RequestAuth }) {
	const t = useT();
	const type = (
		<p className="m-0 text-sm">
			{t(`publicSharing.view.request.authTypes.${auth.type}`)}
		</p>
	);
	if (auth.type === "inherit" || auth.type === "none") return type;
	return (
		<div className="grid gap-2">
			{type}
			<dl className="m-0 grid gap-1">
				{auth.type === "bearer" ? (
					<Field label={t("publicSharing.view.request.token")}>
						<PublishedValue value={auth.token} credential />
					</Field>
				) : null}
				{auth.type === "basic" ? (
					<>
						<Field label={t("publicSharing.view.request.username")}>
							<PublishedValue value={auth.username} credential />
						</Field>
						<Field label={t("publicSharing.view.request.password")}>
							<PublishedValue value={auth.password} credential />
						</Field>
					</>
				) : null}
				{auth.type === "apikey" ? (
					<>
						<Field label={t("publicSharing.view.request.keyName")}>
							<PublishedValue value={auth.key} credential={false} />
						</Field>
						<Field label={t("publicSharing.view.request.keyValue")}>
							<PublishedValue value={auth.value} credential />
						</Field>
						<Field label={t("publicSharing.view.request.keyIn")}>
							{auth.in === "header"
								? t("publicSharing.view.request.keyInHeader")
								: t("publicSharing.view.request.keyInQuery")}
						</Field>
					</>
				) : null}
			</dl>
		</div>
	);
}

/** The active kind of body only, as it would be sent. */
export function BodyView({ body }: { body: RequestBody }) {
	const t = useT();
	const none = (
		<p className="m-0 text-muted text-sm">
			{t("publicSharing.view.request.noBody")}
		</p>
	);
	switch (body.type) {
		case "raw":
			return body.raw === "" ? (
				none
			) : (
				<CodeBlock
					caption={body.rawLanguage}
					code={body.raw}
					data-id="public-request-body"
				/>
			);
		case "urlencoded":
			return body.urlencoded.length > 0 ? (
				<KeyValueList rows={body.urlencoded} />
			) : (
				none
			);
		case "formdata":
			return body.formData.length > 0 ? (
				<KeyValueList
					rows={body.formData.map((row) =>
						row.kind === "file"
							? {
									...row,
									value: t("publicSharing.view.request.file", {
										name: row.file?.name ?? "",
									}),
								}
							: row,
					)}
				/>
			) : (
				none
			);
		case "binary":
			return body.binary ? (
				<p className="m-0 text-sm">
					{t("publicSharing.view.request.file", { name: body.binary.name })}
				</p>
			) : (
				none
			);
		default:
			return none;
	}
}
