import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
	access: vi.fn(),
	realpath: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
	default: { access: fsMocks.access, realpath: fsMocks.realpath },
	access: fsMocks.access,
	realpath: fsMocks.realpath,
}));

import { resolveGatewayProgramArguments } from "./program-args.js";

const originalArgv = [...process.argv];

afterEach(() => {
	process.argv = [...originalArgv];
	vi.resetAllMocks();
});

describe("resolveGatewayProgramArguments", () => {
	it("uses realpath-resolved dist entry when running via npx shim", async () => {
		const argv1 = path.resolve("/tmp/.npm/_npx/63c3/node_modules/.bin/openclaw");
		const entryPath = path.resolve("/tmp/.npm/_npx/63c3/node_modules/openclaw/dist/entry.js");
		process.argv = ["node", argv1];
		fsMocks.realpath.mockResolvedValue(entryPath);
		fsMocks.access.mockImplementation(async (target: string) => {
			if (target === entryPath) {
				return;
			}
			throw new Error("missing");
		});

		const result = await resolveGatewayProgramArguments({ port: 18789 });

		expect(result.programArguments).toEqual([
			process.execPath,
			entryPath,
			"gateway",
			"--port",
			"18789",
		]);
	});

	it("prefers symlinked path over realpath for stable service config", async () => {
		// Simulates Bun global install where node_modules/openclaw is a symlink
		// to an internal Bun cache path with a versioned directory.
		const symlinkPath = path.resolve(
			"/Users/test/.bun/install/global/node_modules/openclaw/dist/entry.js",
		);
		const realpathResolved = path.resolve(
			"/Users/test/.bun/install/cache/openclaw@2026.1.21-2/node_modules/openclaw/dist/entry.js",
		);
		process.argv = ["node", symlinkPath];
		fsMocks.realpath.mockResolvedValue(realpathResolved);
		fsMocks.access.mockResolvedValue(undefined); // Both paths exist

		const result = await resolveGatewayProgramArguments({ port: 18789 });

		// Should use the symlinked path, not the realpath-resolved versioned path
		expect(result.programArguments[1]).toBe(symlinkPath);
		expect(result.programArguments[1]).not.toContain("@2026.1.21-2");
	});

	it("falls back to node_modules package dist when .bin path is not resolved", async () => {
		const argv1 = path.resolve("/tmp/.npm/_npx/63c3/node_modules/.bin/openclaw");
		const indexPath = path.resolve("/tmp/.npm/_npx/63c3/node_modules/openclaw/dist/index.js");
		process.argv = ["node", argv1];
		fsMocks.realpath.mockRejectedValue(new Error("no realpath"));
		fsMocks.access.mockImplementation(async (target: string) => {
			if (target === indexPath) {
				return;
			}
			throw new Error("missing");
		});

		const result = await resolveGatewayProgramArguments({ port: 18789 });

		expect(result.programArguments).toEqual([
			process.execPath,
			indexPath,
			"gateway",
			"--port",
			"18789",
		]);
	});
});
