/**
 * Limits the account is above once its extended limits end: nothing is
 * removed, only creating more is blocked. No plan or price wording.
 */
export const trial = {
	overLimits: {
		title: "You're above this account's limits: {list}.",
		body: "Everything keeps working; creating more is blocked until you're under the limits.",
		separator: ", ",
		projects: "{used}/{max} projects",
		resources: "{used}/{max} resources",
	},
} as const;
