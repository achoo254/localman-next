/** The public Vietnamese fake data tool (`/tools/vn-fake-data`). */
export const vnFakeData = {
	meta: {
		title: "Vietnamese fake data generator",
		description:
			"Generate Vietnamese test data in your browser: names, addresses on the 34-province map, mobile numbers, 12-digit CCCD numbers and companies. Copy it or download CSV or JSON. Fake data for testing only.",
	},
	page: {
		badge: "Test data",
		title: "Vietnamese fake data",
		intro:
			"Names, addresses, mobile numbers, CCCD numbers and companies that look Vietnamese, generated in your browser. Nothing is sent or stored.",
	},
	notice: {
		title: "Fake data for testing only",
		text: "Every value is invented at random and meant for tests. It names no real person, phone subscriber, ID card or company: don't use it to identify anyone or on official documents.",
	},
	form: {
		legend: "What to generate",
		type: "Data type",
		count: "Count",
		countHint: "From 1 to {max} records.",
		countError: "Enter a whole number from 1 to {max}.",
		locale: "Language of the data",
		generate: "Generate new data",
	},
	types: {
		person: "People",
		address: "Addresses",
		phone: "Mobile numbers",
		cccd: "CCCD numbers",
		company: "Companies",
	},
	locales: {
		vi: "Vietnamese",
		en: "English, no diacritics",
	},
	view: {
		legend: "Preview as",
		table: "Table",
		json: "JSON",
	},
	columns: {
		fullName: "Full name",
		gender: "Gender",
		dateOfBirth: "Date of birth",
		cccd: "CCCD",
		street: "Street",
		ward: "Ward",
		province: "Province",
		full: "Full address",
		number: "Number",
		international: "International",
		carrier: "Carrier",
		provinceCode: "Province code",
		birthYear: "Birth year",
		name: "Name",
		taxCode: "Tax code",
		address: "Address",
		phone: "Phone",
	},
	genders: {
		male: "Male",
		female: "Female",
	},
	preview: {
		caption: {
			one: "{count} fake record",
			other: "{count} fake records",
		},
	},
	actions: {
		copy: "Copy JSON",
		downloadCsv: "Download CSV",
		downloadJson: "Download JSON",
		copied: {
			one: "Copied {count} record as JSON.",
			other: "Copied {count} records as JSON.",
		},
		copyBlocked:
			"Your browser blocked the clipboard. Download the JSON instead.",
		downloaded: "Downloaded {file}.",
	},
	nudge: {
		title: "Use this data as a mock API",
		text: "Sign in to create a resource with fields like these, generate records and get CRUD endpoints right away.",
		signIn: "Sign in to create a resource",
		openProjects: "Create a resource",
	},
	landing: {
		title: "Vietnamese fake data generator",
		text: "Names, addresses, mobile numbers, CCCD numbers and companies for your tests, in your browser without signing in.",
		link: "Open the generator",
	},
} as const;
