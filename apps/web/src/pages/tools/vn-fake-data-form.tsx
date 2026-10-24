import {
	VN_FAKE_DATA_LOCALES,
	VN_FAKE_DATA_MAX_COUNT,
	VN_FAKE_DATA_MIN_COUNT,
	VN_FAKE_DATA_TYPES,
	isVnFakeDataLocale,
	isVnFakeDataType,
} from "@localman/shared/vn-fake-data";
import { IconRefresh } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useT } from "../../i18n/i18n-context";
import type { VnFakeDataState } from "./use-vn-fake-data";

/** Type, count and language of the fake data, and "Generate new data". */
export function VnFakeDataForm({ state }: { state: VnFakeDataState }) {
	const t = useT();
	return (
		<fieldset
			data-id="vn-fake-data-form"
			className="m-0 grid min-w-0 items-end gap-4 border-0 p-0 sm:grid-cols-[1fr_8rem_1fr_auto]"
		>
			<legend className="sr-only">{t("vnFakeData.form.legend")}</legend>
			<FormField label={t("vnFakeData.form.type")} data-id="vn-fake-data-type">
				<Select
					value={state.type}
					onChange={(event) => {
						const { value } = event.target;
						if (isVnFakeDataType(value)) state.setType(value);
					}}
				>
					{VN_FAKE_DATA_TYPES.map((type) => (
						<option key={type} value={type}>
							{t(`vnFakeData.types.${type}`)}
						</option>
					))}
				</Select>
			</FormField>
			<FormField
				label={t("vnFakeData.form.count")}
				data-id="vn-fake-data-count"
				hint={
					state.countValid
						? t("vnFakeData.form.countHint", { max: VN_FAKE_DATA_MAX_COUNT })
						: undefined
				}
				error={
					state.countValid
						? undefined
						: t("vnFakeData.form.countError", { max: VN_FAKE_DATA_MAX_COUNT })
				}
			>
				<Input
					type="number"
					inputMode="numeric"
					min={VN_FAKE_DATA_MIN_COUNT}
					max={VN_FAKE_DATA_MAX_COUNT}
					step={1}
					value={state.countText}
					onChange={(event) => state.setCountText(event.target.value)}
				/>
			</FormField>
			<FormField
				label={t("vnFakeData.form.locale")}
				data-id="vn-fake-data-locale"
			>
				<Select
					value={state.locale}
					onChange={(event) => {
						const { value } = event.target;
						if (isVnFakeDataLocale(value)) state.setLocale(value);
					}}
				>
					{VN_FAKE_DATA_LOCALES.map((locale) => (
						<option key={locale} value={locale}>
							{t(`vnFakeData.locales.${locale}`)}
						</option>
					))}
				</Select>
			</FormField>
			<Button
				variant="primary"
				data-id="vn-fake-data-generate"
				leadingIcon={<IconRefresh size={16} aria-hidden="true" />}
				onClick={state.regenerate}
				className="min-h-11"
			>
				{t("vnFakeData.form.generate")}
			</Button>
		</fieldset>
	);
}
