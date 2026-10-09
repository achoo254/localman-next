import type { ApiRequestDraft } from "@localman/shared/api-client";
import { IconChevronDown, IconDownload } from "@tabler/icons-react";
import { memo, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { useToast } from "../../../components/ui/toast";
import { useT } from "../../../i18n/i18n-context";
import { downloadText } from "../../../platform/download";
import {
	type ExportFile,
	type ExportableEnvironment,
	collectionFile,
	environmentFile,
	openApiFile,
} from "./export-files";

type ExportRequests = readonly { id: string; draft: ApiRequestDraft }[];

export interface ExportMenuProps {
	/**
	 * Requests to export (the open tabs), in order. Read when the menu
	 * opens, so editing a tab does not re-render the menu.
	 */
	readRequests: () => ExportRequests;
	/** Collection and file name; "Localman requests" by default. */
	name?: string;
	/** Offered as a third format when given (environments come later). */
	environment?: ExportableEnvironment | null;
}

/** Export menu: Collection v2.1 or OpenAPI 3.0 of the requests, or an environment. */
export const ExportMenu = memo(function ExportMenu({
	readRequests,
	name,
	environment = null,
}: ExportMenuProps) {
	const t = useT();
	const toast = useToast();
	const [requests, setRequests] = useState<ExportRequests>([]);
	const title = name?.trim() || t("apiClientTools.import.export.defaultName");
	const empty = requests.length === 0;

	const save = (file: ExportFile): void => {
		downloadText(file.filename, file.json, "application/json;charset=utf-8");
		toast.show({
			tone: "success",
			title: t("apiClientTools.import.export.downloaded", {
				file: file.filename,
			}),
			description:
				file.skipped > 0
					? t("apiClientTools.import.export.skipped", { count: file.skipped })
					: undefined,
		});
	};

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) setRequests(readRequests());
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					data-id="export-menu"
					aria-label={t("apiClientTools.import.export.label")}
				>
					<IconDownload size={16} aria-hidden="true" />
					{t("apiClientTools.import.export.trigger")}
					<IconChevronDown size={14} aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{empty ? (
					<DropdownMenuLabel>
						{t("apiClientTools.import.export.nothing")}
					</DropdownMenuLabel>
				) : null}
				<DropdownMenuItem
					data-id="export-menu-collection"
					disabled={empty}
					onSelect={() => save(collectionFile(title, requests))}
				>
					{t("apiClientTools.import.export.collection")}
				</DropdownMenuItem>
				<DropdownMenuItem
					data-id="export-menu-openapi"
					disabled={empty}
					onSelect={() => save(openApiFile(title, requests))}
				>
					{t("apiClientTools.import.export.openapi")}
				</DropdownMenuItem>
				{environment ? (
					<>
						<DropdownMenuItem
							data-id="export-menu-environment"
							onSelect={() => save(environmentFile(environment))}
						>
							{t("apiClientTools.import.export.environment")}
						</DropdownMenuItem>
						{environment.variables.some((v) => v.secret) ? (
							<DropdownMenuLabel>
								{t("apiClientTools.import.export.secretsBlank")}
							</DropdownMenuLabel>
						) : null}
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
