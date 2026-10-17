/**
 * Fixed ports of the E2E stack, in the 46xx range: dev uses 4000, 4100 and
 * 5173, and the E2E run must never touch them. A busy port fails the run
 * (the owner is named) instead of moving to another port.
 */
export const PORTS = {
	mongo: 4650,
	api: 4600,
	mock: 4610,
	idp: 4620,
	web: 4630,
	echo: 4640,
	tunelo: 4660,
} as const;

/** Browser origin of the web app (Vite preview, same origin as the API). */
export const WEB_ORIGIN = `http://127.0.0.1:${PORTS.web}`;
/** Issuer of the fake IdP; the API and the browser both reach it here. */
export const IDP_ORIGIN = `http://127.0.0.1:${PORTS.idp}`;
/**
 * Mock runtime base domain. `*.localhost` resolves to loopback in Chromium
 * without DNS, so `{secret}.localhost:4610` reaches the mock server.
 */
export const MOCK_BASE_DOMAIN = `localhost:${PORTS.mock}`;
/** Origin of the echo server the API client specs send requests to. */
export const ECHO_ORIGIN = `http://127.0.0.1:${PORTS.echo}`;
/** Cookie the fake IdP reads to pick the account a sign-in completes as. */
export const IDP_USER_COOKIE = "e2e_idp_user";
/** Origin of the fake Tunelo (account API and the specs' control routes). */
export const TUNELO_ORIGIN = `http://127.0.0.1:${PORTS.tunelo}`;
