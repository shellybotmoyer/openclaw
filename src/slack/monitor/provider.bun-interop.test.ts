import { describe, expect, it } from "vitest";
import { resolveSlackBoltCtorsForRuntime } from "./provider.js";

class MockApp {}
class MockHTTPReceiver {}

describe("resolveSlackBoltCtorsForRuntime", () => {
	it("resolves constructors from direct namespace exports", () => {
		const resolved = resolveSlackBoltCtorsForRuntime({
			App: MockApp,
			HTTPReceiver: MockHTTPReceiver,
		});

		expect(resolved.App).toBe(MockApp);
		expect(resolved.HTTPReceiver).toBe(MockHTTPReceiver);
	});

	it("resolves constructors from default export wrapper", () => {
		const resolved = resolveSlackBoltCtorsForRuntime({
			default: {
				App: MockApp,
				HTTPReceiver: MockHTTPReceiver,
			},
		});

		expect(resolved.App).toBe(MockApp);
		expect(resolved.HTTPReceiver).toBe(MockHTTPReceiver);
	});

	it("resolves constructors from callable CJS-style export", () => {
		const callableModule = Object.assign(() => undefined, {
			App: MockApp,
			HTTPReceiver: MockHTTPReceiver,
		});
		const resolved = resolveSlackBoltCtorsForRuntime(callableModule);

		expect(resolved.App).toBe(MockApp);
		expect(resolved.HTTPReceiver).toBe(MockHTTPReceiver);
	});

	it("throws for invalid module shapes", () => {
		expect(() =>
			resolveSlackBoltCtorsForRuntime({
				default: {
					App: undefined,
				},
			}),
		).toThrow("unable to resolve @slack/bolt constructors");
	});
});
