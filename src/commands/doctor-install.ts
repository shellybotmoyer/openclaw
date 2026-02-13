import fs from "node:fs";
import path from "node:path";
import { note } from "../terminal/note.js";

export function noteSourceInstallIssues(root: string | null) {
	if (!root) {
		return;
	}

	const workspaceMarker = path.join(root, "package.json");
	if (!fs.existsSync(workspaceMarker)) {
		return;
	}

	const warnings: string[] = [];
	const nodeModules = path.join(root, "node_modules");
	const bunLock = path.join(root, "bun.lock");
	const legacyBunLock = path.join(root, "bun.lockb");
	const tsxBin = path.join(nodeModules, ".bin", "tsx");
	const srcEntry = path.join(root, "src", "entry.ts");

	if (fs.existsSync(nodeModules) && !fs.existsSync(bunLock) && !fs.existsSync(legacyBunLock)) {
		warnings.push("- node_modules exists but Bun lockfile is missing. Run: bun install");
	}

	if (fs.existsSync(path.join(root, "package-lock.json"))) {
		warnings.push(
			"- package-lock.json present in a Bun workspace. If you ran npm install, remove it and reinstall with bun.",
		);
	}

	if (fs.existsSync(srcEntry) && !fs.existsSync(tsxBin)) {
		warnings.push("- tsx binary is missing for source runs. Run: bun install");
	}

	if (warnings.length > 0) {
		note(warnings.join("\n"), "Install");
	}
}
