import {
	type ClientResponse,
	MAX_RESPONSE_BODY_BYTES,
} from "@localman/shared/api-client";
import { useMemo, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/toast";
import { useI18n } from "../../../i18n/i18n-context";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { copyText } from "../../../platform/clipboard";
import { downloadBytes } from "../../../platform/download";
import { BodyPreview } from "./body-preview";
import { findMatches } from "./body-search";
import { BodyTextView } from "./body-text-view";
import { type BodyMode, BodyToolbar } from "./body-toolbar";
import {
	bodyBytes,
	bodyFileName,
	formatBytes,
	isBinaryBody,
	mediaTypeOf,
	prettyJson,
	previewKindOf,
} from "./response-content";

/** Body tab: Pretty / Raw / Preview, search, copy and save. */
export function ResponseBody({ response }: { response: ClientResponse }) {
	const { t, formatNumber } = useI18n();
	const toast = useToast();
	const [mode, setMode] = useState<BodyMode>("pretty");
	const [query, setQuery] = useState("");
	const [current, setCurrent] = useState(0);
	const settledQuery = useDebouncedValue(query, 150);

	const binary = isBinaryBody(response);
	const mediaType = mediaTypeOf(response);
	const pretty = useMemo(
		() => (binary ? null : prettyJson(response.body)),
		[binary, response.body],
	);
	const text = mode === "raw" ? response.body : (pretty ?? response.body);
	const searchable = mode !== "preview" && !binary && response.body !== "";
	const matches = useMemo(
		() => (searchable ? findMatches(text, settledQuery) : []),
		[searchable, text, settledQuery],
	);

	const save = (): void => {
		const file = bodyFileName(response);
		downloadBytes(file, bodyBytes(response), mediaType);
		toast.show({
			tone: "success",
			title: t("apiClientTools.response.body.saved", { file }),
		});
	};
	const copy = async (): Promise<void> => {
		const copied = await copyText(response.body);
		toast.show(
			copied
				? { tone: "success", title: t("apiClientTools.response.body.copied") }
				: {
						tone: "error",
						title: t("apiClientTools.response.body.copyBlocked"),
					},
		);
	};
	const step = (delta: 1 | -1): void => {
		if (matches.length === 0) return;
		setCurrent((index) => (index + delta + matches.length) % matches.length);
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<BodyToolbar
				mode={mode}
				onModeChange={setMode}
				mediaType={mediaType}
				searchable={searchable}
				query={query}
				onQueryChange={(next) => {
					setQuery(next);
					setCurrent(0);
				}}
				matchCount={matches.length}
				onStep={step}
				canCopy={!binary && response.body !== ""}
				onCopy={() => void copy()}
				onSave={save}
			/>
			{response.truncated ? (
				<Alert
					tone="warning"
					data-id="response-body-truncated"
					className="mx-4 mt-3"
				>
					{t("apiClientTools.response.body.truncated", {
						max: formatBytes(MAX_RESPONSE_BODY_BYTES, formatNumber),
					})}
				</Alert>
			) : null}
			{mode === "preview" ? (
				<BodyPreview
					response={response}
					kind={previewKindOf(response, pretty !== null)}
				/>
			) : binary ? (
				<div
					data-id="response-body-binary"
					className="grid content-start justify-items-start gap-3 p-4"
				>
					<p className="m-0 text-muted text-sm">
						{t("apiClientTools.response.body.binary", {
							size: formatBytes(response.size, formatNumber),
						})}
					</p>
					<Button size="sm" data-id="response-download" onClick={save}>
						{t("apiClientTools.response.body.save")}
					</Button>
				</div>
			) : response.body === "" ? (
				<p data-id="response-body" className="m-0 p-4 text-muted text-sm">
					{t("apiClientTools.response.body.empty")}
				</p>
			) : (
				<BodyTextView
					text={text}
					highlight={mode === "pretty" && pretty !== null}
					matches={matches}
					current={current}
				/>
			)}
		</div>
	);
}
