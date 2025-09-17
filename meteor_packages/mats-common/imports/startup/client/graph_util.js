/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCurveUtils } from "meteor/randyp:mats-common";

/* global $, Session */
/* eslint-disable no-console */

// set the label for the hide show buttons (NO DATA) for the initial time here
const setNoDataLabels = function (dataset) {
  for (let c = 0; c < dataset.length; c += 1) {
    if (dataset[c].x.length === 0) {
      Session.set(`${dataset[c].curveId}hideButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).value =
          "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide`
        ).disabled = true;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style[
          "background-color"
        ] = "red";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style[
          "border-color"
        ] = "black";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style.color =
          "white";
      }
      Session.set(`${dataset[c].curveId}pointsButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).value =
          "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-points`
        ).disabled = true;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).style[
          "background-color"
        ] = "red";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).style[
          "border-color"
        ] = "black";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-points`
        ).style.color = "white";
      }
      Session.set(`${dataset[c].curveId}errorBarButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-errorbars`)) {
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).value = "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).disabled = true;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style["background-color"] = "red";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style["border-color"] = "black";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style.color = "white";
      }
      Session.set(`${dataset[c].curveId}barChartButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).value =
          "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-bars`
        ).disabled = true;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).style[
          "background-color"
        ] = "red";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).style[
          "border-color"
        ] = "black";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-bars`
        ).style.color = "white";
      }
      Session.set(`${dataset[c].curveId}annotateButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`)) {
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).value = "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).disabled = true;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`).style[
          "background-color"
        ] = "red";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`).style[
          "border-color"
        ] = "black";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).style.color = "white";
      }
    } else {
      Session.set(`${dataset[c].curveId}hideButtonText`, "hide curve");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).value =
          "hide curve";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide`
        ).disabled = false;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style[
          "background-color"
        ] = "white";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style[
          "border-color"
        ] = dataset[c].marker.color;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide`).style.color =
          dataset[c].marker.color;
      }
      Session.set(`${dataset[c].curveId}pointsButtonText`, "hide points");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).value =
          "hide points";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-points`
        ).disabled = false;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).style[
          "background-color"
        ] = "white";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-points`).style[
          "border-color"
        ] = dataset[c].marker.color;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-points`
        ).style.color = dataset[c].marker.color;
      }
      Session.set(`${dataset[c].curveId}errorBarButtonText`, "hide error bars");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-errorbars`)) {
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).value = "hide error bars";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).disabled = false;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style["background-color"] = "white";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style["border-color"] = dataset[c].marker.color;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-errorbars`
        ).style.color = dataset[c].marker.color;
      }
      Session.set(`${dataset[c].curveId}barChartButtonText`, "hide bars");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).value =
          "hide bars";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-bars`
        ).disabled = false;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).style[
          "background-color"
        ] = "white";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-bars`).style[
          "border-color"
        ] = dataset[c].marker.color;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-bars`
        ).style.color = dataset[c].marker.color;
      }
      Session.set(`${dataset[c].curveId}annotateButtonText`, "hide annotation");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`)) {
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).value = "hide annotation";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).disabled = false;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`).style[
          "background-color"
        ] = "white";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-annotate`).style[
          "border-color"
        ] = dataset[c].marker.color;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-annotate`
        ).style.color = dataset[c].marker.color;
      }
    }
  }
};

const setNoDataLabelsMap = function (dataset) {
  for (let c = 0; c < dataset.length; c += 1) {
    if (dataset[c].lat.length === 0) {
      Session.set(`${dataset[c].curveId}heatMapButtonText`, "NO DATA");
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).value =
          "NO DATA";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-heatmap`
        ).disabled = true;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).style[
          "background-color"
        ] = "red";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).style[
          "border-color"
        ] = "black";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-heatmap`
        ).style.color = "white";
      }
    } else {
      let heatMapText;
      if (dataset[c].datatype === "ctc") {
        heatMapText = "hide heat map";
      } else {
        heatMapText = "show heat map";
      }
      Session.set(`${dataset[c].curveId}heatMapButtonText`, heatMapText);
      if (document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`)) {
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).value =
          heatMapText;
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-heatmap`
        ).disabled = false;
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).style[
          "background-color"
        ] = "white";
        document.getElementById(`${dataset[c].curveId}-curve-show-hide-heatmap`).style[
          "border-color"
        ] = "red";
        document.getElementById(
          `${dataset[c].curveId}-curve-show-hide-heatmap`
        ).style.color = "red";
      }
    }
  }
};

const standAloneSquareWidthHeight = function () {
  console.log("squareWidthHeight");
  const vpw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vph = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
  const min = Math.min(vpw, vph);
  return `${(0.9 * min).toString()}px`;
};
const standAloneRectangleWidth = function () {
  console.log("rectangleWidth");
  const vpw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  return `${(0.925 * vpw).toString()}px`;
};
const standAloneRectangleHeight = function () {
  console.log("rectangleHeight");
  const vph = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
  return `${(0.825 * vph).toString()}px`;
};

const squareWidthHeight = function () {
  const vpw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vph = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
  const min = Math.min(vpw, vph);
  return `${(0.7 * min).toString()}px`;
};
const rectangleWidth = function () {
  const vpw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  return `${vpw.toString()}px`;
};
const rectangleHeight = function () {
  const vph = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
  return `${(0.7 * vph).toString()}px`;
};

// plot width helper used in multiple places
const width = function (plotType) {
  switch (plotType) {
    case matsTypes.PlotTypes.profile:
    case matsTypes.PlotTypes.reliability:
    case matsTypes.PlotTypes.roc:
    case matsTypes.PlotTypes.performanceDiagram:
    case matsTypes.PlotTypes.simpleScatter:
      // set the width square
      return squareWidthHeight();
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dieoff:
    case matsTypes.PlotTypes.threshold:
    case matsTypes.PlotTypes.validtime:
    case matsTypes.PlotTypes.gridscale:
    case matsTypes.PlotTypes.dailyModelCycle:
    case matsTypes.PlotTypes.yearToYear:
    case matsTypes.PlotTypes.gridscaleProb:
    case matsTypes.PlotTypes.map:
    case matsTypes.PlotTypes.histogram:
    case matsTypes.PlotTypes.ensembleHistogram:
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
    default:
      // set the width wide
      return rectangleWidth();
  }
};

// plot height helper used in multiple places
const height = function (plotType) {
  switch (plotType) {
    case matsTypes.PlotTypes.profile:
    case matsTypes.PlotTypes.reliability:
    case matsTypes.PlotTypes.roc:
    case matsTypes.PlotTypes.performanceDiagram:
    case matsTypes.PlotTypes.simpleScatter:
      // set the height square
      return squareWidthHeight();
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dieoff:
    case matsTypes.PlotTypes.threshold:
    case matsTypes.PlotTypes.validtime:
    case matsTypes.PlotTypes.gridscale:
    case matsTypes.PlotTypes.dailyModelCycle:
    case matsTypes.PlotTypes.yearToYear:
    case matsTypes.PlotTypes.gridscaleProb:
    case matsTypes.PlotTypes.map:
    case matsTypes.PlotTypes.histogram:
    case matsTypes.PlotTypes.ensembleHistogram:
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
    default:
      // set the height wide
      return rectangleHeight();
  }
};

// plot width helper used in stand alone graphs
const standAloneWidth = function (plotType) {
  switch (plotType) {
    case matsTypes.PlotTypes.profile:
    case matsTypes.PlotTypes.reliability:
    case matsTypes.PlotTypes.roc:
    case matsTypes.PlotTypes.performanceDiagram:
    case matsTypes.PlotTypes.simpleScatter:
      // set the width square
      return standAloneSquareWidthHeight();
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dieoff:
    case matsTypes.PlotTypes.threshold:
    case matsTypes.PlotTypes.validtime:
    case matsTypes.PlotTypes.gridscale:
    case matsTypes.PlotTypes.dailyModelCycle:
    case matsTypes.PlotTypes.yearToYear:
    case matsTypes.PlotTypes.gridscaleProb:
    case matsTypes.PlotTypes.map:
    case matsTypes.PlotTypes.histogram:
    case matsTypes.PlotTypes.ensembleHistogram:
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
    default:
      // set the width wide
      return standAloneRectangleWidth();
  }
};

// plot height helper used in stand alone graphs
const standAloneHeight = function (plotType) {
  switch (plotType) {
    case matsTypes.PlotTypes.profile:
    case matsTypes.PlotTypes.reliability:
    case matsTypes.PlotTypes.roc:
    case matsTypes.PlotTypes.performanceDiagram:
    case matsTypes.PlotTypes.simpleScatter:
      // set the height square
      return standAloneSquareWidthHeight();
    case matsTypes.PlotTypes.timeSeries:
    case matsTypes.PlotTypes.dieoff:
    case matsTypes.PlotTypes.threshold:
    case matsTypes.PlotTypes.validtime:
    case matsTypes.PlotTypes.gridscale:
    case matsTypes.PlotTypes.dailyModelCycle:
    case matsTypes.PlotTypes.yearToYear:
    case matsTypes.PlotTypes.gridscaleProb:
    case matsTypes.PlotTypes.map:
    case matsTypes.PlotTypes.histogram:
    case matsTypes.PlotTypes.ensembleHistogram:
    case matsTypes.PlotTypes.contour:
    case matsTypes.PlotTypes.contourDiff:
    default:
      // set the height wide
      return standAloneRectangleHeight();
  }
};

const resizeGraph = function (plotType) {
  document.getElementById("placeholder").style.width = width(plotType);
  document.getElementById("placeholder").style.height = height(plotType);
};

// helper to bring up the text page
const setTextView = function (plotType) {
  // shows text page and proper text output, hides everything else
  Session.set("isTextPage", true);
  Session.set("isGraphPage", false);
  document.getElementById("appTitleText").style.display = "none";
  document.getElementById("placeholder").style.width = width(plotType);
  document.getElementById("placeholder").style.height = height(plotType);
  document.getElementById("graph-container").style.display = "block";
  document.getElementById("paramList").style.display = "none";
  document.getElementById("plotList").style.display = "none";
  document.getElementById("curveList").style.display = "none";
  document.getElementById("plotTypeContainer").style.display = "none";
  document.getElementById("exportButton").style.display = "block";
  document.getElementById("plotButton").style.display = "block";
  document.getElementById("textButton").style.display = "none";
  document.getElementById("curves").style.display = "none";
  document.getElementById("graphView").style.display = "none";
  document.getElementById("textView").style.display = "block";
  document.getElementById("refresh-plot").style.display = "none";
  document.getElementById("plotType").style.display = "none";
  // Enable navigation prompt
  window.onbeforeunload = function () {
    return true;
  };
};

// helper to bring up the graph page
const setGraphView = function (plotType) {
  // shows graph page, hides everything else
  Session.set("isTextPage", false);
  Session.set("isGraphPage", true);
  document.getElementById("appTitleText").style.display = "none";
  document.getElementById("placeholder").style.width = width(plotType);
  document.getElementById("placeholder").style.height = height(plotType);
  document.getElementById("graph-container").style.display = "block";
  document.getElementById("paramList").style.display = "none";
  document.getElementById("plotList").style.display = "none";
  document.getElementById("curveList").style.display = "none";
  document.getElementById("plotTypeContainer").style.display = "none";
  document.getElementById("exportButton").style.display = "none";
  document.getElementById("plotButton").style.display = "none";
  document.getElementById("textButton").style.display = "block";
  document.getElementById("curves").style.display = "block";
  document.getElementById("graphView").style.display = "block";
  document.getElementById("textView").style.display = "none";
  document.getElementById("refresh-plot").style.display = "block";
  document.getElementById("plotType").style.display = "none";
  // Enable navigation prompt
  window.onbeforeunload = function () {
    return true;
  };
};

const setScorecardDisplayView = function () {
  // shows scorecardStatusPage template, hides everything else
  Session.set("isTextPage", false);
  Session.set("isGraphPage", false);
  document.getElementById("appTitleText").style.display = "none";
  document.getElementById("graph-container").style.display = "none";
  document.getElementById("paramList").style.display = "none";
  document.getElementById("plotList").style.display = "none";
  document.getElementById("curveList").style.display = "none";
  document.getElementById("plotTypeContainer").style.display = "none";
  document.getElementById("exportButton").style.display = "none";
  document.getElementById("plotButton").style.display = "none";
  document.getElementById("textButton").style.display = "none";
  document.getElementById("curves").style.display = "none";
  document.getElementById("graphView").style.display = "none";
  document.getElementById("textView").style.display = "none";
  document.getElementById("refresh-plot").style.display = "none";
  document.getElementById("spinner").style.display = "none";
  document.getElementById("scorecardStatus").style.display = "block";
  document.getElementById("plotType").style.display = "none";
  $("#refresh-scorecard").trigger("click");
  // Enable navigation prompt
  window.onbeforeunload = function () {
    return true;
  };
};

// helper to bring up the graph page in a pop-up window
const standAloneSetGraphView = function () {
  // shows graph page, hides everything else
  document.getElementById("placeholder").style.width = standAloneWidth();
  document.getElementById("placeholder").style.height = standAloneHeight();
  document.getElementById("graph-container").style.display = "block";
  document.getElementById("curves").style.display = "block";
  document.getElementById("graphView").style.display = "block";
};

// helper to bring up the main selector page
const setDefaultView = function () {
  // show elements of the main page
  Session.set("isTextPage", false);
  Session.set("isGraphPage", true);
  document.getElementById("appTitleText").style.display = "block";
  document.getElementById("graph-container").style.display = "none";
  document.getElementById("paramList").style.display = "block";
  document.getElementById("plotList").style.display = "block";
  if (Session.get("Curves") !== undefined && Session.get("Curves").length > 0) {
    document.getElementById("curveList").style.display = "block";
  } else {
    document.getElementById("curveList").style.display = "none";
  }
  document.getElementById("plotTypeContainer").style.display = "block";
  document.getElementById("exportButton").style.display = "none";
  document.getElementById("plotButton").style.display = "none";
  document.getElementById("textButton").style.display = "block";
  document.getElementById("curves").style.display = "none";
  document.getElementById("graphView").style.display = "none";
  document.getElementById("textView").style.display = "none";
  document.getElementById("refresh-plot").style.display = "block";
  if (document.getElementById("scorecardStatus")) {
    document.getElementById("plotType").style.display = "none";
    document.getElementById("scorecardStatus").style.display = "none";
  } else {
    document.getElementById("plotType").style.display = "block";
  }
  // Remove navigation prompt
  window.onbeforeunload = null;
};

const graphPlotly = function () {
  // get plot info
  const route = Session.get("route");

  // get dataset info and options
  const resultSet = matsCurveUtils.getGraphResult();
  if (resultSet === null || resultSet === undefined || resultSet.data === undefined) {
    return false;
  }

  // set options
  const { options } = resultSet;
  if (route !== undefined && route !== "") {
    options.selection = [];
  }

  // initialize show/hide button labels
  const dataset = resultSet.data;
  if (Session.get("graphPlotType") !== matsTypes.PlotTypes.map) {
    setNoDataLabels(dataset);
  } else {
    setNoDataLabelsMap(dataset);
  }
  return null;
};

const downloadFile = function (fileURL, fileName) {
  // for non-IE
  if (!window.ActiveXObject) {
    const save = document.createElement("a");
    save.href = fileURL;
    save.target = "_blank";
    const filename = fileURL.substring(fileURL.lastIndexOf("/") + 1);
    save.download = fileName || filename;
    if (
      navigator.userAgent.toLowerCase().match(/(ipad|iphone|safari)/) &&
      navigator.userAgent.search("Chrome") < 0
    ) {
      document.location = save.href;
      // window event not working here
    } else {
      const evt = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: false,
      });
      save.dispatchEvent(evt);
      (window.URL || window.webkitURL).revokeObjectURL(save.href);
    }
  }

  // for IE < 11
  else if (!!window.ActiveXObject && document.execCommand) {
    const thisWindow = window.open(fileURL, "_blank");
    thisWindow.document.close();
    thisWindow.document.execCommand("SaveAs", true, fileName || fileURL);
    thisWindow.close();
  }
};

// eslint-disable-next-line no-undef
export default matsGraphUtils = {
  setNoDataLabels,
  setNoDataLabelsMap,
  width,
  height,
  standAloneWidth,
  standAloneHeight,
  resizeGraph,
  setTextView,
  setGraphView,
  standAloneSetGraphView,
  setDefaultView,
  graphPlotly,
  downloadFile,
  setScorecardDisplayView,
};
