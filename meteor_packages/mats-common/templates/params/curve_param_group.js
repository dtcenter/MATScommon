/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections, matsPlotUtils } from "meteor/randyp:mats-common";

const duplicate = function (param) {
  const obj = {};
  const keys = Object.keys(param);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== "_id") {
      obj[keys[i]] = param[keys[i]];
    }
  }
  return obj;
};

const filterParams = function (params) {
  /*
    If the plottype is a 2d scatter plot we need to basically create a new set of parameters (except for the label)
    for each axis. The double set of parameters will get sent back to the backend.
     */
  if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
    const xparams = [];
    const yparams = [];
    let newParams = [];
    for (let i = 0; i < params.length; i++) {
      const xp = duplicate(params[i]);
      xp.name = `xaxis-${params[i].name}`;
      xp.hidden = true;
      xparams.push(xp);
      const yp = duplicate(params[i]);
      yp.name = `yaxis-${params[i].name}`;
      yp.hidden = true;
      yparams.push(yp);
    }
    newParams = newParams.concat(params);
    newParams = newParams.concat(xparams);
    newParams = newParams.concat(yparams);
    return newParams;
  }
  return params;
};

const getParams = function (num) {
  const paramNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  const paramMap = {};
  let params = [];
  let param;
  for (let i = 0; i < paramNames.length; i++) {
    param = matsCollections[paramNames[i]].find({}).fetch()[0];
    if (param.displayGroup === num) {
      paramMap[param.displayOrder] = param;
    }
  }
  const displayOrders = Object.keys(paramMap).sort(function (a, b) {
    return a - b;
  });
  for (let dor = 0; dor < displayOrders.length; dor++) {
    params.push(paramMap[displayOrders[dor]]);
  }
  params = filterParams(params);
  return params;
};

Template.curveParamGroup.helpers({
  CurveParams(num) {
    const restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
    const lastUpdate = Session.get("lastUpdate");
    return getParams(num);
  },
  gapAbove(num) {
    const restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
    const lastUpdate = Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i++) {
      if (params[i].gapAbove) {
        return "margin-top: 1em; border-top: 2px solid gray;";
      }
    }
    return "";
  },
  gapMessage(num) {
    const restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
    const lastUpdate = Session.get("lastUpdate");
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
      for (let i = 0; i < params.length; i++) {
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
              case matsTypes.PlotTypes.scatter2d:
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
    const restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
    const lastUpdate = Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i++) {
      if (params[i].gapAbove) {
        return "margin-left: 10px; margin-top: 1em;";
      }
    }
    return "margin-left: 10px;";
  },
  gapBelow(num) {
    const restoreSettingsTime = Session.get("restoreSettingsTime"); // used to force re-render
    const lastUpdate = Session.get("lastUpdate");
    const params = getParams(num);
    for (let i = 0; i < params.length; i++) {
      if (params[i].gapBelow) {
        return "margin-bottom: 2em;";
      }
    }
    return "";
  },
  displayGroup() {
    return "block";
  },
  log() {
    console.log(this);
  },
});
