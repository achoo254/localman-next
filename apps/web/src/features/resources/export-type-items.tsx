import { IconCopy, IconDownload } from "@tabler/icons-react";
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { copyText } from "../../platform/clipboard";
import { downloadText } from "../../platform/download";
import { type TypeFormat, exportTypes } from "./export-types";
import type { Resource } from "./resource-model";

export interface ExportTypeItemsProps {
	resource: Resource;
	resources: readonly Resource[];
	/** Result of a copy or download, to show the way the menu's owner wants. */
	onResult: (text: string, ok: boolean) => void;
	/** A separator between the TypeScript and the Zod items. */
	separated?: boolean;
}

/**
 * Menu items that copy or download the TypeScript interfaces or Zod
 * schemas of a saved resource (with the related resources its relation
 * fields embed), built in the browser by the shared exporters. Shared by
 * the resource form's menu and a tree node's "⋯" menu; items keep the
 * `export-types-{format}-{copy|download}` ids.
 */
export function ExportTypeItems({
	resource,
	resources,
	onResult,
	separated = false,
}: ExportTypeItemsProps) {
	const t = useT();
	const { name } = resource;

	async function copy(format: TypeFormat) {
		const { code } = exportTypes(format, resource, resources);
		if (!(await copyText(code))) {
			onResult(t("resourceExport.copyBlocked"), false);
			return;
		}
		const key =
			format === "ts" ? "resourceExport.copiedTs" : "resourceExport.copiedZod";
		onResult(t(key, { name }), true);
	}

	function download(format: TypeFormat) {
		const { code, fileName } = exportTypes(format, resource, resources);
		downloadText(fileName, code, "text/typescript;charset=utf-8");
		onResult(t("resourceExport.downloaded", { file: fileName }), true);
	}

	const items = (format: TypeFormat) => {
		const file = format === "ts" ? `${name}.ts` : `${name}.schema.ts`;
		return [
			<DropdownMenuItem
				key={`${format}-copy`}
				icon={<IconCopy size={16} aria-hidden="true" />}
				className="pointer-coarse:min-h-11"
				data-id={`export-types-${format}-copy`}
				onSelect={() => void copy(format)}
			>
				{t(
					format === "ts" ? "resourceExport.copyTs" : "resourceExport.copyZod",
				)}
			</DropdownMenuItem>,
			<DropdownMenuItem
				key={`${format}-download`}
				icon={<IconDownload size={16} aria-hidden="true" />}
				className="pointer-coarse:min-h-11"
				data-id={`export-types-${format}-download`}
				onSelect={() => download(format)}
			>
				<span className="min-w-0 break-all">
					{renderRich(t("resourceExport.download", { file }))}
				</span>
			</DropdownMenuItem>,
		];
	};

	return (
		<>
			{items("ts")}
			{separated ? <DropdownMenuSeparator /> : null}
			{items("zod")}
		</>
	);
}
