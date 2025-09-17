/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsPlotUtils, matsCollections } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $ */
/* eslint-disable no-console */

const getParams = function (num) {
  const paramNames = matsCollections.CurveParamsInfo.findOne({
    curve_params: { $exists: true },
  }).curve_params;
  const paramMap = {};
  const params = [];
  let param;
  for (let i = 0; i < paramNames.length; i += 1) {
    [param] = matsCollections[paramNames[i]].find({}).fetch();
    if (param.displayGroup === num) {
      paramMap[param.displayOrder] = param;
    }
  }
  const displayOrders = Object.keys(paramMap).sort(function (a, b) {
    return a - b;
  });
  for (let dor = 0; dor < displayOrders.length; dor += 1) {
    params.push(paramMap[displayOrders[dor]]);
  }
  return params;
};

Template.curveParamGroup.helpers({
  CurveParams(num) {
    Session.get("restoreSettingsTime"); // used to force re-render
    Session.get("lastUpdate");
    return getParams(num);
  },
  gapAbove(num) {
    Session.get("restoreSettingsTime"); // used to force re-render
    Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i += 1) {
      if (params[i].gapAbove) {
        return "margin-top: 2em; border-top: 2px solid gray;";
      }
    }
    return "";
  },
  gapMessage(num) {
    Session.get("restoreSettingsTime"); // used to force re-render
    Session.get("lastUpdate");
    const plotType = Session.get("plotType");
    let isMetexpress = false;
    let isCouchbase = false;
    if (
      matsCollections.Settings.findOne({}) !== undefined &&
      matsCollections.Settings.findOne({}).appType !== undefined
    ) {
      isMetexpress =
        matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;
      isCouchbase =
        matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase;
    }
    const params = getParams(num);
    if (isMetexpress || isCouchbase) {
      for (let i = 0; i < params.length; i += 1) {
        if (params[i].gapAbove) {
          if (params[i].name === "aggregation-method") {
            switch (plotType) {
              case matsTypes.PlotTypes.histogram:
              case matsTypes.PlotTypes.ensembleHistogram:
              case matsTypes.PlotTypes.roc:
              case matsTypes.PlotTypes.performanceDiagram:
              case matsTypes.PlotTypes.gridscaleProb:
                return "Date range:";
              case matsTypes.PlotTypes.profile:
              case matsTypes.PlotTypes.dieoff:
              case matsTypes.PlotTypes.threshold:
              case matsTypes.PlotTypes.validtime:
              case matsTypes.PlotTypes.gridscale:
              case matsTypes.PlotTypes.simpleScatter:
                return "Aggregation / Date range:";
              case matsTypes.PlotTypes.timeSeries:
              case matsTypes.PlotTypes.dailyModelCycle:
              case matsTypes.PlotTypes.yearToYear:
              case matsTypes.PlotTypes.map:
              case matsTypes.PlotTypes.contour:
              case matsTypes.PlotTypes.contourDiff:
                return "Aggregation:";
              case matsTypes.PlotTypes.reliability:
              default:
                return "";
            }
          } else {
            return "Filter by parameters:";
          }
        } else if (params[i].name === "label") {
          return "Define the curve:";
        }
      }
    }
    return "";
  },
  gapMessageSpacing(num) {
    Session.get("restoreSettingsTime"); // used to force re-render
    Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i += 1) {
      if (params[i].gapAbove) {
        return "margin-top: 1em;";
      }
    }
    return "";
  },
  gapBelow(num) {
    Session.get("restoreSettingsTime"); // used to force re-render
    Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i += 1) {
      if (params[i].gapBelow) {
        return "margin-bottom: 2em;";
      }
    }
    return "";
  },
  paramWellColor() {
    if (Session.get("paramWellColor") === undefined) {
      Session.set("paramWellColor", "#ffffff");
    }
    if (Session.get("editMode") !== "") {
      const curveBeingEdited = $.grep(Session.get("Curves"), function (c) {
        return c.label === Session.get("editMode");
      });
      if (curveBeingEdited === undefined || curveBeingEdited[0] === undefined) {
        Session.set("paramWellColor", "#ffffff");
        return "#ffffff";
      }
      const { color } = curveBeingEdited[0];
      const lighterShadeOfColor = matsPlotUtils.shadeRGBColor(color, 0.2);
      Session.set("paramWellColor", lighterShadeOfColor);
    }

    return Session.get("paramWellColor");
  },
  displayGroup() {
    return "block";
  },
  log() {
    console.log(this);
  },
});
