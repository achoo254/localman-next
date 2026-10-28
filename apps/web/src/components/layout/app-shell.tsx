import { Outlet, useMatches } from "react-router";
import { RequireAuth } from "../../features/auth/route-guards";
import { VaultDialogHost } from "../../features/secure-vault/vault-dialog-host";
import { isRecord } from "../../lib/json-guards";
import { RouteProgress } from "../ui/route-progress";
import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { MAIN_CLASS, MAIN_ID, SkipLink } from "./skip-link";

/**
 * Route `handle` of full-screen tools (the API client): the page fills the
 * height under the header, edge to edge, without the footer.
 */
export const WORKBENCH_HANDLE = { layout: "workbench" } as const;

function isWorkbench(handle: unknown): boolean {
	return isRecord(handle) && handle.layout === WORKBENCH_HANDLE.layout;
}

const WORKBENCH_MAIN_CLASS =
	"flex h-[calc(100dvh-var(--header-h)-1px)] min-h-0 w-full flex-col focus:outline-none";

/**
 * Layout for signed-in pages (header, page, footer with the feedback
 * form); unauthenticated visitors go to the IdP. The route bar sits
 * outside the auth guard so it also runs while the session is checked.
 * The vault dialogs (and the prompt that saves a secret's local value
 * needs) live around the signed-in page.
 */
export function AppShell() {
	const workbench = useMatches().some((match) => isWorkbench(match.handle));
	return (
		<>
			<RouteProgress />
			<RequireAuth>
				{(user) => (
					<VaultDialogHost>
						<SkipLink />
						<AppHeader user={user} wide={workbench} />
						<main
							id={MAIN_ID}
							tabIndex={-1}
							className={workbench ? WORKBENCH_MAIN_CLASS : MAIN_CLASS}
						>
							<Outlet />
						</main>
						{workbench ? null : <AppFooter />}
					</VaultDialogHost>
				)}
			</RequireAuth>
		</>
	);
}
