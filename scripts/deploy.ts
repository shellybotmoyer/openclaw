#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

type DeployOptions = {
	linkGlobal: boolean;
	onboardOnly: boolean;
	skipBuild: boolean;
	skipUiBuild: boolean;
	skipHealthCheck: boolean;
	skipChannels: boolean;
	skipSkills: boolean;
	skipUi: boolean;
	onboardArgs: string[];
};

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const OPENCLAW_ENTRYPOINT = join(PROJECT_ROOT, "openclaw.mjs");

function usage() {
	process.stderr.write(
		[
			"Usage: ./install.sh [options] [-- <extra onboard args>]",
			"   or: bun run deploy [options] [-- <extra onboard args>]",
			"",
			"Automates source-based server setup with Bun:",
			"  1) bun install --frozen-lockfile",
			"  2) bun run ui:build",
			"  3) bun run build",
			"  4) bun run openclaw onboard --non-interactive --accept-risk ...",
			"  5) bun run openclaw gateway status --deep",
			"  6) bun run openclaw health --verbose",
			"",
			"Options:",
			"  --help              Show this help",
			"  --link-global       Install global 'openclaw' CLI binary via Bun",
			"  --onboard-only      Skip install/build and only run onboarding + checks",
			"  --skip-build        Skip build steps (implies --skip-ui-build)",
			"  --skip-ui-build     Skip 'bun run ui:build'",
			"  --skip-health-check Skip final health probe",
			"  --with-channels     Do not pass --skip-channels to onboarding",
			"  --with-skills       Do not pass --skip-skills to onboarding",
			"  --with-ui           Do not pass --skip-ui to onboarding",
			"",
			"Examples:",
			"  ./install.sh",
			"  ./install.sh --link-global",
			"  ./install.sh -- --workspace /srv/openclaw-workspace --gateway-port 18789",
			"  bun run deploy -- --workspace /srv/openclaw-workspace --gateway-port 18789",
		].join("\n"),
	);
}

function parseArgs(rawArgs: string[]): DeployOptions {
	const separatorIndex = rawArgs.indexOf("--");
	const argsBeforeSeparator =
		separatorIndex >= 0 ? rawArgs.slice(0, separatorIndex) : rawArgs.slice();
	const onboardArgs = separatorIndex >= 0 ? rawArgs.slice(separatorIndex + 1) : [];

	const options: DeployOptions = {
		linkGlobal: false,
		onboardOnly: false,
		skipBuild: false,
		skipUiBuild: false,
		skipHealthCheck: false,
		skipChannels: true,
		skipSkills: true,
		skipUi: true,
		onboardArgs,
	};

	for (const arg of argsBeforeSeparator) {
		switch (arg) {
			case "--help":
				usage();
				process.exit(0);
			case "--link-global":
				options.linkGlobal = true;
				break;
			case "--onboard-only":
				options.onboardOnly = true;
				break;
			case "--skip-build":
				options.skipBuild = true;
				break;
			case "--skip-ui-build":
				options.skipUiBuild = true;
				break;
			case "--skip-health-check":
				options.skipHealthCheck = true;
				break;
			case "--with-channels":
				options.skipChannels = false;
				break;
			case "--with-skills":
				options.skipSkills = false;
				break;
			case "--with-ui":
				options.skipUi = false;
				break;
			default:
				process.stderr.write(`Unknown option: ${arg}\n\n`);
				usage();
				process.exit(2);
		}
	}

	if (options.skipBuild) {
		options.skipUiBuild = true;
	}

	return options;
}

function resolveBunExecutable() {
	const execPath = process.execPath.toLowerCase();
	if (execPath.endsWith("/bun") || execPath.endsWith("\\bun.exe")) {
		return process.execPath;
	}
	return process.platform === "win32" ? "bun.exe" : "bun";
}

