export const CURRENT_APP_VERSION = "1.6";

export const content = {
	version: CURRENT_APP_VERSION,
	versionHistory: [
		{
			version: "1.6",
			features: [
				{
					title: "Question Navigation",
					description:
						"You can now navigate through questions using the question navigation box. You can also flag questions for later review.",
				},
				{
					title: "Peer-to-peer Exam Sharing",
					description:
						"You can now share your exam with your friends or between your devices. This also shares your progress and answers.",
				},
				{
					title: "Dark Mode Fix",
					description:
						"The app now starts with Dark Mode enabled correctly.",
				},
			],
		},
		{
			version: "1.5",
			features: [
				{
					title: "Buy me a coffee 😁😁 (I don't like coffee, but I like money)",
					description:
						"You can now buy me a coffee to support the app. It's a small gesture, but it's appreciated. Go to <a href='https://jami.bio/jdlix' target='_blank'>https://jami.bio/jdlix</a> to buy me a coffee.",
				},
			],
		},
		{
			version: "1.4",
			features: [
				{
					title: "Dark Mode",
					description:
						"The app now supports dark mode. You can toggle it on the top right corner of the app.",
				},
				{
					title: "Resume Button",
					description:
						"You can now resume your exam from where you left off.",
				},
			],
		},
		{
			version: "1.3",
			features: [
				{
					title: "Image based PDF Support",
					description:
						"Upload PDF that is collection of image pages. The app will extract the questions from the images.",
				},
				{
					title: "User Answers",
					description:
						"Your answers are saved and can be reviewed later. You can also clear your answers at any time.",
				},
			],
		},
		{
			version: "1.2",
			features: [
				{
					title: "Exam Mode vs. Instant Feedback",
					description:
						"Easily toggle between a realistic exam simulation and a mode with instant answer feedback.",
				},
				{
					title: "Keyboard Shortcuts",
					description:
						"Navigate through questions seamlessly using the Left (←) and Right (→) arrow keys.",
				},
			],
		},
		{
			version: "1.1",
			features: [
				{
					title: "Recent Exams",
					description:
						"Get a list of your recently uploaded exams and start them instantly.",
				},
			],
		},
	],
	// Helper function to get all features or only features from specified versions
	getFeatures: function (fromVersion = "0.0") {
		let allFeatures = [];
		// Sort versions in descending order (newest first)
		const sortedVersions = [...this.versionHistory].sort(
			(a, b) => parseFloat(b.version) - parseFloat(a.version),
		);

		for (const versionInfo of sortedVersions) {
			if (versionInfo.version >= fromVersion) {
				allFeatures = [...allFeatures, ...versionInfo.features];
			}
		}

		return allFeatures;
	},
	// For backward compatibility - returns all features
	get features() {
		return this.getFeatures();
	},
};
