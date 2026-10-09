import {
	IconBraces,
	IconCheck,
	IconChevronDown,
	IconCopy,
	IconDownload,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { COPIED_RESET_MS } from "../../components/ui/copy-field";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useToast } from "../../components/ui/toast";
import { Tooltip } from "../../components/ui/tooltip";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { copyText } from "../../platform/clipboard";
import { downloadText } from "../../platform/download";
import { type TypeFormat, exportTypes } from "./export-types";
import type { Resource } from "./resource-model";

export interface ExportTypesMenuProps {
	resource: Resource;
	resources: readonly Resource[];
	/** Icon on a tree node (results as toasts) or button in the resource form. */
	variant: "node" | "form";
	/** The form holds changes the export (of the saved schema) leaves out. */
	unsaved?: boolean;
	"data-id": string;
}

const NODE_TRIGGER =
	"relative ml-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-xs border-0 bg-transparent text-muted " +
	"transition-[background-color,color] hover:bg-fg/6 hover:text-fg " +
	"pointer-coarse:before:-inset-2 before:absolute before:inset-0 before:content-['']";

/**
 * Copy or download the TypeScript interfaces or Zod schemas of a saved
 * resource (with the related resources its relation fields embed). Built
 * in the browser by the shared exporters, so it works offline.
 */
export function ExportTypesMenu({
	resource,
	resources,
	variant,
	unsaved = false,
	"data-id": dataId,
}: ExportTypesMenuProps) {
	const t = useT();
	const toast = useToast();
	const [message, setMessage] = useState("");
	const [copied, setCopied] = useState(false);
	const { name } = resource;

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
		return () => window.clearTimeout(timer);
	}, [copied]);

	function report(text: string, ok: boolean) {
		if (variant === "node")
			toast.show({ title: text, tone: ok ? "success" : "info" });
		else {
			setMessage(text);
			setCopied(ok);
		}
	}

	async function copy(format: TypeFormat) {
		const { code } = exportTypes(format, resource, resources);
		const ok = await copyText(code);
		if (!ok) return report(t("resourceExport.copyBlocked"), false);
		report(
			t(
				format === "ts"
					? "resourceExport.copiedTs"
					: "resourceExport.copiedZod",
				{ name },
			),
			true,
		);
	}

	function download(format: TypeFormat) {
		const { code, fileName } = exportTypes(format, resource, resources);
		downloadText(fileName, code, "text/typescript;charset=utf-8");
		report(t("resourceExport.downloaded", { file: fileName }), true);
	}

	const item = (format: TypeFormat) => {
		const file = format === "ts" ? `${name}.ts` : `${name}.schema.ts`;
		return (
			<>
				<DropdownMenuItem
					icon={<IconCopy size={16} aria-hidden="true" />}
					className="pointer-coarse:min-h-11"
					data-id={`export-types-${format}-copy`}
					onSelect={() => void copy(format)}
				>
					{t(
						format === "ts"
							? "resourceExport.copyTs"
							: "resourceExport.copyZod",
					)}
				</DropdownMenuItem>
				<DropdownMenuItem
					icon={<IconDownload size={16} aria-hidden="true" />}
					className="pointer-coarse:min-h-11"
					data-id={`export-types-${format}-download`}
					onSelect={() => download(format)}
				>
					<span>{renderRich(t("resourceExport.download", { file }))}</span>
				</DropdownMenuItem>
			</>
		);
	};

	const menu = (
		<DropdownMenuContent align="end">
			{unsaved ? (
				<DropdownMenuLabel className="max-w-72 font-sans">
					{t("resourceExport.savedOnly")}
				</DropdownMenuLabel>
			) : null}
			{item("ts")}
			<DropdownMenuSeparator />
			{item("zod")}
		</DropdownMenuContent>
	);

	if (variant === "node") {
		return (
			<DropdownMenu>
				<Tooltip content={t("resourceExport.trigger")}>
					<DropdownMenuTrigger
						className={NODE_TRIGGER}
						aria-label={t("resourceExport.triggerLabel", { name })}
						data-id={dataId}
					>
						<IconBraces size={16} aria-hidden="true" />
					</DropdownMenuTrigger>
				</Tooltip>
				{menu}
			</DropdownMenu>
		);
	}
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
				{menu}
			</DropdownMenu>
			<span aria-live="polite" className="sr-only">
				{message}
			</span>
		</span>
	);
}
