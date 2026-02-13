import { playwright } from "@vitest/browser-playwright";

export default {
	test: {
		include: ["src/**/*.test.ts"],
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [{ browser: "chromium", name: "chromium" }],
			headless: true,
			ui: false,
		},
	},
};
