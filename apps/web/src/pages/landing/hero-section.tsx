import { Hero, SignInCard } from "@achoo254/app-shell";
import { limitsFor } from "@localman/shared/constants";
import { SHELL_BRAND } from "../../components/layout/shell-brand";
import { useFeatures } from "../../config/features";
import { SignUpLegalNote } from "../../features/auth/sign-up-legal-note";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { loginUrl } from "../../lib/api-url";
import { navigateToLogin } from "../../platform/navigation";
import { AuthErrorAlert } from "./auth-error-alert";
import { CtaPerks } from "./cta-perks";
import { HeroPreview } from "./hero-preview";

const CODE_WORD = "font-mono text-primary";

const codeWord = (chunk: string) => <span className={CODE_WORD}>{chunk}</span>;

/** Where sign-in from the landing comes back to. */
const RETURN_TO = "/projects";

/**
 * Hero of the shared shell with two messages: the mock pitch until the API
 * client is in production, then "Localhost right in your browser". Beside
 * it a guest gets the shared sign-in card, the landing's one call to
 * action; a signed-in visitor, who has "Open app" in the header, sees the
 * product preview instead. The prerendered page does not know the session,
 * so it shows the card.
 */
export function HeroSection() {
	const { apiClient } = useFeatures();
	const { locale, t } = useI18n();
	const signedIn = useCurrentUser().status === "authenticated";
	const free = limitsFor("free");
	const proxy = free.proxyRequestsPerMonth;
	const limits = { projects: free.projects, resources: free.resources };
	return (
		<Hero
			eyebrow={t(
				apiClient ? "landing.hero.badgeLocalhost" : "landing.hero.badgeMock",
			)}
			title={renderRich(
				apiClient
					? t("landing.hero.titleLocalhost")
					: t("landing.hero.titleMock"),
				{ code: codeWord },
			)}
			lede={
				apiClient
					? renderRich(t("landing.hero.subLocalhost"), {
							b: (chunk) => <b className="text-fg">{chunk}</b>,
						})
					: t("landing.hero.subMock")
			}
			aside={
				signedIn ? (
					<HeroPreview localhost={apiClient} />
				) : (
					<SignInCard
						brand={SHELL_BRAND}
						locale={locale}
						signInHref={loginUrl({ returnTo: RETURN_TO })}
						onSignIn={() => navigateToLogin({ returnTo: RETURN_TO })}
						title={t("auth.signInPage.title")}
						headingLevel={2}
					>
						<AuthErrorAlert />
						<SignUpLegalNote data-id="landing-hero-legal" />
					</SignInCard>
				)
			}
		>
			<CtaPerks data-id="landing-hero-perks" />
			<p
				data-id="landing-hero-note"
				className="m-0 text-[0.8125rem] text-muted"
			>
				{apiClient && proxy !== null
					? t("landing.hero.noteLocalhost", { ...limits, proxy })
					: t("landing.hero.noteMock", limits)}
			</p>
		</Hero>
	);
}
