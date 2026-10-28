import { Link } from "react-router";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { LEGAL_PATHS } from "../../lib/legal";

const LEGAL_LINK = "text-fg underline underline-offset-4 hover:no-underline";

/**
 * "By signing in you agree to the Terms and the Privacy policy", under the
 * sign-in button of the landing and of /login.
 */
export function SignUpLegalNote({ "data-id": dataId }: { "data-id": string }) {
	const t = useT();
	return (
		<p data-id={dataId} className="m-0 text-[0.8125rem] text-muted">
			{renderRich(t("legal.signUpNote"), {
				terms: (chunk) => (
					<Link to={LEGAL_PATHS.terms} className={LEGAL_LINK}>
						{chunk}
					</Link>
				),
				privacy: (chunk) => (
					<Link to={LEGAL_PATHS.privacy} className={LEGAL_LINK}>
						{chunk}
					</Link>
				),
			})}
		</p>
	);
}
