/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $, setError, setInfo */

Template.plotType.helpers({
  plotTypes() {
    return matsCollections.PlotGraphFunctions.find({}).fetch();
  },
  display() {
    // don't display the choice if there is only one choice
    if (matsCollections.PlotGraphFunctions.find({}).fetch().length === 1) {
      return "hidden";
    }
    return "";
  },
  selected(plotType) {
    // don't display the choice if there is only one choice
    if (matsCollections.PlotGraphFunctions.findOne({ plotType }).checked) {
      return "selected";
    }
    return "";
  },
  spaced(plotType) {
    // space out the plot type names to be more readable
    return plotType.replace(/([A-Z][a-z])/g, " $1").trim();
  },
});

const matchPlotTypeSelector = function (plotType) {
  // used in met apps to only display the options appropriate to a particular plot type in each selector
  if (
    matsCollections["plot-type"] !== undefined &&
    matsCollections["plot-type"].findOne({ name: "plot-type" }) !== undefined
  ) {
    const isMetexpress =
      matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;
    const currentDatabase = matsParamUtils.getValueForParamName("database");
    const currentDataSource = matsParamUtils.getValueForParamName("data-source");
    if (
      (isMetexpress &&
        matsCollections["plot-type"]
          .findOne({ name: "plot-type" })
          .optionsMap[currentDatabase][currentDataSource].indexOf(plotType) !== -1) ||
      (!isMetexpress &&
        matsCollections["plot-type"]
          .findOne({ name: "plot-type" })
          .options.indexOf(plotType) !== -1)
    ) {
      matsParamUtils.setInputValueForParamAndTriggerChange("plot-type", plotType);
    } else {
      setInfo(
        `INFO:  Plot type ${plotType} is not available for the database/model combination ${currentDatabase} and ${currentDataSource}.`
      );
    }
  }
};

const setDatesAndShowFace = function (plotType, dateSelector) {
  // display appropriate selectors for each plot type, and make sure the previous dates or curve-dates values
  // carry across to the appropriate new selector
  let oldDatesExist;
  if (dateSelector === "dates") {
    oldDatesExist = matsParamUtils.isParamVisible("dates");
  } else if (dateSelector === "curve-dates") {
    oldDatesExist = matsParamUtils.isParamVisible("curve-dates");
  }
  let selectorsToReset = {};
  switch (plotType) {
    case matsTypes.PlotTypes.profile:
      selectorsToReset = matsCurveUtils.showProfileFace();
      break;
    case matsTypes.PlotTypes.dieoff:
      selectorsToReset = matsCurveUtils.showDieoffFace();
      break;
    case matsTypes.PlotTypes.threshold:
      selectorsToReset = matsCurveUtils.showThresholdFace();
      break;
    case matsTypes.PlotTypes.validtime:
      selectorsToReset = matsCurveUtils.showValidTimeFace();
      break;
    case matsTypes.PlotTypes.gridscale:
      selectorsToReset = matsCurveUtils.showGridScaleFace();
      break;
    case matsTypes.PlotTypes.dailyModelCycle:
      selectorsToReset = matsCurveUtils.showDailyModelCycleFace();
      break;
    case matsTypes.PlotTypes.yearToYear:
      selectorsToReset = matsCurveUtils.showYearToYearFace();
      break;
    case matsTypes.PlotTypes.reliability:
      selectorsToReset = matsCurveUtils.showReliabilityFace();
      break;
    case matsTypes.PlotTypes.roc:
      selectorsToReset = matsCurveUtils.showROCFace();
      break;
    case matsTypes.PlotTypes.performanceDiagram:
      selectorsToReset = matsCurveUtils.showPerformanceDiagramFace();
      break;
    case matsTypes.PlotTypes.gridscaleProb:
      selectorsToReset = matsCurveUtils.showGridScaleProbFace();
      break;
    case matsTypes.PlotTypes.map:
      selectorsToReset = matsCurveUtils.showMapFace();
      break;
    case matsTypes.PlotTypes.histogram:
      selectorsToReset = matsCurveUtils.showHistogramFace();
      break;
    case matsTypes.PlotTypes.ensembleHistogram:
      selectorsToReset = matsCurveUtils.showEnsembleHistogramFace();
      break;
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
      selectorsToReset = matsCurveUtils.showContourFace();
      break;
    case matsTypes.PlotTypes.simpleScatter:
      selectorsToReset = matsCurveUtils.showSimpleScatterFace();
      break;
    case matsTypes.PlotTypes.scatter2d:
      selectorsToReset = matsCurveUtils.showScatterFace();
      break;
    case matsTypes.PlotTypes.timeSeries:
    default:
      selectorsToReset = matsCurveUtils.showTimeseriesFace();
      break;
  }
  if (dateSelector === "dates") {
    if (!oldDatesExist) {
      const curveDate = $("#controlButton-curve-dates-value").text();
      matsParamUtils.setValueTextForParamName("dates", curveDate);
      return [curveDate, selectorsToReset];
    }
    return [0, selectorsToReset];
  }
  if (dateSelector === "curve-dates") {
    if (!oldDatesExist) {
      const tsDate = $("#controlButton-dates-value").text();
      matsParamUtils.setValueTextForParamName("curve-dates", tsDate);
      return [tsDate, selectorsToReset];
    }
    return [0, selectorsToReset];
  }
  return [0, selectorsToReset];
};

