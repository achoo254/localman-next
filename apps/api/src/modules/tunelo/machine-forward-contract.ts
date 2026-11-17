/**
 * Localman's side of Tunelo's local forward: a request for
 * `localhost:<port>` on a linked machine goes to `<forwardUrl>/<path>` with
 * the machine's link token. Names, codes and the port deny list come from
 * `@tunelo/shared`, the definition the Tunelo server and the machine use.
 */
import {
	LOCAL_FORWARD,
	LOCAL_FORWARD_ERRORS,
	LOCAL_FORWARD_HEADERS,
	isTuneloHeader,
} from "@tunelo/shared";

/** Path under the machine tunnel, as `forwardUrl` ends. */
export const FORWARD_PATH = LOCAL_FORWARD.PATH;

/** Headers of a forward, as Localman writes them. Only the server sets them. */
export const FORWARD_HEADERS = {
	access: "Tunelo-Access",
	localPort: "Tunelo-Local-Port",
} as const;

/** Every `tunelo-*` header a sender may not set or forward. */
export function isForwardHeader(name: string): boolean {
	return isTuneloHeader(name.trim());
}

/** Response header naming why a forward was refused. */
export const FORWARD_ERROR_HEADER = LOCAL_FORWARD_HEADERS.ERROR;

/** `FORWARD_ERROR_HEADER` values. */
export const FORWARD_ERRORS = {
	notFound: LOCAL_FORWARD_ERRORS.NOT_FOUND,
	portBlocked: LOCAL_FORWARD_ERRORS.PORT_BLOCKED,
	disabled: LOCAL_FORWARD_ERRORS.DISABLED,
	badPort: LOCAL_FORWARD_ERRORS.BAD_PORT,
	portClosed: LOCAL_FORWARD_ERRORS.PORT_CLOSED,
	offline: LOCAL_FORWARD_ERRORS.MACHINE_OFFLINE,
	rateLimited: LOCAL_FORWARD_ERRORS.RATE_LIMITED,
} as const;

/** Ports Tunelo never forwards (the machine adds its own). */
export const DENIED_PORTS: ReadonlySet<number> = new Set(
	LOCAL_FORWARD.DENY_PORTS,
);
