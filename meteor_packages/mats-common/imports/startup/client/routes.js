/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";

/* global Session */

// localhost routes

FlowRouter.route("/", {
  name: "main",
  action() {
    if (Meteor.settings.public.scorecard) {
      this.render("scorecardHome");
    } else if (Meteor.settings.public.custom) {
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

FlowRouter.route("/CSV/:graphFunction/:key/:matching/:appName", {
  name: "csv",
  action() {
    window.location.href = FlowRouter.path;
  },
});

FlowRouter.route("/JSON/:graphFunction/:key/:matching/:appName", {
  name: "json",
  action() {
    window.location.href = FlowRouter.path;
  },
});

FlowRouter.route("/preview/:graphFunction/:key/:matching/:appName", {
  name: "preview",
  action(params) {
    this.render("graphStandAlone", params);
  },
});

FlowRouter.route("/scorecardDisplay/:userName/:name/:submitted/:processedAt", {
  name: "scorecardDisplay",
  action(params) {
    this.render("scorecardDisplay", params);
  },
});

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

// prefix routes
FlowRouter.route(`${Meteor.settings.public.proxy_prefix_path}/`, {
  name: "main",
  action() {
    if (Meteor.settings.public.scorecard) {
      this.render("scorecardHome");
    } else if (Meteor.settings.public.custom) {
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

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/CSV/:graphFunction/:key/:matching/:appName`,
  {
    name: "csv",
    action() {
      window.location.href = FlowRouter.path;
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/JSON/:graphFunction/:key/:matching/:appName`,
  {
    name: "json",
    action() {
      window.location.href = FlowRouter.path;
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/preview/:graphFunction/:key/:matching/:appName`,
  {
    name: "preview",
    action(params) {
      this.render("graphStandAlone", params);
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/scorecardDisplay/:userName/:name/:submitted/:processedAt`,
  {
    name: "scorecardDisplay",
    action(params) {
      this.render("scorecardDisplay", params);
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/scorecardTimeseries/:key`,
  {
    name: "scorecardTimeseries",
    action(params) {
      Session.set("scorecardTimeseriesKey", params.key);
      if (Meteor.settings.public.custom) {
        this.render("customHome");
      } else {
        this.render("home");
      }
    },
  }
);

// appname routes
FlowRouter.route(`${Meteor.settings.public.proxy_prefix_path}/:appName`, {
  name: "main",
  action() {
    if (Meteor.settings.public.scorecard) {
      this.render("scorecardHome");
    } else if (Meteor.settings.public.custom) {
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

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/*/CSV/:graphFunction/:key/:matching/:appName`,
  {
    name: "csv",
    action() {
      window.location.href = FlowRouter.path;
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/*/JSON/:graphFunction/:key/:matching/:appName`,
  {
    name: "json",
    action() {
      window.location.href = FlowRouter.path;
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/*/preview/:graphFunction/:key/:matching/:appName`,
  {
    name: "preview",
    action(params) {
      this.render("graphStandAlone", params);
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/*/scorecardDisplay/:userName/:name/:submitted/:processedAt`,
  {
    name: "scorecardDisplay",
    action(params) {
      this.render("scorecardDisplay", params);
    },
  }
);

FlowRouter.route(
  `${Meteor.settings.public.proxy_prefix_path}/*/scorecardTimeseries/:key`,
  {
    name: "scorecardTimeseries",
    action(params) {
      Session.set("scorecardTimeseriesKey", params.key);
      if (Meteor.settings.public.custom) {
        this.render("customHome");
      } else {
        this.render("home");
      }
    },
  }
);

// exception routes
FlowRouter.route(`${Meteor.settings.public.proxy_prefix_path}/*/`, {
  name: "main",
  action() {
    this.render("notFound");
  },
});

FlowRouter.route("/*", {
  action() {
    this.render("notFound");
  },
});
