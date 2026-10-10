/**
 * The Pro trial: plan card actions (pricing, "Manage plan"), the start
 * confirmation, the account page countdown, extension requests and the
 * banner shown above the Free limits once a trial has ended.
 */
export const trial = {
	badge: "Free {days}-day trial",
	paidNote: "Paid plans aren't available yet.",
	startGuest: "Start free trial",
	start: "Start {days}-day trial",
	endsIn: {
		one: "Trial ends in {count} day",
		other: "Trial ends in {count} days",
	},
	endsToday: "Trial ends today",
	viewAccount: "See it in your account",
	used: "Trial used",
	requestExtension: "Request an extension",
	tellUs: "Tell us what you need from Pro",
	daysLeft: { one: "{count} day left", other: "{count} days left" },
	lastDay: "Last day",
	/** Account page heading while the trial runs. */
	planName: "Pro trial · ends {date}",
	confirm: {
		title: "Start your Pro trial",
		question: "Get Pro for {days} days, until {date}.",
		once: "Each account can start the trial only once.",
		after:
			"When it ends, your account goes back to Free. Nothing is deleted; you just can't create more while you're above the Free limits.",
		submit: "Start trial",
	},
	started: "Your Pro trial has started. It ends on {date}.",
	errors: {
		alreadyUsed:
			"This account has already used its Pro trial. You can request an extension from your account page.",
		alreadyPro: "Your account is already on Pro, so there's no trial to start.",
		extensionPending:
			"You already have an extension request waiting for a reply.",
		notExtendable:
			"This trial can't be extended anymore: requests close a week after it ends.",
		extensionRateLimited:
			"You've sent too many extension requests today. Try again tomorrow.",
		invalidReason:
			"The reason wasn't accepted. Check that it isn't empty or too long, then send it again.",
	},
	extension: {
		title: "Request an extension",
		lead: "Need more time with Pro? Tell us why. If the request is approved, your trial gets {days} more days.",
		reason: "Reason",
		reasonHint: "Up to {max} characters. The Localman team reads it.",
		reasonEmpty: "Tell us briefly why you need more time.",
		reasonTooLong: "Keep the reason to {max} characters or fewer.",
		submit: "Send request",
		sent: "Extension requested.",
		pending:
			"Request sent on {date}. You'll get a notification once it's decided.",
		approved: "Your last request was approved on {date}.",
		declined: "Your last request was declined on {date}.",
	},
	overLimits: {
		title: "You're above the {plan} limits: {list}.",
		body: "Everything keeps working; creating more is blocked until you're under the limits.",
		separator: ", ",
		projects: "{used}/{max} projects",
		resources: "{used}/{max} resources",
	},
} as const;
