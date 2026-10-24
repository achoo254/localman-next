import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";

/** The shortest passphrase a vault accepts (in characters, not bytes). */
export const PASSPHRASE_MIN_LENGTH = 8;

export type PassphraseStrength = "empty" | "short" | "weak" | "fair" | "strong";

/** Kinds of characters: lower, upper, digit, symbol, space. */
const KINDS = [/\p{Ll}/u, /\p{Lu}/u, /\d/u, /[^\p{L}\d\s]/u, /\s/u];

/**
 * A rough guide, not a guarantee: length counts most (a phrase of a few
 * words beats a short mix of symbols), variety adds a little.
 */
export function passphraseStrength(passphrase: string): PassphraseStrength {
	const length = [...passphrase].length;
	if (length === 0) return "empty";
	if (length < PASSPHRASE_MIN_LENGTH) return "short";
	const kinds = KINDS.filter((kind) => kind.test(passphrase)).length;
	const score =
		(length >= 12 ? 1 : 0) + (length >= 16 ? 1 : 0) + (kinds >= 3 ? 1 : 0);
	if (score >= 2) return "strong";
	return score === 1 ? "fair" : "weak";
}

/** Long enough to be accepted. */
export function isAcceptablePassphrase(strength: PassphraseStrength): boolean {
	return strength !== "empty" && strength !== "short";
}

const LEVEL: Record<PassphraseStrength, number> = {
	empty: 0,
	short: 0,
	weak: 1,
	fair: 2,
	strong: 3,
};

const FILLED: Record<number, string> = {
	1: "bg-error",
	2: "bg-warning",
	3: "bg-success",
};

/**
 * Three bars (decorative) and the hint text, announced politely as the
 * person types; `id` lets the input point at the hint.
 */
export function PassphraseStrengthHint({
	strength,
	id,
}: {
	strength: PassphraseStrength;
	id: string;
}) {
	const t = useT();
	const level = LEVEL[strength];
	return (
		<div className="grid gap-1.5">
			<div
				aria-hidden="true"
				data-id="modal-vault-create-strength-meter"
				data-level={level}
				className="grid grid-cols-3 gap-1"
			>
				{[1, 2, 3].map((bar) => (
					<span
						key={bar}
						className={cn(
							"h-1 rounded-full",
							bar <= level ? FILLED[level] : "bg-bar-track",
						)}
					/>
				))}
			</div>
			<p
				id={id}
				aria-live="polite"
				data-id="modal-vault-create-strength"
				className="m-0 text-[0.8125rem] text-muted leading-normal"
			>
				{strength === "empty" || strength === "short"
					? t(`secretVault.strength.${strength}`, {
							min: PASSPHRASE_MIN_LENGTH,
						})
					: t(`secretVault.strength.${strength}`)}
			</p>
		</div>
	);
}
