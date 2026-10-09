import type { ClientResponse } from "@localman/shared/api-client";
import { useEffect, useState } from "react";
import { useT } from "../../../i18n/i18n-context";
import { HtmlPreview } from "./html-preview";
import { JsonTablePreview } from "./json-table-preview";
import { type PreviewKind, bodyBytes, mediaTypeOf } from "./response-content";

/** An object URL for the body, revoked when the body changes or unmounts. */
function useBodyObjectUrl(response: ClientResponse): string | null {
	const [url, setUrl] = useState<string | null>(null);
	useEffect(() => {
		const blob = new Blob([bodyBytes(response).slice()], {
			type: mediaTypeOf(response),
		});
		const next = URL.createObjectURL(blob);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [response]);
	return url;
}

/**
 * An image shown from a blob URL: `<img>` never runs scripts, so even an
 * SVG body is inert here.
 */
function ImagePreview({ response }: { response: ClientResponse }) {
	const t = useT();
	const url = useBodyObjectUrl(response);
	return (
		<div
			data-id="response-body-preview"
			className="grid min-h-0 flex-1 place-items-center overflow-auto p-4"
		>
			{url ? (
				<img
					src={url}
					alt={t("apiClientTools.response.body.previewImage")}
					className="max-h-full max-w-full rounded-sm border border-border-subtle"
				/>
			) : null}
		</div>
	);
}

export interface BodyPreviewProps {
	response: ClientResponse;
	kind: PreviewKind;
}

/** The Preview mode: HTML in a sandbox, an image, JSON as a table. */
export function BodyPreview({ response, kind }: BodyPreviewProps) {
	const t = useT();
	switch (kind) {
		case "html":
			return <HtmlPreview html={response.body} />;
		case "image":
			return <ImagePreview response={response} />;
		case "json":
			return <JsonTablePreview json={response.body} />;
		case "none":
			return (
				<p
					data-id="response-body-preview"
					className="m-0 p-4 text-muted text-sm"
				>
					{t("apiClientTools.response.body.previewNone")}
				</p>
			);
	}
}