function runStep(bunExecutable: string, stepLabel: string, args: string[]) {
	process.stdout.write(`\n==> ${stepLabel}\n$ ${bunExecutable} ${args.join(" ")}\n`);
	const result = spawnSync(bunExecutable, args, {
		stdio: "inherit",
		env: process.env,
		cwd: PROJECT_ROOT,
	});
	if (result.error) {
		throw result.error;
	}
	if (result.signal) {
		process.stderr.write(`Step interrupted by signal: ${result.signal}\n`);
		process.exit(1);
	}
	if ((result.status ?? 1) !== 0) {
		process.exit(result.status ?? 1);
	}
}

function getGlobalBunBinDir(bunExecutable: string) {
	const result = spawnSync(bunExecutable, ["pm", "bin", "-g"], {
		stdio: ["ignore", "pipe", "inherit"],
		env: process.env,
		cwd: PROJECT_ROOT,
		encoding: "utf8",
	});
	if (result.error) {
		throw result.error;
	}
	if (result.signal) {
		process.stderr.write(`Unable to resolve Bun global bin dir (signal ${result.signal}).\n`);
		process.exit(1);
	}
	if ((result.status ?? 1) !== 0) {
		process.exit(result.status ?? 1);
	}
	const binDir = result.stdout.trim();
	if (!binDir) {
		process.stderr.write("Unable to resolve Bun global bin dir.\n");
		process.exit(1);
	}
	return binDir;
}

function ensureGlobalOpenclawBinary(bunExecutable: string) {
	runStep(bunExecutable, "Register local openclaw package link", ["link"]);
	runStep(bunExecutable, "Install openclaw binary globally", ["link", "openclaw", "--global"]);

	const bunBinDir = getGlobalBunBinDir(bunExecutable);
	const binaryName = process.platform === "win32" ? "openclaw.cmd" : "openclaw";
	const binaryPath = join(bunBinDir, binaryName);

	if (existsSync(binaryPath)) {
		return;
	}

	process.stdout.write(
		`Global binary missing after bun link; creating fallback shim at ${binaryPath}\n`,
	);
	mkdirSync(bunBinDir, { recursive: true });
	rmSync(binaryPath, { force: true });
	symlinkSync(OPENCLAW_ENTRYPOINT, binaryPath);

	if (!existsSync(binaryPath)) {
		process.stderr.write(`Failed to create fallback global binary at ${binaryPath}\n`);
		process.exit(1);
	}
}

function buildOnboardArgs(options: DeployOptions): string[] {
	const args = [
		"run",
		"openclaw",
		"onboard",
		"--non-interactive",
		"--accept-risk",
		"--mode",
		"local",
		"--install-daemon",
		"--daemon-runtime",
		"bun",
		"--node-manager",
		"bun",
		"--gateway-bind",
		"loopback",
		"--gateway-auth",
		"token",
	];

	if (options.skipChannels) {
		args.push("--skip-channels");
	}
	if (options.skipSkills) {
		args.push("--skip-skills");
	}
	if (options.skipUi) {
		args.push("--skip-ui");
	}

	args.push(...options.onboardArgs);
	return args;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const bunExecutable = resolveBunExecutable();

	if (!options.onboardOnly) {
		runStep(bunExecutable, "Install dependencies", ["install", "--frozen-lockfile"]);
		if (!options.skipUiBuild) {
			runStep(bunExecutable, "Build Control UI assets", ["run", "ui:build"]);
		}
		if (!options.skipBuild) {
			runStep(bunExecutable, "Build OpenClaw", ["run", "build"]);
		}
		if (options.linkGlobal) {
			ensureGlobalOpenclawBinary(bunExecutable);
		}
	}

	runStep(bunExecutable, "Run non-interactive onboarding", buildOnboardArgs(options));
	runStep(bunExecutable, "Gateway status", ["run", "openclaw", "gateway", "status", "--deep"]);
	if (!options.skipHealthCheck) {
		runStep(bunExecutable, "Gateway health", ["run", "openclaw", "health", "--verbose"]);
	}

	process.stdout.write("\nDeploy complete.\n");
}

main();