const changePlotType = function (plotType, selectorsToInitialize, dateSelector) {
  if (Session.get("confirmPlotChange")) {
    // change has been confirmed
    // the MET apps have a hidden plot-type selector than needs to match the actual plot type
    matchPlotTypeSelector(plotType);

    // display appropriate selectors for this plot type, and make sure the previous dates or curve-dates values
    // carry across to the appropriate new selector
    let newDate = 0;
    let selectorsToReset = {};
    [newDate, selectorsToReset] = setDatesAndShowFace(plotType, dateSelector);
    const resetSelectors = Object.keys(selectorsToReset);

    // make sure the curves already added also have the correct parameters displayed
    const curves = Session.get("Curves");
    if (curves === undefined) {
      // in a healthy session, there should either be an array of curves or an empty array of no curves
      setError(
        new Error(
          "It looks like your current browser session might have expired, so there is not enough information to successfully change the plot type. Please refresh your browser window."
        )
      );
    }
    if (curves.length > 0) {
      for (let ci = curves.length - 1; ci >= 0; ci -= 1) {
        // remove any difference curves for plot types that don't support them
        let curveGone = false;
        if (curves[ci].diffFrom !== undefined && curves[ci].diffFrom !== null) {
          switch (plotType) {
            case matsTypes.PlotTypes.reliability:
            case matsTypes.PlotTypes.roc:
            case matsTypes.PlotTypes.performanceDiagram:
            case matsTypes.PlotTypes.simpleScatter:
            case matsTypes.PlotTypes.scatter2d:
            case matsTypes.PlotTypes.map:
            case matsTypes.PlotTypes.contour:
            case matsTypes.PlotTypes.contourDiff:
              curves.splice(ci, 1);
              curveGone = true;
              break;
            case matsTypes.PlotTypes.timeSeries:
            case matsTypes.PlotTypes.profile:
            case matsTypes.PlotTypes.dieoff:
            case matsTypes.PlotTypes.threshold:
            case matsTypes.PlotTypes.validtime:
            case matsTypes.PlotTypes.gridscale:
            case matsTypes.PlotTypes.dailyModelCycle:
            case matsTypes.PlotTypes.yearToYear:
            case matsTypes.PlotTypes.gridscaleProb:
            case matsTypes.PlotTypes.histogram:
            case matsTypes.PlotTypes.ensembleHistogram:
            default:
              curveGone = false;
              break;
          }
        }
        if (!curveGone) {
          // change options that were valid for the plot type where this curve was added but not for this one
          for (let ri = 0; ri < resetSelectors.length; ri += 1) {
            if (curves[ci][resetSelectors[ri]] !== undefined) {
              curves[ci][resetSelectors[ri]] = selectorsToReset[resetSelectors[ri]];
            }
          }
          // initialize options for parameters not used in the plot type where this curve was added
          for (let si = 0; si < selectorsToInitialize.length; si += 1) {
            if (dateSelector === "curve-dates" && newDate !== 0) {
              curves[ci]["curve-dates"] = newDate;
            }
            if (
              !curves[ci][selectorsToInitialize[si]] &&
              matsCollections[selectorsToInitialize[si]] &&
              matsCollections[selectorsToInitialize[si]].findOne({
                name: selectorsToInitialize[si],
              })
            ) {
              if (
                matsCollections[selectorsToInitialize[si]].findOne({
                  name: selectorsToInitialize[si],
                }).default
              ) {
                // we have a default. Use that.
                curves[ci][selectorsToInitialize[si]] = matsCollections[
                  selectorsToInitialize[si]
                ].findOne({ name: selectorsToInitialize[si] }).default;
              } else if (
                matsCollections[selectorsToInitialize[si]].findOne({
                  name: selectorsToInitialize[si],
                }).options
              ) {
                // we don't have a default, but we have a list of options. Use the first one of those.
                [curves[ci][selectorsToInitialize[si]]] = matsCollections[
                  selectorsToInitialize[si]
                ].findOne({ name: selectorsToInitialize[si] }).options;
              }
            }
          }
        }
      }
      Session.set("Curves", curves);
    }
    Session.set("confirmPlotChange", "");
    Session.set("plotChangeType", "");
  } else if (Session.get("Curves").length > 0) {
    Session.set("plotChangeType", plotType);
    $("#modal-change-plot-type").modal();
  } else {
    // no curves - just set the new plot type face
    // the MET apps have a hidden plot-type selector than needs to match the actual plot type
    matchPlotTypeSelector(plotType);

    // display appropriate selectors for this plot type, and make sure the previous dates or curve-dates values
    // carry across to the appropriate new selector
    setDatesAndShowFace(plotType, dateSelector);
  }
};

