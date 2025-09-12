/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import {
  matsCollections,
  matsCurveUtils,
  matsPlotUtils,
  matsTypes,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session */

/*
Referring to the Session variable plotResultKey here causes the html template to get re-rendered with the current graph data
(which is in the Results collection).
 */
let fillStr = "---";

// fetches the data back from where the query routine stored it.
const getDataForCurve = function (curve) {
  if (
    Session.get("plotResultKey") === undefined ||
    matsCurveUtils.getPlotResultData() === undefined
  ) {
    return undefined;
  }
  if (matsCurveUtils.getPlotResultData() === null) {
    return [];
  }
  return matsCurveUtils.getPlotResultData().data[curve.label];
};

Template.textOutput.onRendered(function () {
  const settings = matsCollections.Settings.findOne(
    {},
    { fields: { NullFillString: 1 } }
  );
  if (settings === undefined) {
    fillStr = "---";
  } else {
    fillStr = settings.NullFillString;
  }
});

Template.textOutput.helpers({
  // get the table header for the summary stats at the top of the text page
  statHeaders() {
    let header = "";
    switch (Session.get("plotType")) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>mean</th><th class='table-info' scope='col'>standard deviation</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>standard error</th><th class='table-info' scope='col'>lag1</th><th class='table-info' scope='col'>minimum</th><th class='table-info' scope='col'>maximum</th>";
        break;
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.yearToYear:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>mean</th><th class='table-info' scope='col'>standard deviation</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>minimum</th><th class='table-info' scope='col'>maximum</th>";
        break;
      case matsTypes.PlotTypes.reliability:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>sample climatology</th>";
        break;
      case matsTypes.PlotTypes.roc:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>area under the ROC curve</th>";
        break;
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
        header += "";
        break;
      case matsTypes.PlotTypes.map:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>mean</th><th class='table-info' scope='col'>standard deviation</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>minimum time</th><th class='table-info' scope='col'>maximum time</th>";
        break;
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>mean</th><th class='table-info' scope='col'>standard deviation</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>minimum</th><th class='table-info' scope='col'>maximum</th>";
        break;
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        header +=
          "<th class='table-info' scope='col'>label</th><th class='table-info' scope='col'>mean stat</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>minimum time</th><th class='table-info' scope='col'>maximum time</th>";
        break;
      case matsTypes.PlotTypes.simpleScatter:
        header += "";
        break;
      default:
        break;
    }
    return header;
  },

  // get the table header for each curve's data
  elementHeaders(curve) {
    let header = "";
    const curveData = getDataForCurve(curve);
    const isCTC =
      curveData !== undefined &&
      curveData[0] !== undefined &&
      Object.keys(curveData[0]).indexOf("hit") !== -1;
    const isModeSingle =
      curveData !== undefined &&
      curveData[0] !== undefined &&
      Object.keys(curveData[0]).indexOf("nForecast") !== -1;
    const isModePairs =
      curveData !== undefined &&
      curveData[0] !== undefined &&
      Object.keys(curveData[0]).indexOf("avgInterest") !== -1;
    const plotType = Session.get("plotType");
    let labelSuffix;
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.dailyModelCycle:
        labelSuffix = " time";
        break;
      case matsTypes.PlotTypes.profile:
        labelSuffix = " level";
        break;
      case matsTypes.PlotTypes.dieoff:
        labelSuffix = " forecast lead time";
        break;
      case matsTypes.PlotTypes.validtime:
        labelSuffix = " hour of day";
        break;
      case matsTypes.PlotTypes.threshold:
        labelSuffix = " threshold";
        break;
      case matsTypes.PlotTypes.gridscale:
        labelSuffix = " grid scale";
        break;
      case matsTypes.PlotTypes.yearToYear:
        labelSuffix = " year";
        break;
      default:
        labelSuffix = "x-value";
        break;
    }
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
        if (isCTC) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>n</th>\
                        <th class='table-info' scope='col'>hits</th>\
                        <th class='table-info' scope='col'>false alarms</th>\
                        <th class='table-info' scope='col'>misses</th>\
                        <th class='table-info' scope='col'>correct nulls</th>`;
        } else if (isModeSingle) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>Number of forecast objects</th>\
                        <th class='table-info' scope='col'>Number of matched objects</th>\
                        <th class='table-info' scope='col'>Number of simple objects</th>\
                        <th class='table-info' scope='col'>Number of total objects</th>`;
        } else if (isModePairs) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>stat</th>\
                        <th class='table-info' scope='col'>n</th>\
                        <th class='table-info' scope='col'>average interest</th>`;
        } else {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>mean of sub values</th>\
                        <th class='table-info' scope='col'>std dev</th>\
                        <th class='table-info' scope='col'>std error</th>\
                        <th class='table-info' scope='col'>lag1</th>\
                        <th class='table-info' scope='col'>n</th>`;
        }
        break;
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.yearToYear:
        if (isCTC) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>n</th>\
                        <th class='table-info' scope='col'>hits</th>\
                        <th class='table-info' scope='col'>false alarms</th>\
                        <th class='table-info' scope='col'>misses</th>\
                        <th class='table-info' scope='col'>correct nulls</th>`;
        } else if (isModeSingle) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>Number of forecast objects</th>\
                        <th class='table-info' scope='col'>Number of matched objects</th>\
                        <th class='table-info' scope='col'>Number of simple objects</th>\
                        <th class='table-info' scope='col'>Number of total objects</th>`;
        } else if (isModePairs) {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>stat</th>\
                        <th class='table-info' scope='col'>n</th>\
                        <th class='table-info' scope='col'>average interest</th>`;
        } else {
          header += `<th class='table-info' scope='col'>${curve.label}${labelSuffix}</th>\
                        <th class='table-info' scope='col'>plotted stat</th>\
                        <th class='table-info' scope='col'>mean of sub values</th>\
                        <th class='table-info' scope='col'>std dev</th>\
                        <th class='table-info' scope='col'>n</th>`;
        }
        break;
      case matsTypes.PlotTypes.reliability:
        if (curve.kernel) {
          header += `<th class='table-info' scope='col'>${curve.label} probability bin</th>\
                        <th class='table-info' scope='col'>observed frequency</th>\
                        <th class='table-info' scope='col'>hit count</th>\
                        <th class='table-info' scope='col'>fcst count</th>`;
        } else {
          header += `<th class='table-info' scope='col'>${curve.label} probability bin</th>\
                        <th class='table-info' scope='col'>hit rate</th>\
                        <th class='table-info' scope='col'>oy</th>\
                        <th class='table-info' scope='col'>on</th>`;
        }
        break;
      case matsTypes.PlotTypes.roc:
        header += `<th class='table-info' scope='col'>${curve.label} bin value</th>\
                        <th class='table-info' scope='col'>probability of detection</th>\
                        <th class='table-info' scope='col'>probability of false detection</th>\
                        <th class='table-info' scope='col'>n</th>\
                        `;
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        header += `<th class='table-info' scope='col'>${curve.label} bin value</th>\
                        <th class='table-info' scope='col'>probability of detection</th>\
                        <th class='table-info' scope='col'>success ratio</th>\
                        <th class='table-info' scope='col'>n</th>\
                        `;
        break;
      case matsTypes.PlotTypes.gridscaleProb:
        header += `<th class='table-info' scope='col'>${curve.label} probability bin</th>\
                        <th class='table-info' scope='col'>number of grid points</th>\
                        <th class='table-info' scope='col'>n</th>\
                        `;
        break;
      case matsTypes.PlotTypes.map:
        if (isCTC) {
          header +=
            "<th class='table-info' scope='col'>site name</th><th class='table-info' scope='col'>number of times</th><th class='table-info' scope='col'>stat</th><th class='table-info' scope='col'>hits</th><th class='table-info' scope='col'>false alarms</th><th class='table-info' scope='col'>misses</th><th class='table-info' scope='col'>correct nulls</th>";
        } else {
          header +=
            "<th class='table-info' scope='col'>site name</th><th class='table-info' scope='col'>number of times</th><th class='table-info' scope='col'>start date</th><th class='table-info' scope='col'>end date</th><th class='table-info' scope='col'>stat</th>";
        }
        break;
      case matsTypes.PlotTypes.histogram:
        header += `<th class='table-info' scope='col'>${curve.label}  bin range</th><th class='table-info' scope='col'>bin n</th><th class='table-info' scope='col'>bin rel freq</th><th class='table-info' scope='col'>bin lower bound</th><th class='table-info' scope='col'>bin upper bound</th><th class='table-info' scope='col'>bin mean</th><th class='table-info' scope='col'>bin std dev</th>`;
        break;
      case matsTypes.PlotTypes.ensembleHistogram:
        header += `<th class='table-info' scope='col'>${curve.label}  bin number</th>\
                        <th class='table-info' scope='col'>bin n</th>\
                        <th class='table-info' scope='col'>bin rel freq</th>`;
        break;
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        if (isCTC) {
          header +=
            "<th class='table-info' scope='col'>x value</th><th class='table-info' scope='col'>y value</th><th class='table-info' scope='col'>stat</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>hits</th><th class='table-info' scope='col'>false alarms</th><th class='table-info' scope='col'>misses</th><th class='table-info' scope='col'>correct nulls</th>";
        } else {
          header +=
            "<th class='table-info' scope='col'>x value</th><th class='table-info' scope='col'>y value</th><th class='table-info' scope='col'>stat</th><th class='table-info' scope='col'>n</th><th class='table-info' scope='col'>start date</th><th class='table-info' scope='col'>end date</th>";
        }
        break;
      case matsTypes.PlotTypes.simpleScatter:
        header += `<th class='table-info' scope='col'>${curve.label} bin value</th><th class='table-info' scope='col'>x-statistic</th><th class='table-info' scope='col'>y-statistic</th><th class='table-info' scope='col'>n</th>`;
        break;
      default:
        break;
    }
    return header;
  },
  elements(curve) {
    Session.get("textLoaded"); // monitor for data changres like previous / next
    return getDataForCurve(curve);
  },
  curves() {
    Session.get("textLoaded");
    Session.get("plotResultKey"); // make sure we re-render when data changes
    return Session.get("Curves");
  },
  curveLabel(curve) {
    switch (Session.get("plotType")) {
      case matsTypes.PlotTypes.timeSeries:
        return `${curve.label} time`;
      case matsTypes.PlotTypes.profile:
        return `${curve.label} level`;
      case matsTypes.PlotTypes.dieoff:
        return `${curve.label} forecast lead time`;
      default:
        return `${curve.label} x-value`;
    }
  },
  curveText() {
    const text = matsPlotUtils.getCurveText(matsPlotUtils.getPlotType(), this);
    return text;
  },

  // get the table row values for each curve's data
  elementHtml(element) {
    let labelKey = Template.parentData().label;
    let line = "";
    const isCTC = element.hit !== undefined && element.hit !== null;
    const isModeSingle = element.nForecast !== undefined && element.nForecast !== null;
    const isModePairs =
      element.avgInterest !== undefined && element.avgInterest !== null;
    const plotType = Session.get("plotType");
    let labelSuffix;
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.dailyModelCycle:
        labelSuffix = " time";
        break;
      case matsTypes.PlotTypes.profile:
        labelSuffix = " level";
        break;
      case matsTypes.PlotTypes.dieoff:
        labelSuffix = " forecast lead time";
        break;
      case matsTypes.PlotTypes.validtime:
        labelSuffix = " hour of day";
        break;
      case matsTypes.PlotTypes.threshold:
        labelSuffix = " threshold";
        break;
      case matsTypes.PlotTypes.gridscale:
        labelSuffix = " grid scale";
        break;
      case matsTypes.PlotTypes.yearToYear:
        labelSuffix = " year";
        break;
      default:
        labelSuffix = "x-value";
        break;
    }
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
        if (isCTC) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.n !== undefined && element.n !== null
                ? element.n.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.hit !== undefined && element.hit !== null
                ? element.hit.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.fa !== undefined && element.fa !== null
                ? element.fa.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.miss !== undefined && element.miss !== null
                ? element.miss.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.cn !== undefined && element.cn !== null
                ? element.cn.toString()
                : fillStr
            }</td>`;
        } else if (isModeSingle) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.nForecast !== undefined && element.nForecast !== null
                ? element.nForecast.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nMatched !== undefined && element.nMatched !== null
                ? element.nMatched.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nSimple !== undefined && element.nSimple !== null
                ? element.nSimple.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nTotal !== undefined && element.nTotal !== null
                ? element.nTotal.toString()
                : fillStr
            }</td>`;
        } else if (isModePairs) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.n !== undefined && element.n !== null
                ? element.n.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.avgInterest !== undefined && element.avgInterest !== null
                ? element.avgInterest.toString()
                : fillStr
            }</td>`;
        } else {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.mean !== undefined && element.mean !== null
                ? element.mean.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element["std dev"] !== undefined && element["std dev"] !== null
                ? element["std dev"].toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element["std error"] !== undefined && element["std error"] !== null
                ? element["std error"].toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.lag1 !== undefined && element.lag1 !== null
                ? element.lag1.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${"n" in element && element.n ? element.n : fillStr}</td>`;
        }
        break;
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.yearToYear:
        if (isCTC) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.n !== undefined && element.n !== null
                ? element.n.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.hit !== undefined && element.hit !== null
                ? element.hit.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.fa !== undefined && element.fa !== null
                ? element.fa.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.miss !== undefined && element.miss !== null
                ? element.miss.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.cn !== undefined && element.cn !== null
                ? element.cn.toString()
                : fillStr
            }</td>`;
        } else if (isModeSingle) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.nForecast !== undefined && element.nForecast !== null
                ? element.nForecast.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nMatched !== undefined && element.nMatched !== null
                ? element.nMatched.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nSimple !== undefined && element.nSimple !== null
                ? element.nSimple.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.nTotal !== undefined && element.nTotal !== null
                ? element.nTotal.toString()
                : fillStr
            }</td>`;
        } else if (isModePairs) {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.n !== undefined && element.n !== null
                ? element.n.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.avgInterest !== undefined && element.avgInterest !== null
                ? element.avgInterest.toString()
                : fillStr
            }</td>`;
        } else {
          line +=
            `<td>${element[(labelKey += labelSuffix)]}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.mean !== undefined && element.mean !== null
                ? element.mean.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element["std dev"] !== undefined && element["std dev"] !== null
                ? element["std dev"].toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${"n" in element && element.n ? element.n : fillStr}</td>`;
        }
        break;
      case matsTypes.PlotTypes.reliability:
        if (element["observed frequency"]) {
          line +=
            `<td>${element[(labelKey += " probability bin")]}</td>` +
            `<td>${
              element["observed frequency"] !== undefined &&
              element["observed frequency"] !== null
                ? element["observed frequency"].toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.hitcount !== undefined && element.hitcount !== null
                ? element.hitcount
                : fillStr
            }</td>` +
            `<td>${
              element.fcstcount !== undefined && element.fcstcount !== null
                ? element.fcstcount
                : fillStr
            }</td>`;
        } else {
          line +=
            `<td>${element[(labelKey += " probability bin")]}</td>` +
            `<td>${
              element["hit rate"] !== undefined && element["hit rate"] !== null
                ? element["hit rate"].toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.oy !== undefined && element.oy !== null ? element.oy : fillStr
            }</td>` +
            `<td>${
              element.on !== undefined && element.on !== null ? element.on : fillStr
            }</td>`;
        }
        break;
      case matsTypes.PlotTypes.roc:
        line +=
          `<td>${element[(labelKey += " bin value")]}</td>` +
          `<td>${
            element["probability of detection"] !== undefined &&
            element["probability of detection"] !== null
              ? element["probability of detection"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["probability of false detection"] !== undefined &&
            element["probability of false detection"] !== null
              ? element["probability of false detection"]
              : fillStr
          }</td>` +
          `<td>${
            element.n !== undefined && element.n !== null ? element.n : fillStr
          }</td>`;
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        line +=
          `<td>${element[(labelKey += " bin value")]}</td>` +
          `<td>${
            element["probability of detection"] !== undefined &&
            element["probability of detection"] !== null
              ? element["probability of detection"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["success ratio"] !== undefined && element["success ratio"] !== null
              ? element["success ratio"]
              : fillStr
          }</td>` +
          `<td>${
            element.n !== undefined && element.n !== null ? element.n : fillStr
          }</td>`;
        break;
      case matsTypes.PlotTypes.gridscaleProb:
        line +=
          `<td>${element[(labelKey += " probability bin")]}</td>` +
          `<td>${
            element["number of grid points"] !== undefined &&
            element["number of grid points"] !== null
              ? element["number of grid points"]
              : fillStr
          }</td>` +
          `<td>${
            element.n !== undefined && element.n !== null ? element.n : fillStr
          }</td>`;
        break;
      case matsTypes.PlotTypes.map:
        if (isCTC) {
          line +=
            `<td>${element["site name"]}</td>` +
            `<td>${
              element["number of times"] !== undefined &&
              element["number of times"] !== null
                ? element["number of times"]
                : fillStr
            }</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat.toPrecision(4)
                : fillStr
            }</td>` +
            `<td>${
              element.hit !== undefined && element.hit !== null
                ? element.hit.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.fa !== undefined && element.fa !== null
                ? element.fa.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.miss !== undefined && element.miss !== null
                ? element.miss.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.cn !== undefined && element.cn !== null
                ? element.cn.toString()
                : fillStr
            }</td>`;
        } else {
          line +=
            `<td>${element["site name"]}</td>` +
            `<td>${
              element["number of times"] !== undefined &&
              element["number of times"] !== null
                ? element["number of times"]
                : fillStr
            }</td>` +
            `<td>${
              element["start date"] !== undefined && element["start date"] !== null
                ? element["start date"]
                : fillStr
            }</td>` +
            `<td>${
              element["end date"] !== undefined && element["end date"] !== null
                ? element["end date"]
                : fillStr
            }</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat
                : fillStr
            }</td>`;
        }
        break;
      case matsTypes.PlotTypes.histogram:
        line +=
          `<td>${element[(labelKey += " bin range")]}</td>` +
          `<td>${"n" in element ? element.n : fillStr}</td>` +
          `<td>${
            element["bin rel freq"] !== undefined && element["bin rel freq"] !== null
              ? element["bin rel freq"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["bin lower bound"] !== undefined &&
            element["bin lower bound"] !== null
              ? element["bin lower bound"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["bin upper bound"] !== undefined &&
            element["bin upper bound"] !== null
              ? element["bin upper bound"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["bin mean"] !== undefined && element["bin mean"] !== null
              ? element["bin mean"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["bin std dev"] !== undefined && element["bin std dev"] !== null
              ? element["bin std dev"].toPrecision(4)
              : fillStr
          }</td>`;
        break;
      case matsTypes.PlotTypes.ensembleHistogram:
        line +=
          `<td>${element[(labelKey += " bin")]}</td>` +
          `<td>${"n" in element ? element.n : fillStr}</td>` +
          `<td>${
            element["bin rel freq"] !== undefined && element["bin rel freq"] !== null
              ? element["bin rel freq"].toPrecision(4)
              : fillStr
          }</td>`;
        break;
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        if (isCTC) {
          line +=
            `<td>${element.xVal}</td>` +
            `<td>${element.yVal}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat
                : fillStr
            }</td>` +
            `<td>${
              element.N !== undefined && element.N !== null ? element.N : fillStr
            }</td>` +
            `<td>${
              element.hit !== undefined && element.hit !== null
                ? element.hit.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.fa !== undefined && element.fa !== null
                ? element.fa.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.miss !== undefined && element.miss !== null
                ? element.miss.toString()
                : fillStr
            }</td>` +
            `<td>${
              element.cn !== undefined && element.cn !== null
                ? element.cn.toString()
                : fillStr
            }</td>`;
        } else {
          line +=
            `<td>${element.xVal}</td>` +
            `<td>${element.yVal}</td>` +
            `<td>${
              element.stat !== undefined && element.stat !== null
                ? element.stat
                : fillStr
            }</td>` +
            `<td>${
              element.N !== undefined && element.N !== null ? element.N : fillStr
            }</td>` +
            `<td>${
              element["Start Date"] !== undefined && element["Start Date"] !== null
                ? element["Start Date"]
                : fillStr
            }</td>` +
            `<td>${
              element["End Date"] !== undefined && element["End Date"] !== null
                ? element["End Date"]
                : fillStr
            }</td>`;
        }
        break;
      case matsTypes.PlotTypes.simpleScatter:
        line +=
          `<td>${element[(labelKey += " bin value")]}</td>` +
          `<td>${
            element["x-stat"] !== undefined && element["x-stat"] !== null
              ? element["x-stat"].toPrecision(4)
              : fillStr
          }</td>` +
          `<td>${
            element["y-stat"] !== undefined && element["y-stat"] !== null
              ? element["y-stat"]
              : fillStr
          }</td>` +
          `<td>${
            element.n !== undefined && element.n !== null ? element.n : fillStr
          }</td>`;
        break;
      default:
        break;
    }
    return line;
  },

  // get the table row values for the summary stats at the top of the text page
  stats(curve) {
    if (Session.get("plotResultKey") === undefined) {
      return [];
    }
    const curves = Session.get("Curves");
    if (curves === undefined || curves.length === 0) {
      return [];
    }
    let cindex;
    for (cindex = 0; cindex < curves.length; cindex += 1) {
      if (curves[cindex].label === curve.label) {
        break;
      }
    }
    if (
      matsCurveUtils.getPlotResultData() === null ||
      matsCurveUtils.getPlotResultData() === undefined ||
      matsCurveUtils.getPlotResultData().stats === undefined ||
      matsCurveUtils.getPlotResultData().stats[curves[cindex].label] === undefined
    ) {
      return "";
    }
    const stats = matsCurveUtils.getPlotResultData().stats[curves[cindex].label];

    let line = "";
    switch (Session.get("plotType")) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats.mean !== undefined && stats.mean !== null
            ? stats.mean.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["standard deviation"] !== undefined &&
          stats["standard deviation"] !== null
            ? stats["standard deviation"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${stats.n.toString()}</td>` +
          `<td>${(stats["standard error"] !== undefined &&
          stats["standard error"] !== null
            ? stats["standard error"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats.lag1 !== undefined && stats.lag1 !== null
            ? stats.lag1.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats.minimum !== undefined && stats.minimum !== null
            ? stats.minimum.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats.maximum !== undefined && stats.maximum !== null
            ? stats.maximum.toPrecision(4)
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.yearToYear:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats.mean !== undefined && stats.mean !== null
            ? stats.mean.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["standard deviation"] !== undefined &&
          stats["standard deviation"] !== null
            ? stats["standard deviation"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${stats.n.toString()}</td>` +
          `<td>${(stats.minimum !== undefined && stats.minimum !== null
            ? stats.minimum.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats.maximum !== undefined && stats.maximum !== null
            ? stats.maximum.toPrecision(4)
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.reliability:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats["sample climo"] !== undefined && stats["sample climo"] !== null
            ? stats["sample climo"].toPrecision(4)
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.roc:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats.auc !== undefined && stats.auc !== null
            ? stats.auc.toPrecision(4)
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        line += "";
        break;
      case matsTypes.PlotTypes.map:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats["mean difference"] !== undefined &&
          stats["mean difference"] !== null
            ? stats["mean difference"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["standard deviation"] !== undefined &&
          stats["standard deviation"] !== null
            ? stats["standard deviation"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["total number of obs"] !== undefined &&
          stats["total number of obs"] !== null
            ? stats["total number of obs"]
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["minimum time"] !== undefined && stats["minimum time"] !== null
            ? stats["minimum time"]
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["maximum time"] !== undefined && stats["maximum time"] !== null
            ? stats["maximum time"]
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats.mean !== undefined && stats.mean !== null
            ? stats.mean.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["standard deviation"] !== undefined &&
          stats["standard deviation"] !== null
            ? stats["standard deviation"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${stats.n.toString()}</td>` +
          `<td>${(stats.minimum !== undefined && stats.minimum !== null
            ? stats.minimum.toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats.maximum !== undefined && stats.maximum !== null
            ? stats.maximum.toPrecision(4)
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        line +=
          `<td>${curve.label}</td>` +
          `<td>${(stats["mean stat"] !== undefined && stats["mean stat"] !== null
            ? stats["mean stat"].toPrecision(4)
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["total number of points"] !== undefined &&
          stats["total number of points"] !== null
            ? stats["total number of points"]
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["minimum time"] !== undefined && stats["minimum time"] !== null
            ? stats["minimum time"]
            : "undefined"
          ).toString()}</td>` +
          `<td>${(stats["maximum time"] !== undefined && stats["maximum time"] !== null
            ? stats["maximum time"]
            : "undefined"
          ).toString()}</td>`;
        break;
      case matsTypes.PlotTypes.simpleScatter:
        line += "";
        break;
      default:
        break;
    }
    return line;
  },
});

Template.textOutput.events({
  "click .export"() {
    Session.get("plotType");
    const appName = Meteor.settings.public.app;
    const graphFunction = Session.get("graphFunction");
    const plotResultKey = Session.get("plotResultKey");
    const plotParameter = Session.get("plotParameter");
    // open a new window with
    window.open(
      `${window.location.href}/CSV/${graphFunction}/${plotResultKey}/${plotParameter}/${appName}`
    );
  },
});
