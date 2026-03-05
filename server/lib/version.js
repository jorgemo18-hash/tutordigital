import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let pkgVersion = "dev";
try {
  const pkg = require("../../package.json");
  if (pkg?.version) pkgVersion = pkg.version;
} catch {
  // ignore
}

function getCommitSha() {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    ""
  );
}

export function getBuildInfo() {
  const sha = getCommitSha();
  const short = sha ? sha.slice(0, 7) : "";
  return {
    version: pkgVersion,
    commit: sha,
    label: short ? `v${pkgVersion} commit:${short}` : `v${pkgVersion}`,
  };
}
