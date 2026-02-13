export type NativeDependencyHintParams = {
	packageName: string;
	manager?: "bun" | "npm" | "yarn";
	rebuildCommand?: string;
	approveBuildsCommand?: string;
	downloadCommand?: string;
};

export function formatNativeDependencyHint(params: NativeDependencyHintParams): string {
	const manager = params.manager ?? "bun";
	const rebuildCommand =
		params.rebuildCommand ??
		(manager === "npm"
			? `npm rebuild ${params.packageName}`
			: manager === "yarn"
				? `yarn rebuild ${params.packageName}`
				: `bun pm trust ${params.packageName}`);
	const approveBuildsCommand =
		params.approveBuildsCommand ??
		(manager === "bun" ? `bun pm trust ${params.packageName}` : undefined);
	const steps = [approveBuildsCommand, rebuildCommand, params.downloadCommand].filter(
		(step): step is string => Boolean(step),
	);
	if (steps.length === 0) {
		return `Install ${params.packageName} and rebuild its native module.`;
	}
	return `Install ${params.packageName} and rebuild its native module (${steps.join("; ")}).`;
}
