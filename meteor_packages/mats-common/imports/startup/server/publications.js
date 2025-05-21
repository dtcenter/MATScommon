/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import { matsCollections } from "meteor/randyp:mats-common";
import { curveParamsByApp } from "../both/mats-curve-params";

/* eslint-disable no-console */
const publishField = function (field) {
  Meteor.publish(field, function () {
    const data = matsCollections[field].findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
};

if (Meteor.isServer) {
  const params = curveParamsByApp[Meteor.settings.public.app];
  if (!params) {
    console.log(
      "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
    );
    throw new Meteor.Error(
      "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
    );
  }
  let currParam;
  for (let i = 0; i < params.length; i += 1) {
    currParam = params[i];
    publishField(currParam);
  }
  Meteor.publish("CurveParamsInfo", function () {
    const data = matsCollections.CurveParamsInfo.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("AppsToScore", function () {
    const data = matsCollections.AppsToScore.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("CurveTextPatterns", function () {
    const data = matsCollections.CurveTextPatterns.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("ScatterAxisTextPattern", function () {
    const data = matsCollections.ScatterAxisTextPattern.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("SavedCurveParams", function () {
    const data = matsCollections.SavedCurveParams.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("PlotParams", function () {
    const data = matsCollections.PlotParams.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("Scatter2dParams", function () {
    const data = matsCollections.Scatter2dParams.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("PlotGraphFunctions", function () {
    const data = matsCollections.PlotGraphFunctions.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("ColorScheme", function () {
    const data = matsCollections.ColorScheme.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("Settings", function () {
    const data = matsCollections.Settings.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("CurveSettings", function () {
    const data = matsCollections.CurveSettings.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("SentAddresses", function () {
    const data = matsCollections.SentAddresses.findAsync({ userId: this.userId });
    if (data) {
      return data;
    }
    return this.ready();
  });

  // do not publish databases
  // Meteor.publish("Databases", function () {
  //     var data = matsCollections.Databases.findAsync({});
  //     if (data) {
  //         return data;
  //     }
  //     return this.ready();
  // });
  Meteor.publish("SiteMap", function () {
    const data = matsCollections.SiteMap.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("StationMap", function () {
    const data = matsCollections.StationMap.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
  Meteor.publish("Scorecard", function () {
    const data = matsCollections.Scorecard.findAsync({});
    if (data) {
      return data;
    }
    return this.ready();
  });
}
