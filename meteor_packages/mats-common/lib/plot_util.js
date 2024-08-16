/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsParamUtils,
  matsCurveUtils,
  matsTypes,
} from "meteor/randyp:mats-common";
import { moment } from "meteor/momentjs:moment";

/* global $, Session, _ */

// determine the axisText (used in scatter_axis.js for example)
// according to the Scatter Axis Text Patterns Pattern defined in
// ScatterAxisTextPatterns according to plotType - and derived from
// currently selected inputs in the document.
// determine which plotType radio button is checked
const getPlotType = function () {
  return document.getElementById("plotTypes-selector")
    ? document.getElementById("plotTypes-selector").value
    : undefined;
};

// determine which plotFormat radio button is checked
const getPlotFormat = function () {
  const buttons = document.getElementsByName("plotFormat");
  if (buttons === undefined) {
    return ""; // app may not have plotFormat?
  }
  const plotFormatParam = matsCollections.PlotParams.findOne({ name: "plotFormat" });
  if (plotFormatParam === undefined) {
    return ""; // app may not have plotFormat?
  }
  for (let i = 0, len = buttons.length; i < len; i += 1) {
    if (buttons[i].checked) {
      return buttons[i].value;
    }
  }
  return ""; // error condition actually - shouldn't ever happen
};

const getAxisText = function () {
  const scatterAxisTextPattern = matsCollections.ScatterAxisTextPattern.findOne({
    plotType: getPlotType(),
  });
  if (scatterAxisTextPattern === undefined) {
    return "";
  }
  let text = "";
  for (let i = 0; i < scatterAxisTextPattern.length; i += 1) {
    const pName = scatterAxisTextPattern[i][0];
    const delimiter = scatterAxisTextPattern[i][1];
    const value = matsParamUtils.getValueForParamName(pName);
    text += value;
    text += delimiter;
  }
  return text;
};

// determine the curveText (used in curveItem for example) for a given curve (from Session.get('curves'))
// that has already been added
const getCurveText = function (plotType, curve) {
  const curveTextPattern = matsCollections.CurveTextPatterns.findOne({
    plotType,
  }).textPattern;
  let text = "";

  for (let i = 0; i < curveTextPattern.length; i += 1) {
    const a = curveTextPattern[i];
    if (a !== undefined && a !== null && curve[a[1]] !== undefined) {
      text += a[0];
      if (curve[a[1]] instanceof Array && curve[a[1]].length > 2) {
        text += `${curve[a[1]][0]}..${curve[a[1]][curve[a[1]].length - 1]}`;
      } else {
        text += curve[a[1]];
      }
      text += a[2];
    }
  }
  return text;
};

// like getCurveText but with wrapping
const getCurveTextWrapping = function (plotType, curve) {
  const curveTextPattern = matsCollections.CurveTextPatterns.findOne({
    plotType,
  }).textPattern;
  let text = "";
  let wrapLimit = 40;
  for (let i = 0; i < curveTextPattern.length; i += 1) {
    const a = curveTextPattern[i];
    if (a !== undefined && a !== null && curve[a[1]] !== undefined) {
      text += a[0];
      if (curve[a[1]] instanceof Array && curve[a[1]].length > 2) {
        text += `${curve[a[1]][0]}..${curve[a[1]][curve[a[1]].length - 1]}`;
      } else {
        text += curve[a[1]];
      }
      text += a[2];
      if (text.length > wrapLimit) {
        text += "<br>";
        wrapLimit += 40;
      }
    }
  }
  return text;
};

// Determine which BestFit radio button is checked
const getBestFit = function () {
  const buttons = document.getElementsByName("Fit Type");
  for (let i = 0, len = buttons.length; i < len; i += 1) {
    if (buttons[i].checked) {
      return buttons[i].value;
    }
  }
  return ""; // error condition actually - shouldn't ever happen
};

const containsPoint = function (pointArray, point) {
  const lat = point[0];
  const lon = point[1];
  for (let i = 0; i < pointArray.length; i += 1) {
    const pLat = pointArray[i][0];
    const pLon = pointArray[i][1];
    if (lat === pLat && lon === pLon) {
      return true;
    }
  }
  return false;
};

