import { IconBraces, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { COPIED_RESET_MS } from "../../components/ui/copy-field";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { ExportTypeItems } from "./export-type-items";
import type { Resource } from "./resource-model";

export interface ExportTypesMenuProps {
	resource: Resource;
	resources: readonly Resource[];
	/** The form holds changes the export (of the saved schema) leaves out. */
	unsaved?: boolean;
	"data-id": string;
}

/**
 * "Export types" button of the resource form: copy or download the
 * TypeScript interfaces or Zod schemas of the saved resource. The result
 * is announced politely and the icon turns into a check for a moment.
 * Tree nodes reach the same items through their "⋯" menu.
 */
export function ExportTypesMenu({
	resource,
	resources,
	unsaved = false,
	"data-id": dataId,
}: ExportTypesMenuProps) {
	const t = useT();
	const [message, setMessage] = useState("");
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
		return () => window.clearTimeout(timer);
	}, [copied]);

	return (
		<span className="inline-flex items-center">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						data-id={dataId}
						leadingIcon={
							copied ? (
								<IconCheck
									size={16}
									aria-hidden="true"
									className="text-success"
								/>
							) : (
								<IconBraces size={16} aria-hidden="true" />
							)
						}
					>
						{t("resourceExport.trigger")}
						<IconChevronDown size={16} aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{unsaved ? (
						<DropdownMenuLabel className="max-w-72 font-sans">
							{t("resourceExport.savedOnly")}
						</DropdownMenuLabel>
					) : null}
					<ExportTypeItems
						resource={resource}
						resources={resources}
						separated
						onResult={(text, ok) => {
							setMessage(text);
							setCopied(ok);
						}}
					/>
				</DropdownMenuContent>
			</DropdownMenu>
			<span aria-live="polite" className="sr-only">
				{message}
			</span>
		</span>
	);
}