Template.plotType.events({
  "change .plotTypes-selector"() {
    const plotType = document
      .getElementById("plotTypes-selector")
      .value.replace(" ", "");
    let selectorsToInitialize = [];
    let dateSelector = "dates";
    switch (plotType) {
      case matsTypes.PlotTypes.profile:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.dieoff:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "probability-bins",
          "dieoff-type",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.threshold:
        selectorsToInitialize = [
          "statistic",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.validtime:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.gridscale:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.dailyModelCycle:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "probability-bins",
          "utc-cycle-start",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.yearToYear:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "region-type",
          "region",
        ];
        dateSelector = "none";
        break;
      case matsTypes.PlotTypes.reliability:
        selectorsToInitialize = [
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.roc:
        selectorsToInitialize = [
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        selectorsToInitialize = [
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
          "bin-parameter",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.gridscaleProb:
        selectorsToInitialize = [
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.map:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
        ];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.histogram:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.ensembleHistogram:
        selectorsToInitialize = [
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.contour:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
          "x-axis-parameter",
          "y-axis-parameter",
        ];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.contourDiff:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
          "x-axis-parameter",
          "y-axis-parameter",
        ];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.simpleScatter:
        selectorsToInitialize = [
          "x-statistic",
          "y-statistic",
          "x-variable",
          "y-variable",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
          "bin-parameter",
        ];
        dateSelector = "curve-dates";
        break;
      case matsTypes.PlotTypes.scatter2d:
        selectorsToInitialize = [];
        dateSelector = "dates";
        break;
      case matsTypes.PlotTypes.timeSeries:
      default:
        selectorsToInitialize = [
          "statistic",
          "threshold",
          "scale",
          "level",
          "forecast-length",
          "probability-bins",
          "average",
          "valid-time",
          "truth",
          "year",
          "storm",
          "region-type",
          "region",
        ];
        dateSelector = "dates";
        break;
    }
    changePlotType(plotType, selectorsToInitialize, dateSelector);
  },
});
