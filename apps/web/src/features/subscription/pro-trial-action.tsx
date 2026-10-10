import { TRIAL_DAYS } from "@localman/shared/constants";
import type { ReactNode } from "react";
import { Button, buttonClassName } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { LoginLink } from "../auth/login-link";
import { AppLink } from "./app-link";
import {
	type TrialViewer,
	canRequestExtension,
	trialDaysLeft,
	trialView,
} from "./trial-state";

/** Guests sign in and land back on pricing with the confirmation open. */
export const TRIAL_START_RETURN_TO = "/pricing?trial=start";
export const ACCOUNT_PATH = "/account";

const PRIMARY_CLASS = cn(
	buttonClassName({ variant: "primary", block: true }),
	"no-underline",
);
/** Same box as a button, for states with nothing to click. */
const STATUS_CLASS =
	"m-0 flex min-h-10 items-center justify-center rounded-md border border-border-subtle px-4 text-center font-mono font-semibold text-sm pointer-coarse:min-h-11";
const SECONDARY_CLASS = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"no-underline",
);

export interface ProTrialActionProps {
	/** Signed-in user, or null for a visitor and while the session is unknown. */
	user: TrialViewer | null;
	onStart: () => void;
	/** Opens the Pro interest form, kept as a secondary link. */
	onTellUs: () => void;
	/** Runs before a link leaves for the account page (closes a dialog). */
	onNavigate?: () => void;
	/** Prefix of the `-cta`, `-secondary` and `-paid-note` ids. */
	"data-id": string;
}

/**
 * Pro card action by trial state. Every state keeps the same three rows (main
 * control, secondary link, note), so the card does not move when the
 * prerendered visitor version turns into the signed-in one.
 */
export function ProTrialAction({
	user,
	onStart,
	onTellUs,
	onNavigate,
	"data-id": dataId,
}: ProTrialActionProps) {
	const t = useT();
	const view = trialView(user);
	const cta = `${dataId}-cta`;
	const secondaryId = `${dataId}-secondary`;

	const tellUs = (
		<button
			type="button"
			data-id={secondaryId}
			className={SECONDARY_CLASS}
			onClick={onTellUs}
		>
			{t("trial.tellUs")}
		</button>
	);
	const accountLink = (label: string) => (
		<AppLink
			to={ACCOUNT_PATH}
			data-id={secondaryId}
			className={SECONDARY_CLASS}
			onClick={onNavigate}
		>
			{label}
		</AppLink>
	);

	let main: ReactNode;
	let secondary: ReactNode = null;
	if (view === "guest") {
		main = (
			<LoginLink
				returnTo={TRIAL_START_RETURN_TO}
				data-id={cta}
				className={PRIMARY_CLASS}
			>
				{t("trial.startGuest")}
			</LoginLink>
		);
		secondary = tellUs;
	} else if (view === "available") {
		main = (
			<Button variant="primary" block data-id={cta} onClick={onStart}>
				{t("trial.start", { days: TRIAL_DAYS })}
			</Button>
		);
		secondary = tellUs;
	} else if (view === "active") {
		const days = trialDaysLeft(user?.trial.endsAt ?? null) ?? 0;
		main = (
			<p data-id={cta} className={STATUS_CLASS}>
				{days === 0 ? t("trial.endsToday") : t("trial.endsIn", { count: days })}
			</p>
		);
		secondary = accountLink(t("trial.viewAccount"));
	} else if (view === "used") {
		main = (
			<p data-id={cta} className={STATUS_CLASS}>
				{t("trial.used")}
			</p>
		);
		secondary =
			user && canRequestExtension(user.trial)
				? accountLink(t("trial.requestExtension"))
				: tellUs;
	} else {
		main = (
			<p data-id={cta} className={STATUS_CLASS}>
				{t("subscription.manage.currentBadge")}
			</p>
		);
	}

	return (
		<div className="grid gap-2">
			{main}
			<div className="flex min-h-8 justify-center pointer-coarse:min-h-10">
				{secondary}
			</div>
			<p
				data-id={`${dataId}-paid-note`}
				className="m-0 text-center text-[0.8125rem] text-muted"
			>
				{t("trial.paidNote")}
			</p>
		</div>
	);
}
