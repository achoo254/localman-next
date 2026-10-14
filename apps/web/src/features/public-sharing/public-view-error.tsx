import { IconClockPause, IconLinkOff } from "@tabler/icons-react";
import { Link } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { isNotFound } from "../sharing/sharing-errors";
import {
	isRateLimited,
	publicSharingErrorMessage,
} from "./public-sharing-errors";

export interface PublicViewErrorProps {
	error: unknown;
	onRetry: () => void;
	/** Where the page's way out leads. */
	homePath?: string;
	/** Title of the 404 state (a link, a Run button). */
	notFoundTitle?: string;
	notFoundText?: string;
}

/**
 * Why a public, guest or Run page shows nothing: the link is gone (404,
 * the same answer whatever the reason), too many requests (429), or a
 * failure the visitor can retry.
 */
export function PublicViewError({
	error,
	onRetry,
	homePath = "/",
	notFoundTitle,
	notFoundText,
}: PublicViewErrorProps) {
	const t = useT();
	const home = (
		<Link
			to={homePath}
			data-id="public-view-home"
			className={cn(buttonClassName({ variant: "primary" }), "no-underline")}
		>
			{t("publicSharing.view.page.home")}
		</Link>
	);
	if (isNotFound(error)) {
		return (
			<div className="py-8 md:py-16">
				<EmptyState
					data-id="public-view-not-found"
					headingLevel={1}
					icon={<IconLinkOff size={32} aria-hidden="true" />}
					title={notFoundTitle ?? t("publicSharing.view.page.notFoundTitle")}
					action={home}
				>
					{notFoundText ?? t("publicSharing.view.page.notFoundText")}
				</EmptyState>
			</div>
		);
	}
	if (isRateLimited(error)) {
		return (
			<div className="py-8 md:py-16">
				<EmptyState
					data-id="public-view-rate-limited"
					headingLevel={1}
					icon={<IconClockPause size={32} aria-hidden="true" />}
					title={t("publicSharing.view.page.rateLimitedTitle")}
					action={<Button onClick={onRetry}>{t("common.cta.retry")}</Button>}
				>
					{t("publicSharing.view.page.rateLimitedText")}
				</EmptyState>
			</div>
		);
	}
	return (
		<div
			data-id="public-view-failed"
			className="mx-auto grid max-w-md gap-3 py-8 md:py-16"
		>
			<h1 className="m-0 font-bold font-mono text-xl">
				{t("publicSharing.view.page.loadFailed")}
			</h1>
			<Alert tone="danger">{publicSharingErrorMessage(error, t)}</Alert>
			<Button className="justify-self-start" onClick={onRetry}>
				{t("common.cta.retry")}
			</Button>
		</div>
	);
}
