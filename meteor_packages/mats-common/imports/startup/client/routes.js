/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";

/* global Session */

// Routes

// make sure calls to /int-mats actually go to the top-level MATS directory, and are served the home page
// the URL is still decided in settings.json, in case we move from gsl.noaa.gov in the future
FlowRouter.route("/int-mats", {
  name: "homeBypassIntMats",
  action() {
    window.location.href = Meteor.settings.public.home;
  },
});

// make sure calls to /mats actually go to the top-level MATS directory, and are served the home page
// the URL is still decided in settings.json, in case we move from gsl.noaa.gov in the future
FlowRouter.route("/mats", {
  name: "homeBypassMats",
  action() {
    window.location.href = Meteor.settings.public.home;
  },
});

// should happen after the above, so render the home template
FlowRouter.route("/", {
  name: "main",
  action() {
    if (Meteor.settings.public.custom) {
      this.render("customHome");
    } else if (
      Meteor.settings.public.undefinedRoles !== undefined &&
      Meteor.settings.public.undefinedRoles.length > 0
    ) {
      this.render("configure");
    } else {
      this.render("home");
    }
  },
});

// pop-up that doesn't need anything rendered, but serves a CSV download
FlowRouter.route("/CSV/:graphFunction/:key/:matching/:appName", {
  name: "csv",
  action() {
    window.location.href = FlowRouter.current().path;
  },
});

// pop-up that doesn't need anything rendered, but serves a JSON download
FlowRouter.route("/JSON/:graphFunction/:key/:matching/:appName", {
  name: "json",
  action() {
    window.location.href = FlowRouter.current().path;
  },
});

// pop-up that needs a stand-alone graph rendered
FlowRouter.route("/preview/:graphFunction/:key/:matching/:appName", {
  name: "preview",
  action(params) {
    this.render("graphStandAlone", params);
  },
});

// pop-up that needs a scorecard rendered
FlowRouter.route("/scorecardDisplay/:userName/:name/:submitted/:processedAt", {
  name: "scorecardDisplay",
  action(params) {
    this.render("scorecardDisplay", params);
  },
});

// new MATS window that will display timeseries data for a given scorecard key
// needs to start by rendering the home page
FlowRouter.route("/scorecardTimeseries/:key", {
  name: "scorecardTimeseries",
  action(params) {
    Session.set("scorecardTimeseriesKey", params.key);
    if (Meteor.settings.public.custom) {
      this.render("customHome");
    } else {
      this.render("home");
    }
  },
});

// exception routes
FlowRouter.route("/*", {
  action() {
    this.render("notFound");
  },
});
