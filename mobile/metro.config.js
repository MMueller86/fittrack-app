// Use Expo SDK 58's workspace-aware Metro defaults for the monorepo.
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

module.exports = config;
