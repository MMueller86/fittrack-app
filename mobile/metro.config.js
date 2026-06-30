// metro.config.js — extends expo/metro-config as required by Expo SDK 54.
// https://docs.expo.dev/guides/customizing-metro/
// Monorepo setup: watchFolders + nodeModulesPaths so Metro can resolve
// @fittrack/shared (which lives at ../shared/) when bundling for physical devices.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can find ../shared/ files
config.watchFolders = [workspaceRoot];

// Resolve node_modules from both the mobile package and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
