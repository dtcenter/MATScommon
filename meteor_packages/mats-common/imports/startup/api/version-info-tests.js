import { versionInfo } from "meteor/randyp:mats-common";

/* eslint-disable no-undef */

const assert = require("assert");

describe("getVersionsFromEnv", function () {
  let envCache;

  // Cache the env before each test
  beforeEach(function () {
    envCache = process.env;
  });

  // Reset the env after each test
  afterEach(function () {
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
    Object.entries(envCache).forEach(([key, value]) => {
      if (key !== undefined) {
        process.env[key] = value;
      }
    });
  });

  // Test
  it("Correctly reads version from env", function () {
    process.env.VERSION = "4.2.0";
    const versionStats = versionInfo.getVersionsFromEnv();
    assert.equal(versionStats.version, "4.2.0");
  });
  it("Correctly reads commit from env", function () {
    process.env.COMMIT = "ae214rfda";
    const versionStats = versionInfo.getVersionsFromEnv();
    assert.equal(versionStats.commit, "ae214rfda");
  });
  it("Correctly reads version from env", function () {
    process.env.BRANCH = "test";
    const versionStats = versionInfo.getVersionsFromEnv();
    assert.equal(versionStats.branch, "test");
  });
  it("Correctly handles no env", function () {
    const { version, commit, branch } = versionInfo.getVersionsFromEnv();
    assert.equal(version, "Unknown");
    assert.equal(commit, "Unknown");
    assert.equal(branch, "Unknown");
  });
});
