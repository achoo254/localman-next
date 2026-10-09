import type { z } from "zod";

export interface ErrorIssue {
	readonly path: string;
	readonly message: string;
}

/**
 * Extra, client-safe facts about an error: validation issues, or a flat
 * record describing a domain error (e.g. `{ limit, max, used }`).
 */
export type ErrorDetails =
	| readonly ErrorIssue[]
	| Readonly<Record<string, string | number | boolean | null>>;

export interface ErrorBody {
	readonly error: {
		readonly code: string;
		readonly message: string;
		readonly details?: ErrorDetails;
	};
}

/** Expected failure with a client-safe code and message. */
export class OperationError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly details?: ErrorDetails,
	) {
		super(message);
		this.name = "OperationError";
	}

	toBody(): ErrorBody {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.details ? { details: this.details } : {}),
			},
		};
	}
}

/** Maps zod issues to a 400 `VALIDATION_ERROR` without echoing input values. */
export function validationError(error: z.core.$ZodError): OperationError {
	const details = error.issues.map((issue) => ({
		path: issue.path.map(String).join("."),
		message: issue.message,
	}));
	const first = details[0];
	const message = first
		? `Invalid input${first.path ? ` at "${first.path}"` : ""}: ${first.message}`
		: "Invalid input";
	return new OperationError(400, "VALIDATION_ERROR", message, details);
}
