/** Collaborators dialog, invite form and magic link (`features/collaborators`). */
export const collaborators = {
	modal: {
		title: "Collaborators · {project}",
		done: "Done",
		leave: "Leave project",
		seePlans: "See plans",
	},
	list: {
		label: "Collaborator list",
		loading: "Loading members…",
		loadFailed: "Couldn't load the member list",
	},
	row: {
		owner: "Owner",
		you: "You",
		emailUnverified: "email not verified",
		status: { accepted: "Joined", pending: "Pending", expired: "Expired" },
		personExpired: "{person} · expired {date}",
		linkPending: "Invite link · {email} · expires {date}",
		linkExpired: "Invite link · {email} · expired {date}",
		emailHidden: "email hidden",
		remove: "Remove {label} from the project",
		cancelInvite: "Cancel the invitation to {label}",
		deleteInvite: "Delete the invitation to {label}",
	},
	toast: {
		inviteCancelled: "Cancelled the invitation to {label}",
		left: "Left {project}",
		removed: "Removed {name} from the project",
	},
	seats: {
		count: "{seats} members (including the owner and pending invitations)",
		full: {
			one: "Limit of {count} member reached",
			other: "Limit of {count} members reached",
		},
		nextNeedsPro: "Member #{count} requires the Pro plan.",
		removeToInvite: "Remove a member or an invitation to invite more people.",
	},
	form: {
		legend: "Invite collaborators",
		label: "Username or email",
		hint: "No hoandat account yet? Enter their email to create a one-time invite link (valid for 7 days).",
		placeholder: "@username or name@example.com",
		submit: "Invite",
		empty: "Enter a username or email.",
		linkLabel: "Invite link for {who}",
		linkHint: "Expires {date}. The link is shown only this once.",
		linkHintNoDate: "The link is shown only this once.",
		invited: "Invited {who}",
		linkCreated: "Created an invite link for {who}",
		notified:
			"They'll see the invitation in the app and on the notification channels they've turned on.",
	},
	invitee: {
		confirm: "Confirm invite",
		createLink: "Create invite link",
		noAccount:
			"No account uses <b>{email}</b> yet. Create a one-time invite link (valid for 7 days) tied to this email, then send it to them yourself.",
		unverifiedWarning:
			"This account hasn't verified its email. Only invite them if you recognize this person.",
	},
	confirm: {
		removeTitle: "Remove collaborator",
		removeQuestion: "Remove {name} from {project}?",
		removeAction: "Remove from project",
		removeBody:
			"They lose access to the project right away and can't rejoin with the magic link. To bring them back, send a new invitation.",
		leaveTitle: "Leave project",
		leaveQuestion: "Leave {project}?",
		leaveAction: "Leave project",
		leaveBody: "You'll lose access until you're invited again.",
	},
	rotate: {
		hint: "This person still knows the mock URL. Change the URL to block them completely.",
		action: "Change mock URL",
		done: "Changed the mock URL. The old URL no longer works.",
	},
	magic: {
		title: "Magic link · {project}",
		lead: "Anyone who is signed in and opens this link joins <b>{project}</b> as a collaborator. The link can be used many times and expires after 7 days. You can create a new link or revoke it at any time.",
		full: "The project already has {used}/{max} members. People who open the link can't join until you remove some members.",
		loading: "Loading link status…",
		shownOnce: "The link is shown only this once. Copy it before you close.",
		expires: "Expires {date}.",
		copy: "Copy link",
		create: "Create magic link",
		regenerate: "Create new link",
		regenerateQuestion: "Create a new magic link?",
		regenerateBody:
			"The old link stops working right away. People who already joined keep their access.",
		revokeTitle: "Revoke magic link",
		revokeQuestion: "Revoke the magic link?",
		revoke: "Revoke",
		revokeBody:
			"People who open the link can no longer join. People who already joined keep their access.",
		revoked: "Revoked the magic link",
		none: "No active magic link.",
		active: "Active",
		expired: "Expired",
		expiresOn: "Expires {date}",
		createdOn: "· Created {date}",
		hiddenNote:
			"For security, the link isn't shown again. Create a new link if you need to send it again.",
	},
	/** Lookup and invitation errors of the invite form, by API code. */
	errors: {
		notFound: "No account uses this username or email.",
		alreadyMember: "This person is already in the project.",
		ambiguousUsername:
			"Several accounts use this username. Invite them by email instead.",
		invalid: "Enter a valid username or email.",
		rateLimited:
			"You've looked up or invited people too many times. Try again in a few minutes.",
		conflict: "The member list just changed. Please try again.",
		fallback: "Couldn't send the invitation right now. Try again later.",
	},
} as const;
