/**
 * Router setup for MATS API
 * Configures Express router with routes from routesConfig
 */

import { WebApp } from "meteor/webapp";
import { Meteor } from "meteor/meteor";
import routes from "./routeConfig";

/* eslint-disable no-console */

/**
 * Helper for registerRoute
 * Handles the route by calling the appropriate handler function
 * @param {Object} route - Route object from routeConfig.js containing path, handler, etc.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleRoute = async (route, req, res, next) => {
  try {
    const params = [];
    if (route.needsRequest) {
      params.push(req);
    }
    // Add response object
    params.push(res);

    // Call handler appropriately based on whether it's async
    if (route.async) {
      await route.handler(...params);
    } else {
      route.handler(...params);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Registers all routes with the Express router
 * @param {Object} router - Express router instance
 * @param {string|null} prefix - Optional prefix for routes (e.g. '/mats', '/mats-int')
 */
export const registerRoutes = (router, prefix = "") => {
  routes.forEach((route) => {
    const path = prefix ? `${prefix}/:app${route.path}` : route.path;

    // Determine HTTP method (default to GET)
    const method = route.method?.toLowerCase() || "get";

    switch (method) {
      case "get":
        router.get(path, async (req, res, next) => {
          handleRoute(route, req, res, next);
        });
        break;
      case "post":
        router.post(path, async (req, res, next) => {
          handleRoute(route, req, res, next);
        });
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  });
};

/**
 * Sets up Express with all routes.
 * Must be called in Meteor.isServer context.
 */
export const setupRouter = () => {
  if (!Meteor.isServer) return;

  // set the default proxy prefix path to ""
  // If the settings are not complete, they will be set by the configuration and written out, which will cause the app to reset
  if (Meteor.settings.public && !Meteor.settings.public.proxy_prefix_path) {
    Meteor.settings.public.proxy_prefix_path = "";
  }

  const proxyPrefixPath = Meteor.settings.public.proxy_prefix_path;

  // Create Express app and router
  const app = WebApp.express();
  const router = WebApp.express.Router();

  // Register routes with or without prefix
  if (!proxyPrefixPath) {
    registerRoutes(router);
  } else {
    registerRoutes(router, proxyPrefixPath);
  }

  // Mount router on app
  app.use("/", router);

  // Add router to WebApp handlers
  WebApp.handlers.use(app);

  console.log(
    `MATS API routes registered${
      proxyPrefixPath ? ` with prefix ${proxyPrefixPath}` : ""
    }`
  );
};
