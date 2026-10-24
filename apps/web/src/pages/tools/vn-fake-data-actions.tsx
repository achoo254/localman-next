import {
	type VnFakeDataType,
	type VnFakeRecord,
	vnFakeDataToCsv,
} from "@localman/shared/vn-fake-data";
import { IconCopy, IconDownload } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { downloadText } from "../../platform/download";

/** Byte order mark: spreadsheet apps then read the CSV as UTF-8 (diacritics). */
const UTF8_BOM = "﻿";

/** Copy as JSON, download as CSV or JSON; files are named `fake-{type}`. */
export function VnFakeDataActions({
	type,
	records,
}: {
	type: VnFakeDataType;
	records: readonly VnFakeRecord[];
}) {
	const t = useT();
	const toast = useToast();
	const json = () => `${JSON.stringify(records, null, 2)}\n`;

	const copy = async () => {
		if (await copyText(json())) {
			toast.show({
				tone: "success",
				title: t("vnFakeData.actions.copied", { count: records.length }),
			});
			return;
		}
		toast.show({ tone: "error", title: t("vnFakeData.actions.copyBlocked") });
	};

	const download = (format: "csv" | "json") => {
		const file = `fake-${type}.${format}`;
		if (format === "csv") {
			downloadText(file, UTF8_BOM + vnFakeDataToCsv(type, records));
		} else {
			downloadText(file, json(), "application/json;charset=utf-8");
		}
		toast.show({
			tone: "success",
			title: t("vnFakeData.actions.downloaded", { file }),
		});
	};

	return (
		<div className="flex flex-wrap gap-2">
			<Button
				size="sm"
				data-id="vn-fake-data-copy"
				leadingIcon={<IconCopy size={16} aria-hidden="true" />}
				onClick={() => void copy()}
			>
				{t("vnFakeData.actions.copy")}
			</Button>
			<Button
				size="sm"
				data-id="vn-fake-data-download-csv"
				leadingIcon={<IconDownload size={16} aria-hidden="true" />}
				onClick={() => download("csv")}
			>
				{t("vnFakeData.actions.downloadCsv")}
			</Button>
			<Button
				size="sm"
				data-id="vn-fake-data-download-json"
				leadingIcon={<IconDownload size={16} aria-hidden="true" />}
				onClick={() => download("json")}
			>
				{t("vnFakeData.actions.downloadJson")}
			</Button>
		</div>
	);
}
