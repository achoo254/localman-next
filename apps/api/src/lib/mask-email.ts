const VISIBLE = 2;

function maskPart(part: string): string {
	return `${part.slice(0, VISIBLE)}***`;
}

/**
 * Hides most of an address (owner chat alerts, invitation previews): `nguyen@gmail.com` becomes
 * `ng***@gm***.com`. The top-level domain stays readable.
 */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	if (at <= 0) return "***";
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const dot = domain.lastIndexOf(".");
	const masked =
		dot > 0
			? `${maskPart(domain.slice(0, dot))}${domain.slice(dot)}`
			: maskPart(domain);
	return `${maskPart(local)}@${masked}`;
}