// disable the action buttons while the query and plot routines are processing, then re-enable them afterwards
const disableActionButtons = function () {
  if (document.getElementById("plotMatched")) {
    document.getElementById("plotMatched").disabled = true;
  }
  if (document.getElementById("plotUnmatched")) {
    document.getElementById("plotUnmatched").disabled = true;
  }
  if (document.getElementById("add")) {
    document.getElementById("add").disabled = true;
  }
  if (document.getElementById("remove-all")) {
    document.getElementById("remove-all").disabled = true;
  }
};
const enableActionButtons = function () {
  if (document.getElementById("plotMatched")) {
    document.getElementById("plotMatched").disabled = false;
  }
  if (document.getElementById("plotUnmatched")) {
    document.getElementById("plotUnmatched").disabled = false;
  }
  if (document.getElementById("add")) {
    document.getElementById("add").disabled = false;
  }
  if (document.getElementById("remove-all")) {
    document.getElementById("remove-all").disabled = false;
  }
};

const restoreSettings = function (p) {
  Session.set("Curves", p.data.curves);
  // reset the plotType - have to do this first because the event will remove all the possibly existing curves
  // get the plot-type elements checked state
  let plotTypeSaved = false;
  const plotTypeElems = document.getElementById("plotTypes-selector");
  for (let ptei = 0; ptei < plotTypeElems.length; ptei += 1) {
    const ptElem = plotTypeElems[ptei];
    if (p.data.plotTypes && p.data.plotTypes[ptElem.value] === true) {
      plotTypeSaved = true;
      ptElem.checked = true;
      // We have to set up the display without using click events because that would cause
      // the restored curves to be removed
      switch (ptElem.value) {
        case matsTypes.PlotTypes.profile:
          matsCurveUtils.showProfileFace();
          break;
        case matsTypes.PlotTypes.dieoff:
          matsCurveUtils.showDieoffFace();
          break;
        case matsTypes.PlotTypes.threshold:
          matsCurveUtils.showThresholdFace();
          break;
        case matsTypes.PlotTypes.validtime:
          matsCurveUtils.showValidTimeFace();
          break;
        case matsTypes.PlotTypes.gridscale:
          matsCurveUtils.showGridScaleFace();
          break;
        case matsTypes.PlotTypes.dailyModelCycle:
          matsCurveUtils.showDailyModelCycleFace();
          break;
        case matsTypes.PlotTypes.yearToYear:
          matsCurveUtils.showYearToYearFace();
          break;
        case matsTypes.PlotTypes.reliability:
          matsCurveUtils.showReliabilityFace();
          break;
        case matsTypes.PlotTypes.roc:
          matsCurveUtils.showROCFace();
          break;
        case matsTypes.PlotTypes.performanceDiagram:
          matsCurveUtils.showPerformanceDiagramFace();
          break;
        case matsTypes.PlotTypes.gridscaleProb:
          matsCurveUtils.showGridScaleProbFace();
          break;
        case matsTypes.PlotTypes.map:
          matsCurveUtils.showMapFace();
          break;
        case matsTypes.PlotTypes.histogram:
          matsCurveUtils.showHistogramFace();
          break;
        case matsTypes.PlotTypes.ensembleHistogram:
          matsCurveUtils.showEnsembleHistogramFace();
          break;
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
          matsCurveUtils.showContourFace();
          break;
        case matsTypes.PlotTypes.simpleScatter:
          matsCurveUtils.showSimpleScatterFace();
          break;
        case matsTypes.PlotTypes.scatter2d:
          matsCurveUtils.showScatterFace();
          break;
        case matsTypes.PlotTypes.timeSeries:
        default:
          matsCurveUtils.showTimeseriesFace();
          break;
      }
    } else {
      ptElem.checked = false;
    }
  }
  if (plotTypeSaved !== true) {
    // set the default - in the case none was set in an old saved settings
    document.getElementById("plotTypes-selector").value =
      matsCollections.PlotGraphFunctions.findOne({ checked: true }).plotType;
  }

  // now set the PlotParams
  let params = matsCollections.PlotParams.find({}).fetch();
  params.forEach(function (plotParam) {
    const val =
      p.data.paramData.plotParams[plotParam.name] === null ||
      p.data.paramData.plotParams[plotParam.name] === undefined
        ? matsTypes.InputTypes.unused
        : p.data.paramData.plotParams[plotParam.name];
    matsParamUtils.setInputForParamName(plotParam.name, val);
  });

  const paramNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  params = [];
  const superiors = [];
  const dependents = [];
  // get all of the curve param collections in one place
  for (let pidx = 0; pidx < paramNames.length; pidx += 1) {
    const param = matsCollections[paramNames[pidx]].find({}).fetch()[0];
    // superiors
    if (param.dependentNames !== undefined) {
      superiors.push(param);
      // dependents
    } else if (param.superiorNames !== undefined) {
      dependents.push(param);
      // everything else
    } else {
      params.push(param);
    }
  }

  // reset the form parameters for the superiors first
  superiors.forEach(function (plotParam) {
    if (plotParam.type === matsTypes.InputTypes.dateRange) {
      if (p.data.paramData.curveParams[plotParam.name] === undefined) {
        return; // just like continue
      }
      const dateArr = p.data.paramData.curveParams[plotParam.name].split(" - ");
      const from = dateArr[0];
      const to = dateArr[1];
      const idref = `#${plotParam.name}-${plotParam.type}`;
      $(idref)
        .data("daterangepicker")
        .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
      $(idref).data("daterangepicker").setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
      matsParamUtils.setValueTextForParamName(
        plotParam.name,
        p.data.paramData.curveParams[plotParam.name]
      );
    } else {
      const val =
        p.data.paramData.curveParams[plotParam.name] === null ||
        p.data.paramData.curveParams[plotParam.name] === undefined
          ? matsTypes.InputTypes.unused
          : p.data.paramData.curveParams[plotParam.name];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
  });

  // now reset the form parameters for the dependents
  params = _.union(dependents, params);
  params.forEach(function (plotParam) {
    if (plotParam.type === matsTypes.InputTypes.dateRange) {
      if (p.data.paramData.curveParams[plotParam.name] === undefined) {
        return; // just like continue
      }
      const dateArr = p.data.paramData.curveParams[plotParam.name].split(" - ");
      const from = dateArr[0];
      const to = dateArr[1];
      const idref = `#${plotParam.name}-${plotParam.type}`;
      $(idref)
        .data("daterangepicker")
        .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
      $(idref).data("daterangepicker").setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
      matsParamUtils.setValueTextForParamName(
        plotParam.name,
        p.data.paramData.curveParams[plotParam.name]
      );
    } else {
      const val =
        p.data.paramData.curveParams[plotParam.name] === null ||
        p.data.paramData.curveParams[plotParam.name] === undefined
          ? matsTypes.InputTypes.unused
          : p.data.paramData.curveParams[plotParam.name];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
  });

  // reset the scatter parameters
  params = matsCollections.Scatter2dParams.find({}).fetch();
  params.forEach(function (plotParam) {
    const val =
      p.data.paramData.scatterParams[plotParam.name] === null ||
      p.data.paramData.scatterParams[plotParam.name] === undefined
        ? matsTypes.InputTypes.unused
        : p.data.paramData.scatterParams[plotParam.name];
    matsParamUtils.setInputForParamName(plotParam.name, val);
  });

  // reset the dates
  if (p.data.dates !== undefined) {
    const dateArr = p.data.dates.split(" - ");
    const from = dateArr[0];
    const to = dateArr[1];
    $(`#dates-${matsTypes.InputTypes.dateRange}`)
      .data("daterangepicker")
      .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
    $(`#dates-${matsTypes.InputTypes.dateRange}`)
      .data("daterangepicker")
      .setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
    matsParamUtils.setValueTextForParamName("dates", p.data.dates);
  }

  // reset the plotFormat
  // reset the plotParams
  Session.set("PlotParams", p);
  // set the used defaults so that subsequent adds get a core default
  matsCurveUtils.setUsedColorsAndLabels();
  document.getElementById("restore_from_public").value = "";
  document.getElementById("restore_from_private").value = "";
  $("#restoreModal").modal("hide");
  Session.set("spinner_img", "spinner.gif");
  document.getElementById("spinner").style.display = "none";
  matsParamUtils.collapseParams();
};

// eslint-disable-next-line no-undef
export default matsPlotUtils = {
  getAxisText,
  getCurveText,
  getCurveTextWrapping,
  getPlotType,
  getPlotFormat,
  getBestFit,
  containsPoint,
  disableActionButtons,
  enableActionButtons,
  restoreSettings,
};
