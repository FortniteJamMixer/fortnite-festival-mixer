import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const matches = [];
const forbidden = ["all", "origins"].join("");

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  if (contents.includes(forbidden)) {
    matches.push(file);
  }
}

if (matches.length) {
  console.error("Legacy proxy usage detected in tracked files:");
  matches.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log("No legacy proxy usage detected.");
