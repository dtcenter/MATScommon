import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";

Template.analytics.helpers({
  useProductionAnalytics() {
    const { useProductionAnalytics } = Meteor.settings.public;
    if (typeof useProductionAnalytics === "boolean") {
      return useProductionAnalytics;
    }
    return false; // if not a boolean or undefined, default to false
  },
});
