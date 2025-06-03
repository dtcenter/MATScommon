/**
 * Route configuration for MATS API
 * Defines all routes and their handler functions
 */

// Import handler functions
import {
  getHealth,
  getCSV,
  getJSON,
  clearCache,
  getApps,
  getAppSumsDBs,
  getModels,
  getRegions,
  getRegionsValuesMap,
  getStatistics,
  getStatisticsValuesMap,
  getVariables,
  getVariablesValuesMap,
  getThresholds,
  getThresholdsValuesMap,
  getScales,
  getScalesValuesMap,
  getTruths,
  getTruthsValuesMap,
  getFcstLengths,
  getFcstTypes,
  getFcstTypesValuesMap,
  getValidTimes,
  getLevels,
  getDates,
  refreshMetadataMWltData,
  refreshScorecard,
  setStatusScorecard,
} from "./routeHandlers";

/**
 * Routes configuration object
 * Each entry defines a route path and its corresponding handler
 *
 * routes are defined as objects with:
 *   - path: the route path
 *   - handler: the function that handles the request
 *   - async: whether the handler is async (returns a Promise)
 *   - needsRequest: whether the handler needs the request object
 *   - method: 'post'|'get' (default is 'get')
 *
 */
const routes = [
  // Health check
  { path: "/healthz", handler: getHealth, async: true },

  // Data export routes
  { path: "/CSV/:f/:key/:m/:a", handler: getCSV, needsRequest: true },
  { path: "/JSON/:f/:key/:m/:a", handler: getJSON, needsRequest: true },

  // Cache management
  { path: "/clearCache", handler: clearCache },

  // App metadata routes
  { path: "/getApps", handler: getApps, async: true },
  { path: "/getAppSumsDBs", handler: getAppSumsDBs, async: true },

  // Data source routes
  { path: "/getModels", handler: getModels, async: true },
  { path: "/getRegions", handler: getRegions, async: true },
  { path: "/getRegionsValuesMap", handler: getRegionsValuesMap, async: true },

  // Statistical analysis routes
  { path: "/getStatistics", handler: getStatistics, async: true },
  { path: "/getStatisticsValuesMap", handler: getStatisticsValuesMap, async: true },

  // Variable and threshold routes
  { path: "/getVariables", handler: getVariables, async: true },
  { path: "/getVariablesValuesMap", handler: getVariablesValuesMap, async: true },
  { path: "/getThresholds", handler: getThresholds, async: true },
  { path: "/getThresholdsValuesMap", handler: getThresholdsValuesMap, async: true },

  // Scale and truth routes
  { path: "/getScales", handler: getScales, async: true },
  { path: "/getScalesValuesMap", handler: getScalesValuesMap, async: true },
  { path: "/getTruths", handler: getTruths, async: true },
  { path: "/getTruthsValuesMap", handler: getTruthsValuesMap, async: true },

  // Forecast routes
  { path: "/getFcstLengths", handler: getFcstLengths, async: true },
  { path: "/getFcstTypes", handler: getFcstTypes, async: true },
  { path: "/getFcstTypesValuesMap", handler: getFcstTypesValuesMap, async: true },

  // Time and level routes
  { path: "/getValidTimes", handler: getValidTimes, async: true },
  { path: "/getLevels", handler: getLevels, async: true },
  { path: "/getDates", handler: getDates, async: true },

  // Refresh and utility routes
  { path: "/refreshMetadata", handler: refreshMetadataMWltData, async: true },

  // POST routes
  {
    path: "/refreshScorecard/:docId",
    handler: refreshScorecard,
    method: "post",
    needsRequest: true,
  },
  {
    path: "/setStatusScorecard/:docId",
    handler: setStatusScorecard,
    method: "post",
    needsRequest: true,
  },
];

export default routes;
