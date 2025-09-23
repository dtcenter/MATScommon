/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import matsCollections from "meteor/randyp:mats-common";
import { curveParamsByApp } from "../both/mats-curve-params";

/* global Session, $ */
/* eslint-disable no-console */

if (Meteor.isClient) {
  const params = curveParamsByApp[Meteor.settings.public.app];
  if (!params) {
    console.log(
      "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
    );
    throw new Meteor.Error(
      "curveParams are not defined in imports/startup/both/mats-curve-params.js. Please define some curveParams for this app."
    );
  }
  for (let i = 0; i < params.length; i += 1) {
    Meteor.subscribe(params[i]);
  }
  Meteor.subscribe("metaDataTableUpdates");
  Meteor.subscribe("CurveParamsInfo");
  Meteor.subscribe("AppsToScore");
  Meteor.subscribe("SavedCurveParams");
  Meteor.subscribe("PlotParams");
  Meteor.subscribe("PlotGraphFunctions");
  Meteor.subscribe("ColorScheme");
  Meteor.subscribe("Settings");
  Meteor.subscribe("CurveSettings");
  Meteor.subscribe("Databases");
  Meteor.subscribe("CurveTextPatterns");
  Meteor.subscribe("SiteMap");
  Meteor.subscribe("StationMap");
  Meteor.subscribe("LayoutStoreCollection");
  Meteor.subscribe("Scorecard");
  Session.set("Curves", []);
  Session.set("PlotParams", []);

  const ref = window.location.href;
  const pathArray = window.location.href.split("/");
  const protocol = pathArray[0];
  const hostport = pathArray[2];
  const hostName = hostport.split(":")[0];
  const app = pathArray[3] === "" ? "/" : pathArray[3];
  const matsRef = `${protocol}//${hostport}`;
  const baseURL =
    Meteor.settings.public.home === undefined
      ? `https://${hostport}`
      : Meteor.settings.public.home;
  let helpRef = `${baseURL}/${app}/packages/randyp_mats-common/public/public/help`;
  if (baseURL.includes("localhost")) {
    helpRef = `${baseURL}/packages/randyp_mats-common/public/help`;
  }
  Session.set("app", {
    appName: app,
    matsref: matsRef,
    appref: ref,
    helpref: helpRef,
    hostName,
  });
  const collections = Object.keys(matsCollections).map((key) => matsCollections[key]);
  Session.set("Mongol", {
    collections,
    display: false,
    opacity_normal: ".7",
    opacity_expand: ".9",
    disable_warning: true,
  });
  $(document).ready(function () {
    $("html").attr("lang", "en");
  });
}
