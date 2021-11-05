/**
 * Get versioning info from the environment
 * 
 * Returns "Unknown" if no value found
 * 
 * @returns {{
 *  version: String
 *  commit: String
 *  branch: String
 * }}
 */
function getVersionsFromEnv() {
    const VERSION = process.env.VERSION || "Unknown";
    const COMMIT = process.env.COMMIT || "Unknown";
    const BRANCH = process.env.BRANCH || "Unknown";
    return {
        version: VERSION,
        commit: COMMIT,
        branch: BRANCH
    }
}

export default versionInfo = {
    getVersionsFromEnv: getVersionsFromEnv
};
