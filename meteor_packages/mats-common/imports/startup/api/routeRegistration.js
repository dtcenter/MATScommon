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
    // Create a params object to pass to the handler
    // Always include the response object
    const handlerParams = { res };

    // Only add request if the route needs it
    if (route.needsRequest) {
      handlerParams.req = req;
    }

    // Call handler appropriately based on whether it's async
    if (route.async) {
      await route.handler(handlerParams);
    } else {
      route.handler(handlerParams);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Registers all routes with the Express router
 * @param {Object} router - Express router instance
 */
export const registerRoutes = (router) => {
  routes.forEach((route) => {
    const { path } = route;

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
    console.log(`Registered route: ${method.toUpperCase()} ${path}`);
  });
};

/**
 * Sets up Express with all routes.
 * Must be called in Meteor.isServer context.
 */
export const setupRouter = () => {
  if (!Meteor.isServer) return;

  // Create Express app and router
  const app = WebApp.express();
  const router = WebApp.express.Router();

  registerRoutes(router);

  // Mount router on app
  app.use("/", router);

  // Add router to WebApp handlers
  WebApp.handlers.use(app);
};
