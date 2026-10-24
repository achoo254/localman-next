/** Secret vault: lock button and its dialogs (create, unlock, reset). */
export const secretVault = {
	title: "Secret vault",
	header: {
		label: "Secret vault: {state}",
		state: {
			none: "No vault",
			locked: "Locked",
			unlocked: "Unlocked",
		},
	},
	menu: {
		note: "Unlocked on this device",
		lock: "Lock",
		reset: "Reset vault…",
	},
	passphrase: {
		label: "Passphrase",
		show: "Show passphrase",
		hide: "Hide passphrase",
	},
	strength: {
		empty: "At least {min} characters",
		short: "Too short: at least {min} characters",
		weak: "Weak: make it longer, or mix letters, digits and spaces",
		fair: "Fair: a few more words make it strong",
		strong: "Strong",
	},
	create: {
		title: "Create secret vault",
		titleAfterReset: "Create a new vault",
		afterReset:
			"The old vault is gone. Set a passphrase for the new one, then enter the local values of your secret variables again.",
		intro:
			"Local values of secret variables (environments, globals and collection variables) are encrypted in this browser with a key made from your passphrase. The server only keeps the encrypted copy. Shared values of your team do not change.",
		tip: "Tip: a phrase of 4 or 5 words only you know. Keep it in a password manager.",
		confirm: "Repeat passphrase",
		mismatch: "The two passphrases don't match",
		warningTitle: "Forget the passphrase and the values are gone",
		warningBody:
			"We don't store your passphrase and can't decrypt your data. If you forget it, every local value of your secret variables is lost; the only way out is to reset the vault and enter them again.",
		ack: "I understand: if I forget the passphrase, the local values of my secret variables can't be recovered.",
		busy: "Creating the key, this takes a moment…",
		submit: "Create vault",
		created: "Vault created. It is unlocked on this device.",
	},
	unlock: {
		title: "Unlock secret vault",
		intro:
			"Enter your passphrase to decrypt the local values of your secret variables in this browser.",
		empty: "Enter the vault passphrase",
		wrong:
			"Wrong passphrase. Check Caps Lock and your keyboard layout, then try again.",
		busy: "Checking the passphrase…",
		forgot: "Forgot passphrase?",
		submit: "Unlock",
		unlocked: "Vault unlocked.",
	},
	lock: {
		locked:
			"Vault locked. Requests that use local secret values stop until you unlock it.",
	},
	reset: {
		title: "Reset secret vault",
		question: "Delete every local secret value?",
		body: "A passphrase can't be recovered. Resetting deletes the vault and every local value it encrypted, on all your devices, then you create a new vault with a new passphrase.",
		agents:
			"Copies you let agents use are deleted too. Shared values of your team are not affected.",
		confirmLabel: "Type <code>{word}</code> to confirm",
		submit: "Delete and start over",
		done: {
			one: "Old vault deleted with {count} local value.",
			other: "Old vault deleted with {count} local values.",
		},
	},
} as const;
