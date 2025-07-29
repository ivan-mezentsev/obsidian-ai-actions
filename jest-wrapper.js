#!/usr/bin/env node

// Jest wrapper script to support both --testPathPattern and --testPathPatterns
// This provides backward compatibility for the deprecated --testPathPattern option
// Also supports --run parameter as an alias for --testPathPatterns

const { spawn } = require("child_process");
const path = require("path");

// Get command line arguments
const args = process.argv.slice(2);

// Replace --testPathPattern and --run with --testPathPatterns
const modifiedArgs = [];
for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg.startsWith("--testPathPattern=")) {
		modifiedArgs.push(
			arg.replace("--testPathPattern=", "--testPathPatterns=")
		);
	} else if (arg.startsWith("--run=")) {
		modifiedArgs.push(arg.replace("--run=", "--testPathPatterns="));
	} else if (arg === "--run" && i + 1 < args.length) {
		// Handle --run as separate argument followed by test path
		modifiedArgs.push("--testPathPatterns");
		modifiedArgs.push(args[i + 1]);
		i++; // Skip next argument as it's already processed
	} else {
		modifiedArgs.push(arg);
	}
}

// Path to Jest executable
const jestPath = path.join(__dirname, "node_modules", ".bin", "jest");

// Spawn Jest with modified arguments
const jestProcess = spawn("node", [jestPath, ...modifiedArgs], {
	stdio: "inherit",
	cwd: process.cwd(),
});

jestProcess.on("close", code => {
	process.exit(code);
});

jestProcess.on("error", error => {
	console.error("Error running Jest:", error);
	process.exit(1);
});
