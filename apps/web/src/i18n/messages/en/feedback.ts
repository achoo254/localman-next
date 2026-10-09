/** The "Feedback / Contact" form. */
export const feedback = {
	title: "Feedback / Contact",
	categories: {
		feedback: {
			label: "Feedback",
			placeholder: "What should Localman do better?",
		},
		bug: {
			label: "Bug report",
			placeholder:
				"What were you doing when it went wrong, and what did you see?",
		},
		planQuestion: {
			label: "Plan question",
			placeholder: "Which limits or features do you need?",
		},
	},
	fields: {
		kind: "Type",
		message: "Message",
		length: "{length}/{max} characters",
		name: "Name",
		contact: "Email or Telegram",
		contactPlaceholder: "you@example.com or @username",
		contactHint: "Add one if you'd like a reply.",
		fromAccount: "Taken from your account.",
		honeypot: "Leave this field empty",
	},
	errors: {
		messageRequired: "Enter a message.",
		messageTooLong: "Keep the message to {max} characters or fewer.",
		nameTooLong: "The name can be at most {max} characters.",
		contactInvalid:
			"Enter a valid email or Telegram username, or leave it empty.",
		turnstile: "Complete the verification before sending.",
	},
	submit: {
		rateLimited:
			"You've sent too many messages in a row. Wait a few minutes and try again. Your message is still here.",
		validation:
			"Some details aren't valid. Check the fields and send again. Your message is still here.",
		turnstileFailed:
			"Verification failed. Complete it again, then resend. Your message is still here.",
		turnstileUnavailable:
			"We can't check the verification right now. Try again in a few minutes. Your message is still here.",
		failed: "Couldn't send. Your message is still here, so you can try again.",
		sessionLost:
			"Your session has expired. Complete the verification and send again. Your message is still here.",
	},
	openFailed: "Couldn't open the form",
	preparing: "Preparing verification…",
	noteSignedIn:
		"Feedback is sent with your account and the area you have open (for example Projects), not the page address.",
	noteVisitor:
		"Feedback is sent with the area you have open (for example the home page), not the page address.",
	sent: {
		title: "Sent. Thank you",
		body: "We've received your message.",
		reply: "We'll reply via {contact} if needed.",
	},
} as const;
