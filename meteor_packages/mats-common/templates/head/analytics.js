import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";

Template.analytics.helpers({
  useProductionAnalytics() {
    const { useProductionAnalytics } = Meteor.settings.public;
    if (typeof useProductionAnalytics === "boolean") {
      return useProductionAnalytics;
    }
    return false; // if useProductionAnalytics is undefined or not a boolean, default to false
  },
});
