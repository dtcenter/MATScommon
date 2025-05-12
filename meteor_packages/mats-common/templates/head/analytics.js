import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";

Template.head.helpers({
  title() {
    const appTitle = Meteor.settings.public.title;
    // Handle if appTitle is not a string, or is undefined
    if (
      typeof appTitle === "undefined" ||
      typeof appTitle !== "string" ||
      !(appTitle instanceof String)
    ) {
      return "";
    }
    return appTitle;
  },
  isMetexpress() {
    // TODO - the canonical way to do this is to inspect matsCollections.Settings
    // as METexpress-ness is manually set by each app in it's call to matsMethods.resetApp.

    // However, we'd need to wait on a connection to mongo. For now, utilize the
    // public.app field in settings.json for now to avoid startup latency
    const appName = Meteor.settings.public.app;
    if (typeof appName === "undefined") {
      return false;
    }
    if (appName.starstWith("met-")) {
      return true;
    }
    return false;
  },
  useProductionAnalytics() {
    const { useProductionAnalytics } = Meteor.settings.public;
    if (typeof useProductionAnalytics === "boolean") {
      return useProductionAnalytics;
    }
    return false;
  },
});
