import { IconCopy, IconDownload, IconSearch } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import { Badge } from "../../../components/ui/badge";
import { IconButton } from "../../../components/ui/icon-button";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useT } from "../../../i18n/i18n-context";
import { MAX_SEARCH_MATCHES } from "./body-search";

export type BodyMode = "pretty" | "raw" | "preview";

export interface BodyToolbarProps {
	mode: BodyMode;
	onModeChange: (mode: BodyMode) => void;
	mediaType: string;
	/** Search applies (a text view of a text body). */
	searchable: boolean;
	query: string;
	onQueryChange: (query: string) => void;
	matchCount: number;
	/** Enter / Shift+Enter in the search box: next or previous match. */
	onStep: (step: 1 | -1) => void;
	canCopy: boolean;
	onCopy: () => void;
	onSave: () => void;
}

export function BodyToolbar({
	mode,
	onModeChange,
	mediaType,
	searchable,
	query,
	onQueryChange,
	matchCount,
	onStep,
	canCopy,
	onCopy,
	onSave,
}: BodyToolbarProps) {
	const t = useT();
	const step = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		onStep(event.shiftKey ? -1 : 1);
	};
	return (
		<div className="flex flex-wrap items-center gap-2 border-border-subtle border-b px-4 py-2">
			<SegmentedControl<BodyMode>
				legend={t("apiClientTools.response.body.modes")}
				value={mode}
				onChange={onModeChange}
				data-id="response-modes"
				options={[
					{
						value: "pretty",
						label: t("apiClientTools.response.body.pretty"),
						"data-id": "response-mode-pretty",
					},
					{
						value: "raw",
						label: t("apiClientTools.response.body.raw"),
						"data-id": "response-mode-raw",
					},
					{
						value: "preview",
						label: t("apiClientTools.response.body.preview"),
						"data-id": "response-mode-preview",
					},
				]}
			/>
			{mediaType ? <Badge className="normal-case">{mediaType}</Badge> : null}
			<span className="ml-auto flex items-center gap-1">
				{searchable ? (
					<label className="relative flex items-center">
						<IconSearch
							size={14}
							aria-hidden="true"
							className="pointer-events-none absolute left-2 text-icon-muted"
						/>
						<span className="sr-only">
							{t("apiClientTools.response.body.search")}
						</span>
						<input
							type="search"
							value={query}
							placeholder={t("apiClientTools.response.body.search")}
							data-id="response-search"
							onChange={(event) => onQueryChange(event.target.value)}
							onKeyDown={step}
							className="min-h-8 w-44 rounded-sm border border-border-strong bg-surface py-1 pr-2 pl-7 font-mono text-fg text-xs focus:border-primary focus:shadow-focus-primary focus:outline-none"
						/>
					</label>
				) : null}
				{searchable && query.trim() ? (
					<output
						data-id="response-search-count"
						className="whitespace-nowrap font-mono text-muted text-xs"
					>
						{matchCount >= MAX_SEARCH_MATCHES
							? t("apiClientTools.response.body.matchesCapped", {
									count: matchCount,
								})
							: t("apiClientTools.response.body.matches", {
									count: matchCount,
								})}
					</output>
				) : null}
				<IconButton
					size="sm"
					label={t("apiClientTools.response.body.copy")}
					icon={<IconCopy size={16} aria-hidden="true" />}
					data-id="response-copy"
					disabled={!canCopy}
					onClick={onCopy}
				/>
				<IconButton
					size="sm"
					label={t("apiClientTools.response.body.save")}
					icon={<IconDownload size={16} aria-hidden="true" />}
					data-id="response-save"
					onClick={onSave}
				/>
			</span>
		</div>
	);
}
