/** Forks, pulling changes and merging, of collections and environments. */
import { versionControlPullRequests } from "./version-control-pull-requests";

export const versionControl = {
	kinds: {
		collection: "collection",
		folder: "folder",
		request: "request",
		example: "example",
		environment: "environment",
		variable: "variable",
	},
	fork: {
		button: "Fork",
		count: { one: "{count} fork", other: "{count} forks" },
		title: "Fork {name}",
		intro:
			"A fork is your own copy, linked to this {kind}. Change it freely, pull new changes from the source, and merge yours back.",
		label: "Fork label",
		labelHint: "Shown next to the name so people can tell forks apart.",
		workspace: "Workspace",
		personalOnly:
			"As a Viewer of this {kind}, you can fork it into your personal workspace only.",
		noWorkspace: "There's no workspace you can add to.",
		environments: "Environments to fork along",
		environmentsHint:
			"Each one becomes its own fork with the same label. Up to {max}.",
		noEnvironments: "This workspace has no environments.",
		submit: "Fork",
		done: "Forked {name}",
	},
	badge: {
		label: "Fork: {label}",
		from: "Forked from {name} by {person} on {date}",
		sourceGone:
			"Forked by {person} on {date}. The source no longer exists, or you can't open it.",
		rename: "Rename the fork label",
		renameLabel: "Fork label",
		save: "Save",
	},
	sync: {
		pull: "Pull changes",
		merge: "Merge",
		pullTitle: "Pull changes from {name}",
		mergeTitle: "Merge into {name}",
		pullIntro:
			"Bring the source's changes into this fork. Your own changes stay; where both sides changed the same thing, you choose.",
		mergeIntro:
			"Send this fork's changes to the source. Its own changes stay; where both sides changed the same thing, you choose.",
		nothing: "Nothing to bring over: both sides already match.",
		changes: "Changes",
		added: "Added {kind} {name}",
		removed: "Removed {kind} {name}",
		changed: "Changed {kind} {name}",
		option: "After merging",
		options: {
			merge: "Merge changes",
			mergeAndUpdate: "Merge changes and update this fork",
			mergeAndDelete: "Merge changes and delete this fork",
		},
		optionNeedsEditor: "Needs the Editor role on this fork.",
		mergeNeedsEditor:
			"Merging into {name} needs the Editor role on it. Create a pull request instead.",
		mergeNeedsEditorEnvironment:
			"Merging into {name} needs the Editor role on it.",
		pullDone: "Pulled the changes from {name}",
		mergeDone: "Merged into {name}",
		followUpFailed:
			"Merged. The fork could not be updated or deleted afterwards: pull or delete it yourself.",
		submitPull: "Pull changes",
		submitMerge: "Merge",
		loading: "Comparing both sides…",
		loadFailed: "We couldn't compare both sides.",
		sourceGone: "The source no longer exists, or you can't open it.",
	},
	conflicts: {
		title: { one: "{count} conflict", other: "{count} conflicts" },
		intro: "Both sides changed these. Choose the version to keep for each.",
		pullSides: "Source is {name}; destination is this fork.",
		mergeSides: "Source is this fork; destination is {name}.",
		keepSource: "Keep source",
		keepDestination: "Keep destination",
		keepAllSource: "Keep all source",
		keepAllDestination: "Keep all destination",
		deleted: "(deleted)",
		empty: "(empty)",
		whole: "the whole {kind}",
		left: {
			one: "{count} conflict to settle",
			other: "{count} conflicts to settle",
		},
	},
	forks: {
		panel: "Forks",
		empty: "No forks yet.",
		by: "by {person} · {date}",
		open: "Open {label}",
		openButton: "Open",
		noAccess: "You can't open this fork.",
	},
	errors: {
		planFeature: "Forks and merges are part of the Pro plan.",
		target: "As a Viewer, you can fork into your personal workspace only.",
		conflicts: "Choose a version for every conflict first.",
		sourceGone: "The source no longer exists, or you can't open it.",
		environmentOutside:
			"Only environments of the collection's workspace can come along.",
		changeGone:
			"This change is no longer part of the pull request. Reopen it to refresh.",
		forbidden: "You're not allowed to do that.",
		notFound: "This pull request no longer exists, or you can't open it.",
		closed: "This pull request is already merged or declined.",
		invalidReviewer: "Reviewers must be Editors of the source.",
		pullRequestLimit:
			"A collection takes at most 100 open pull requests. Merge or decline some first.",
		busy: "This pull request is changing right now. Try again.",
	},
	...versionControlPullRequests,
} as const;
