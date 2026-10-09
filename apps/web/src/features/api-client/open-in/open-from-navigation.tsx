import { useInRouterContext } from "react-router";
import { useOpenFromNavigation } from "./use-open-from-navigation";

function NavigationListener() {
	useOpenFromNavigation();
	return null;
}

/**
 * Opens the tabs `/api-client` was navigated to with. The workbench screen
 * also renders without a router (unit tests of its panels); there is no
 * navigation state to read then.
 */
export function OpenFromNavigation() {
	return useInRouterContext() ? <NavigationListener /> : null;
}
