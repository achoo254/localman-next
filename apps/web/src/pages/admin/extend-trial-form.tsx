import {
	TRIAL_DIRECT_EXTENSION_MAX_DAYS,
	TRIAL_EXTENSION_DAYS,
} from "@localman/shared/constants";
import { type FormEvent, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import {
	adminTrialErrorMessage,
	extendUserTrial,
} from "./trial-extensions-api";

interface FieldErrors {
	sub?: string;
	days?: string;
}

/** Whole days within 1..max, or null. */
export function parseDays(value: string): number | null {
	if (!/^\d+$/.test(value.trim())) return null;
	const days = Number(value);
	return days >= 1 && days <= TRIAL_DIRECT_EXTENSION_MAX_DAYS ? days : null;
}

/** "Extend a user's trial": the owner adds days to any account, no request needed. */
export function ExtendTrialForm({ onExtended }: { onExtended: () => void }) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const headingId = useId();
	const [sub, setSub] = useState("");
	const [days, setDays] = useState(String(TRIAL_EXTENSION_DAYS));
	const [errors, setErrors] = useState<FieldErrors>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const max = TRIAL_DIRECT_EXTENSION_MAX_DAYS;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const target = sub.trim();
		const count = parseDays(days);
		const next: FieldErrors = {
			sub: target ? undefined : t("admin.trial.extend.subEmpty"),
			days:
				count === null
					? t("admin.trial.extend.daysInvalid", { max })
					: undefined,
		};
		setErrors(next);
		setFailure(null);
		if (!target || count === null) return;
		setBusy(true);
		try {
			const endsAt = await extendUserTrial(target, count);
			toast.show({
				title: endsAt
					? t("admin.trial.extend.doneUntil", {
							count,
							sub: target,
							date: formatDate(endsAt),
						})
					: t("admin.trial.extend.done", { count, sub: target }),
			});
			setSub("");
			onExtended();
		} catch (error) {
			setFailure(adminTrialErrorMessage(error, t, "user"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			data-id="admin-trial-extend"
			aria-labelledby={headingId}
			className={cn(cardClassName, "grid gap-4 p-6")}
		>
			<div className="grid gap-1">
				<h2 id={headingId} className="m-0 font-bold font-mono text-base">
					{t("admin.trial.extend.title")}
				</h2>
				<p className="m-0 text-muted text-sm">{t("admin.trial.extend.lead")}</p>
			</div>
			{failure ? (
				<Alert tone="danger" data-id="admin-trial-extend-error">
					{failure}
				</Alert>
			) : null}
			<form
				noValidate
				onSubmit={(event) => void submit(event)}
				className="flex flex-wrap items-start gap-3"
			>
				<FormField
					label={t("admin.trial.extend.sub")}
					hint={t("admin.trial.extend.subHint")}
					error={errors.sub}
					required
					className="min-w-0 flex-[2_1_14rem]"
					data-id="admin-trial-extend-sub"
				>
					<Input
						value={sub}
						autoComplete="off"
						onChange={(event) => setSub(event.target.value)}
					/>
				</FormField>
				<FormField
					label={t("admin.trial.extend.days")}
					hint={t("admin.trial.extend.daysHint", { max })}
					error={errors.days}
					required
					className="min-w-0 flex-[1_1_8rem]"
					data-id="admin-trial-extend-days"
				>
					<Input
						type="number"
						inputMode="numeric"
						min={1}
						max={max}
						value={days}
						onChange={(event) => setDays(event.target.value)}
					/>
				</FormField>
				<Button
					type="submit"
					variant="primary"
					loading={busy}
					className="mt-6"
					data-id="admin-trial-extend-submit"
				>
					{t("admin.trial.extend.submit")}
				</Button>
			</form>
		</section>
	);
}
