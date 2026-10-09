import { useState } from "react";
import { Link, useLocation } from "react-router";
import { feedbackSourceFor } from "../../features/feedback/feedback-draft";
import { FeedbackForm } from "../../features/feedback/feedback-form";
import { ThemeToggle } from "../theme/theme-toggle";

const FOOTER_LINK =
	"inline-flex min-h-11 cursor-pointer items-center rounded-sm font-mono font-semibold text-primary underline-offset-4 hover:underline";

/** Page footer with the "Góp ý / Liên hệ" form (in place of a contact email). */
export function AppFooter() {
	const { pathname } = useLocation();
	const [open, setOpen] = useState(false);
	return (
		<footer
			data-id="app-footer"
			className="border-border-subtle border-t py-6 text-[0.8125rem] text-muted"
		>
			<div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-3 px-gutter">
				{/* The prerendered landing carries its build year; a new year only
				    differs until the next deploy, so the mismatch is expected. */}
				<span suppressHydrationWarning>
					© {new Date().getFullYear()} Localman
				</span>
				<div className="flex flex-wrap items-center gap-4">
					<Link to="/docs" data-id="app-footer-docs" className={FOOTER_LINK}>
						Docs
					</Link>
					<button
						type="button"
						data-id="app-footer-feedback"
						onClick={() => setOpen(true)}
						className={FOOTER_LINK}
					>
						Góp ý / Liên hệ
					</button>
					{/* The top bar hides its theme switch below 640px. */}
					<div className="sm:hidden">
						<ThemeToggle data-id="app-footer-theme" />
					</div>
				</div>
			</div>
			<FeedbackForm
				open={open}
				onOpenChange={setOpen}
				source={feedbackSourceFor(pathname)}
			/>
		</footer>
	);
}
