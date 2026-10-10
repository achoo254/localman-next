import { IconPlus, IconX } from "@tabler/icons-react";
import { Fragment, useId } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Input } from "../../components/ui/input";
import { useT } from "../../i18n/i18n-context";
import { type HeaderDraft, newHeader } from "./callback-draft";

export interface CallbackHeadersProps {
	headers: HeaderDraft[];
	onChange: (headers: HeaderDraft[]) => void;
	manage: boolean;
	/** Whole-group error, and errors by row key. */
	error?: string;
	rowErrors?: Record<string, string>;
}

const ERROR = "col-span-3 m-0 text-[0.8125rem] text-error";

/**
 * Name / value rows of a callback. A value the server keeps hidden shows
 * as an empty password field: left alone, the stored value stays.
 */
export function CallbackHeaders({
	headers,
	onChange,
	manage,
	error,
	rowErrors = {},
}: CallbackHeadersProps) {
	const t = useT();
	const id = useId();
	const edit = (key: string, patch: Partial<HeaderDraft>) =>
		onChange(
			headers.map((row) => (row.key === key ? { ...row, ...patch } : row)),
		);
	const anyHidden = headers.some((row) => row.hidden);
	return (
		<fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
			<legend className="mb-2 p-0 font-mono font-semibold text-[0.8125rem]">
				{t("mockCallbacks.item.headers")}
			</legend>
			{headers.length > 0 ? (
				<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2.25rem] items-center gap-2">
					{headers.map((row, index) => {
						const i = String(index + 1);
						const rowError = rowErrors[row.key];
						const errorId = `${id}-${row.key}-error`;
						return (
							<Fragment key={row.key}>
								<Input
									value={row.name}
									placeholder="X-Hook-Secret"
									aria-label={t("mockCallbacks.item.headerName", { i })}
									autoComplete="off"
									spellCheck={false}
									disabled={!manage}
									invalid={Boolean(rowError)}
									aria-describedby={rowError ? errorId : undefined}
									onChange={(event) =>
										edit(row.key, { name: event.target.value })
									}
								/>
								<Input
									type={row.hidden ? "password" : "text"}
									value={row.value}
									placeholder={
										row.hidden
											? t("mockCallbacks.item.hiddenPlaceholder")
											: t("mockCallbacks.item.valuePlaceholder")
									}
									aria-label={t("mockCallbacks.item.headerValue", { i })}
									autoComplete={row.hidden ? "new-password" : "off"}
									spellCheck={false}
									disabled={!manage}
									onChange={(event) =>
										edit(row.key, { value: event.target.value })
									}
								/>
								{manage ? (
									<IconButton
										size="sm"
										label={t("mockCallbacks.item.removeHeader", {
											name: row.name.trim() || i,
										})}
										icon={<IconX size={16} aria-hidden="true" />}
										onClick={() =>
											onChange(headers.filter((item) => item.key !== row.key))
										}
									/>
								) : (
									<span />
								)}
								{rowError ? (
									<p id={errorId} className={ERROR}>
										{rowError}
									</p>
								) : null}
							</Fragment>
						);
					})}
				</div>
			) : null}
			{anyHidden && manage ? (
				<p className="m-0 text-muted text-xs">
					{t("mockCallbacks.item.hiddenHint")}
				</p>
			) : null}
			{error ? (
				<p className="m-0 text-[0.8125rem] text-error">{error}</p>
			) : null}
			{manage ? (
				<div>
					<Button
						variant="ghost"
						size="sm"
						leadingIcon={<IconPlus size={16} aria-hidden="true" />}
						onClick={() => onChange([...headers, newHeader()])}
						data-id="resource-form-callback-add-header"
					>
						{t("mockCallbacks.item.addHeader")}
					</Button>
				</div>
			) : null}
		</fieldset>
	);
}
