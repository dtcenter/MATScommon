/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import {
  matsCollections,
  matsCurveUtils,
  matsGraphUtils,
  matsMethods,
  matsPlotUtils,
  matsTypes,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";
// eslint-disable-next-line import/no-unresolved
import rgbHex from "rgb-hex";

const LightenDarkenColor = require("lighten-darken-color");

/* global Session, Plotly, $, _, setError */
/* eslint-disable no-console */

let annotation = "";
let openWindows = [];
let xAxes;
let yAxes;
let curveOpsUpdate;

const saveUpdatesToJSON = function (update, uidx) {
  if (update) {
    curveOpsUpdate[uidx] =
      curveOpsUpdate[uidx] === undefined ? {} : curveOpsUpdate[uidx];
    const updatedKeys = Object.keys(update);
    for (let kidx = 0; kidx < updatedKeys.length; kidx += 1) {
      const updatedKey = updatedKeys[kidx];
      // json doesn't like . to be in keys, so replace it with a placeholder
      const jsonHappyKey = updatedKey.split(".").join("____");
      curveOpsUpdate[uidx][jsonHappyKey] = update[updatedKey];
    }
  }
};

Template.graph.onCreated(function () {
  // the window resize event needs to also resize the graph
  $(window).resize(function () {
    matsGraphUtils.resizeGraph(matsPlotUtils.getPlotType());
    const dataset = matsCurveUtils.getGraphResult().data;
    const { options } = matsCurveUtils.getGraphResult();
    if (dataset !== undefined && options !== undefined) {
      Plotly.newPlot($("#placeholder")[0], dataset, options, {
        showLink: false,
        scrollZoom: true,
      });
    }
  });
});

Template.graph.helpers({
  /**
   * @return {string}
   */
  graphFunction() {
    // causes graph display routine to be processed
    Session.get("PlotResultsUpDated");
    matsGraphUtils.graphPlotly();
    const plotType = Session.get("graphPlotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const { options } = matsCurveUtils.getGraphResult();
    Session.set("options", options);

    // need to save some curve options so that the reset button can undo Plotly.restyle
    const lineTypeResetOpts = [];
    const barTypeResetOpts = [];
    const mapResetOpts = [];
    switch (plotType) {
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        // saved curve options for contours
        Session.set("colorbarResetOpts", {
          name: dataset[0].name,
          showlegend: dataset[0].showlegend,
          "colorbar.title.text": dataset[0].colorbar.title.text,
          autocontour: dataset[0].autocontour,
          ncontours: dataset[0].ncontours,
          "contours.start": dataset[0].contours.start,
          "contours.end": dataset[0].contours.end,
          "contours.size": dataset[0].contours.size,
          reversescale: dataset[0].reversescale,
          connectgaps: dataset[0].connectgaps,
          colorscale: JSON.stringify(dataset[0].colorscale),
        });
        break;
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.simpleScatter:
        // saved curve options for line graphs
        for (let lidx = 0; lidx < dataset.length; lidx += 1) {
          lineTypeResetOpts.push({
            name: dataset[lidx].name,
            visible: dataset[lidx].visible,
            showlegend: dataset[lidx].showlegend,
            mode: dataset[lidx].mode,
            xaxis: dataset[lidx].xaxis,
            yaxis: dataset[lidx].yaxis,
            x: [dataset[lidx].x],
            y: [dataset[lidx].y],
            text: [dataset[lidx].text],
            error_y: dataset[lidx].error_y,
            error_x: dataset[lidx].error_x,
            "marker.symbol": dataset[lidx].marker.symbol,
            "marker.size": dataset[lidx].marker.size,
            "marker.color": dataset[lidx].marker.color,
          });
          if (dataset[lidx].binVals !== undefined) {
            lineTypeResetOpts[lidx].binVals = [dataset[lidx].binVals];
          } else if (dataset[lidx].threshold_all !== undefined) {
            lineTypeResetOpts[lidx].threshold_all = [dataset[lidx].threshold_all];
          }
          if (plotType !== matsTypes.PlotTypes.simpleScatter) {
            lineTypeResetOpts[lidx]["line.dash"] = dataset[lidx].line.dash;
            lineTypeResetOpts[lidx]["line.width"] = dataset[lidx].line.width;
            lineTypeResetOpts[lidx]["line.color"] = dataset[lidx].line.color;
          }
        }
        Session.set("lineTypeResetOpts", lineTypeResetOpts);
        break;
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
        // saved curve options for histograms
        for (let bidx = 0; bidx < dataset.length; bidx += 1) {
          barTypeResetOpts.push({
            name: dataset[bidx].name,
            visible: dataset[bidx].visible,
            showlegend: dataset[0].showlegend,
            "marker.color": dataset[bidx].marker.color,
          });
        }
        Session.set("barTypeResetOpts", barTypeResetOpts);
        break;
      case matsTypes.PlotTypes.map:
        // saved curve options for maps
        mapResetOpts[0] = {
          "marker.opacity": dataset[0].marker.opacity,
        };
        for (let midx = 1; midx < dataset.length; midx += 1) {
          mapResetOpts.push({
            name: dataset[midx].name,
            visible: dataset[midx].visible,
          });
        }
        Session.set("mapResetOpts", mapResetOpts);
        break;
      case matsTypes.PlotTypes.scatter2d:
      default:
        break;
    }
    curveOpsUpdate = [];
    Session.set("thresholdEquiX", false);

    // initial plot
    $("#placeholder").empty();
    if (!dataset || !options) {
      return false;
    }
    Plotly.newPlot($("#placeholder")[0], dataset, options, {
      showLink: false,
      scrollZoom: true,
    });
    matsGraphUtils.setGraphView(plotType);

    // there seems to be a bug in the plotly API, where if you have a handler for plotly_legendclick,
    // it will always supersede the handler for plotly_legenddoubleclick. If you comment out the
    // handler for plotly_legendclick, then the one for plotly_legenddoubleclick will fire. This
    // is not the behavior that the plotly instruction manual implies should occur, but seems to
    // be the reality (the broader plotly_click and plotly_doubleclick work as expected, accurately
    // recognizing double clicks even if a single click handler exists). I'm going to add handlers
    // for both plotly_legendclick and plotly_legenddoubleclick anyway, in the hopes that they
    // eventually fix this and it gets pushed to https://cdn.plot.ly/plotly-3.0.1.min.js, but
    // until then, the double click show/hide all curves functionality will not exist.
    $("#placeholder")[0].on("plotly_legendclick", function (data) {
      const resultDataset = matsCurveUtils.getGraphResult().data;
      const curveToShowHide = data.curveNumber;
      const { label } = resultDataset[curveToShowHide];
      const thisPlotType = Session.get("graphPlotType");
      switch (thisPlotType) {
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.profile:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.yearToYear:
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.gridscaleProb:
          document.getElementById(`${label}-curve-show-hide`).click();
          return false;
        case matsTypes.PlotTypes.simpleScatter:
        case matsTypes.PlotTypes.scatter2d:
          document.getElementById(`${label}-curve-show-hide-points`).click();
          return false;
        case matsTypes.PlotTypes.histogram:
        case matsTypes.PlotTypes.ensembleHistogram:
          document.getElementById(`${label}-curve-show-hide-bars`).click();
          return false;
        case matsTypes.PlotTypes.map:
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
        default:
          // keep the plotly default event behavior
          return true;
      }
    });
    Session.set("singleCurveIsolated", false);
    $("#placeholder")[0].on("plotly_legenddoubleclick", function (data) {
      const returnDataset = matsCurveUtils.getGraphResult().data;
      const curveToShowHide = data.curveNumber;
      let { label } = returnDataset[curveToShowHide];
      const thisPlotType = Session.get("graphPlotType");
      let hideAllOtherCurves;
      if (returnDataset[curveToShowHide].visible === "legendonly") {
        // we want to show this hidden curve and hide all others
        hideAllOtherCurves = true;
        Session.set("singleCurveIsolated", label);
        // update this curve
        switch (thisPlotType) {
          case matsTypes.PlotTypes.timeSeries:
          case matsTypes.PlotTypes.profile:
          case matsTypes.PlotTypes.dieoff:
          case matsTypes.PlotTypes.threshold:
          case matsTypes.PlotTypes.validtime:
          case matsTypes.PlotTypes.gridscale:
          case matsTypes.PlotTypes.dailyModelCycle:
          case matsTypes.PlotTypes.yearToYear:
          case matsTypes.PlotTypes.reliability:
          case matsTypes.PlotTypes.roc:
          case matsTypes.PlotTypes.performanceDiagram:
          case matsTypes.PlotTypes.gridscaleProb:
            document.getElementById(`${label}-curve-show-hide`).click();
            break;
          case matsTypes.PlotTypes.simpleScatter:
          case matsTypes.PlotTypes.scatter2d:
            document.getElementById(`${label}-curve-show-hide-points`).click();
            break;
          case matsTypes.PlotTypes.histogram:
          case matsTypes.PlotTypes.ensembleHistogram:
            document.getElementById(`${label}-curve-show-hide-bars`).click();
            break;
          case matsTypes.PlotTypes.map:
          case matsTypes.PlotTypes.contour:
          case matsTypes.PlotTypes.contourDiff:
          default:
            // keep the plotly default event behavior
            return true;
        }
      } else if (Session.get("singleCurveIsolated") === label) {
        // we previously showed this curve and hid the others, so undo that now.
        hideAllOtherCurves = false;
        Session.set("singleCurveIsolated", false);
      } else {
        // we have a new curve to show at the expense of others, but it's already visible
        hideAllOtherCurves = true;
        Session.set("singleCurveIsolated", label);
      }
      // update the other curves
      for (let i = 0; i < returnDataset.length; i += 1) {
        if (
          !(
            Object.values(matsTypes.ReservedWords).indexOf(returnDataset[i].label) >=
              0 ||
            returnDataset[i].label.includes(matsTypes.ReservedWords.noSkill) ||
            (thisPlotType === matsTypes.PlotTypes.map &&
              Object.values(matsTypes.ReservedWords).indexOf(
                returnDataset[i].reserved
              ) >= 0) ||
            i === curveToShowHide
          )
        ) {
          label = returnDataset[i].label;
          switch (thisPlotType) {
            case matsTypes.PlotTypes.simpleScatter:
            case matsTypes.PlotTypes.scatter2d:
              if (
                (hideAllOtherCurves && returnDataset[i].visible !== "legendonly") ||
                (!hideAllOtherCurves && returnDataset[i].visible === "legendonly")
              ) {
                document.getElementById(`${label}-curve-show-hide-points`).click();
              }
              break;
            case matsTypes.PlotTypes.histogram:
            case matsTypes.PlotTypes.ensembleHistogram:
              if (
                (hideAllOtherCurves && returnDataset[i].visible !== "legendonly") ||
                (!hideAllOtherCurves && returnDataset[i].visible === "legendonly")
              ) {
                document.getElementById(`${label}-curve-show-hide-bars`).click();
              }
              break;
            case matsTypes.PlotTypes.timeSeries:
            case matsTypes.PlotTypes.profile:
            case matsTypes.PlotTypes.dieoff:
            case matsTypes.PlotTypes.threshold:
            case matsTypes.PlotTypes.validtime:
            case matsTypes.PlotTypes.gridscale:
            case matsTypes.PlotTypes.dailyModelCycle:
            case matsTypes.PlotTypes.yearToYear:
            case matsTypes.PlotTypes.reliability:
            case matsTypes.PlotTypes.roc:
            case matsTypes.PlotTypes.performanceDiagram:
            case matsTypes.PlotTypes.gridscaleProb:
            default:
              if (
                (hideAllOtherCurves && returnDataset[i].visible !== "legendonly") ||
                (!hideAllOtherCurves && returnDataset[i].visible === "legendonly")
              ) {
                document.getElementById(`${label}-curve-show-hide`).click();
              }
              break;
          }
        }
      }
      return false;
    });

    // append annotations and other setup
    let localAnnotation;
    for (let i = 0; i < dataset.length; i += 1) {
      if (
        !(
          Object.values(matsTypes.ReservedWords).indexOf(dataset[i].label) >= 0 ||
          dataset[i].label.includes(matsTypes.ReservedWords.noSkill) ||
          (plotType === matsTypes.PlotTypes.map &&
            Object.values(matsTypes.ReservedWords).indexOf(dataset[i].reserved) >= 0)
        )
      ) {
        // annotation color needs to be darkened for proper section 508 contrast compliance
        const darkerAnnotationColor = dataset[i].annotateColor
          ? LightenDarkenColor.LightenDarkenColor(rgbHex(dataset[i].annotateColor), -75)
              .toString()
              .padStart(6, "0")
          : "000000";

        switch (plotType) {
          case matsTypes.PlotTypes.timeSeries:
          case matsTypes.PlotTypes.profile:
          case matsTypes.PlotTypes.dieoff:
          case matsTypes.PlotTypes.threshold:
          case matsTypes.PlotTypes.validtime:
          case matsTypes.PlotTypes.gridscale:
          case matsTypes.PlotTypes.dailyModelCycle:
          case matsTypes.PlotTypes.yearToYear:
          case matsTypes.PlotTypes.scatter2d:
            localAnnotation = `<div id='${dataset[i].curveId}-annotation' style='color:#${darkerAnnotationColor}'>${dataset[i].annotation} </div>`;
            break;
          case matsTypes.PlotTypes.map:
            localAnnotation = `<div id='${dataset[i].curveId}-annotation' style='color:#${darkerAnnotationColor}'>${dataset[i].name} </div><div></br></div>`;
            break;
          case matsTypes.PlotTypes.reliability:
          case matsTypes.PlotTypes.roc:
          case matsTypes.PlotTypes.performanceDiagram:
          case matsTypes.PlotTypes.gridscaleProb:
          case matsTypes.PlotTypes.histogram:
          case matsTypes.PlotTypes.ensembleHistogram:
          case matsTypes.PlotTypes.simpleScatter:
          case matsTypes.PlotTypes.contour:
          case matsTypes.PlotTypes.contourDiff:
          default:
            localAnnotation = "";
            break;
        }

        if (plotType !== matsTypes.PlotTypes.contourDiff) {
          // contourDiffs don't have the right legend container for the combined curve1-curve0,
          // but that doesn't matter because we don't display a legend for contourDiffs.
          $(`#legendContainer${dataset[i].curveId}`).empty().append(localAnnotation);
          $(`#legendContainer${dataset[i].curveId}`)[0].hidden = localAnnotation === "";
        }

        // store the existing axes. Reset global arrays from previous plots.
        Session.set("axesCollapsed", false);
        xAxes = Object.keys($("#placeholder")[0].layout).filter(function (k) {
          return k.startsWith("xaxis");
        });
        yAxes = Object.keys($("#placeholder")[0].layout).filter(function (k) {
          return k.startsWith("yaxis");
        });
      }
    }

    if (
      plotType === matsTypes.PlotTypes.contour ||
      plotType === matsTypes.PlotTypes.contourDiff
    ) {
      // enable colorpicker on colorbar modal, if applicable. Otherwise hide the selection field.
      const lastCurveIndex = dataset.length - 1;
      if (
        dataset[lastCurveIndex].label === matsTypes.ReservedWords.contourSigLabel &&
        dataset[lastCurveIndex].x.length > 0
      ) {
        $("#sigDotContainer")[0].style.display = "block";
      } else {
        $("#sigDotContainer")[0].style.display = "none";
      }

      // make default colorbar selection actually match what is on the graph
      const colorscale = JSON.stringify(dataset[0].colorscale);
      const elem = document.getElementById("colormapSelect");
      elem.value = colorscale;
    }

    // store annotation
    annotation = $("#curves")[0].innerHTML;
    matsCurveUtils.hideSpinner();
    return null;
  },
  Title() {
    if (
      matsCollections.Settings === undefined ||
      matsCollections.Settings.findOne({}, { fields: { Title: 1 } }) === undefined
    ) {
      return "";
    }
    return matsCollections.Settings.findOne({}, { fields: { Title: 1 } }).Title;
  },
  isTextPage() {
    return Session.get("isTextPage");
  },
  isGraphPage() {
    return Session.get("isGraphPage");
  },
  width() {
    return matsGraphUtils.width(matsPlotUtils.getPlotType());
  },
  height() {
    return matsGraphUtils.height(matsPlotUtils.getPlotType());
  },
  curves() {
    return Session.get("Curves");
  },
  indValLabel() {
    const plotType = Session.get("plotType");
    if (plotType !== undefined) {
      let fieldName;
      switch (plotType) {
        // line plots only
        case matsTypes.PlotTypes.profile:
          fieldName = " levels:";
          break;
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.gridscaleProb:
        case matsTypes.PlotTypes.simpleScatter:
          fieldName = " bin values:";
          break;
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.yearToYear:
          fieldName = " x-values:";
          break;
        default:
          fieldName = ":";
          break;
      }
      return fieldName;
    }
    return "";
  },
  indVals(curveLabel) {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (plotType !== undefined) {
      const dataset = matsCurveUtils.getGraphResult().data;
      const indVals = [];
      if (dataset !== undefined && dataset !== null) {
        for (let i = 0; i < dataset.length; i += 1) {
          if (dataset[i].label === curveLabel) {
            let indValsArray;
            switch (plotType) {
              // line plots only
              case matsTypes.PlotTypes.profile:
                indValsArray = dataset[i].y;
                break;
              case matsTypes.PlotTypes.reliability:
              case matsTypes.PlotTypes.roc:
              case matsTypes.PlotTypes.performanceDiagram:
              case matsTypes.PlotTypes.simpleScatter:
                if (dataset[i].binVals !== undefined) {
                  indValsArray = dataset[i].binVals;
                } else if (dataset[i].threshold_all !== undefined) {
                  indValsArray = dataset[i].threshold_all;
                } else {
                  indValsArray = dataset[i].x;
                }
                break;
              case matsTypes.PlotTypes.timeSeries:
              case matsTypes.PlotTypes.dieoff:
              case matsTypes.PlotTypes.threshold:
              case matsTypes.PlotTypes.validtime:
              case matsTypes.PlotTypes.gridscale:
              case matsTypes.PlotTypes.dailyModelCycle:
              case matsTypes.PlotTypes.yearToYear:
              case matsTypes.PlotTypes.gridscaleProb:
                indValsArray = dataset[i].x;
                break;
              default:
                indValsArray = [];
                break;
            }
            for (let j = 0; j < indValsArray.length; j += 1) {
              indVals.push({
                val:
                  (plotType === matsTypes.PlotTypes.performanceDiagram ||
                    plotType === matsTypes.PlotTypes.simpleScatter ||
                    plotType === matsTypes.PlotTypes.roc) &&
                  dataset[i].binParam !== undefined &&
                  dataset[i].binParam.indexOf("Date") > -1
                    ? moment.utc(indValsArray[j] * 1000).format("YYYY-MM-DD HH:mm")
                    : indValsArray[j],
                label: `${curveLabel}---${indValsArray[j].toString()}`,
              });
            }
            return indVals;
          }
        }
      }
    }
    return [];
  },
  plotName() {
    return Session.get("PlotParams").length === 0 ||
      Session.get("PlotParams").plotAction === undefined ||
      Session.get("plotType") === matsTypes.PlotTypes.map
      ? ""
      : Session.get("PlotParams").plotAction.toUpperCase();
  },
  logScaleText() {
    Session.get("PlotResultsUpDated");
    return Session.get("plotType") === matsTypes.PlotTypes.gridscaleProb
      ? " (in log10)"
      : "";
  },
  curveText() {
    if (this.diffFrom === undefined) {
      let plotType = Session.get("plotType");
      if (plotType === undefined) {
        const pfuncs = matsCollections.PlotGraphFunctions.find({}).fetch();
        for (let i = 0; i < pfuncs.length; i += 1) {
          if (pfuncs[i].checked === true) {
            Session.set("plotType", pfuncs[i].plotType);
          }
        }
        plotType = Session.get("plotType");
      }
      if (plotType === matsTypes.PlotTypes.profile) {
        return matsPlotUtils.getCurveTextWrapping(plotType, this).then();
      }
      return matsPlotUtils.getCurveText(plotType, this).then();
    }
    return `${this.label}:  Difference`;
  },
  confidenceDisplay() {
    if (Session.get("isModePairs")) {
      return "none";
    }
    if (Session.get("plotParameter") === "matched") {
      const plotType = Session.get("plotType");
      switch (plotType) {
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.profile:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.yearToYear:
          return "block";
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.gridscaleProb:
        case matsTypes.PlotTypes.map:
        case matsTypes.PlotTypes.histogram:
        case matsTypes.PlotTypes.ensembleHistogram:
        case matsTypes.PlotTypes.simpleScatter:
        case matsTypes.PlotTypes.scatter2d:
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
        default:
          return "none";
      }
    } else {
      return "none";
    }
  },
  plotText() {
    const p = Session.get("PlotParams");
    if (p !== undefined) {
      let format = p.plotFormat;
      if (
        matsCollections.PlotParams.findOne({ name: "plotFormat" }) &&
        matsCollections.PlotParams.findOne({ name: "plotFormat" }).optionsMap &&
        matsCollections.PlotParams.findOne({ name: "plotFormat" }).optionsMap[
          p.plotFormat
        ] !== undefined
      ) {
        format = matsCollections.PlotParams.findOne({ name: "plotFormat" }).optionsMap[
          p.plotFormat
        ];
      }
      if (format === undefined) {
        format = "Unmatched";
      }
      const plotType = Session.get("plotType");
      if (plotType) {
        switch (plotType) {
          case matsTypes.PlotTypes.timeSeries:
          case matsTypes.PlotTypes.dailyModelCycle:
          case matsTypes.PlotTypes.reliability:
          case matsTypes.PlotTypes.contour:
          case matsTypes.PlotTypes.contourDiff:
            return `${plotType.replace(/([A-Z][a-z])/g, " $1").trim()} ${
              p.dates
            } : ${format}`;
          case matsTypes.PlotTypes.profile:
          case matsTypes.PlotTypes.dieoff:
          case matsTypes.PlotTypes.threshold:
          case matsTypes.PlotTypes.validtime:
          case matsTypes.PlotTypes.gridscale:
          case matsTypes.PlotTypes.yearToYear:
          case matsTypes.PlotTypes.roc:
          case matsTypes.PlotTypes.performanceDiagram:
          case matsTypes.PlotTypes.gridscaleProb:
          case matsTypes.PlotTypes.histogram:
          case matsTypes.PlotTypes.simpleScatter:
            return `${plotType.replace(/([A-Z][a-z])/g, " $1").trim()}: ${format}`;
          case matsTypes.PlotTypes.map:
            return `Map ${p.dates} `;
          case matsTypes.PlotTypes.ensembleHistogram: {
            const ensembleType = p["histogram-type-controls"]
              ? p["histogram-type-controls"]
              : `${plotType.replace(/([A-Z][a-z])/g, " $1").trim()}`;
            return `${ensembleType}: ${format}`;
          }
          case matsTypes.PlotTypes.scatter2d:
          default:
            return `Scatter: ${p.dates} : ${format}`;
        }
      } else {
        return "";
      }
    } else {
      return "no plot params";
    }
  },
  color() {
    return this.color;
  },
  colorHex() {
    return `#${rgbHex(this.color)}`;
  },
  colorbarTitle() {
    Session.get("PlotResultsUpDated");
    const dataset = matsCurveUtils.getGraphResult().data;
    if (dataset) return dataset[0].colorbar.title.text;
    return "";
  },
  colorbarMin() {
    Session.get("PlotResultsUpDated");
    const dataset = matsCurveUtils.getGraphResult().data;
    if (dataset) return dataset[0].contours.start;
    return "";
  },
  colorbarMax() {
    Session.get("PlotResultsUpDated");
    const dataset = matsCurveUtils.getGraphResult().data;
    if (dataset) return dataset[0].contours.end;
    return "";
  },
  colorbarStep() {
    Session.get("PlotResultsUpDated");
    const dataset = matsCurveUtils.getGraphResult().data;
    if (dataset) return dataset[0].contours.size;
    return "";
  },
  xAxes() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    // create an array like [0,1,2...] for each unique xaxis
    // by getting the xaxis keys - filtering them to be unique, then using an Array.apply on the resulting array
    // to assign a number to each value
    if (
      !(
        $("#placeholder")[0] === undefined ||
        $("#placeholder")[0].layout === undefined ||
        plotType === matsTypes.PlotTypes.map
      )
    ) {
      const xAxis = Object.keys($("#placeholder")[0].layout).filter(function (k) {
        return k.startsWith("xaxis");
      });
      return [...Array(xAxis.length).keys()];
    }
    return undefined;
  },
  yAxes() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    // create an array like [0,1,2...] for each unique yaxis
    // by getting the yaxis keys - filtering them to be unique, then using an Array.apply on the resulting array
    // to assign a number to each value
    if (
      !(
        $("#placeholder")[0] === undefined ||
        $("#placeholder")[0].layout === undefined ||
        plotType === matsTypes.PlotTypes.map
      )
    ) {
      const yAxis = Object.keys($("#placeholder")[0].layout).filter(function (k) {
        return k.startsWith("yaxis");
      });
      return [...Array(yAxis.length).keys()];
    }
    return undefined;
  },
  isProfile() {
    return Session.get("plotType") === matsTypes.PlotTypes.profile;
  },
  isThreshold() {
    return Session.get("plotType") === matsTypes.PlotTypes.threshold;
  },
  isSimpleScatter() {
    return Session.get("plotType") === matsTypes.PlotTypes.simpleScatter;
  },
  isLinePlot() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
        return true;
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.scatter2d:
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return false;
    }
  },
  isLineOrScatterPlot() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.scatter2d:
      case matsTypes.PlotTypes.simpleScatter:
        return true;
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return false;
    }
  },
  isMultiAxisLinePlot() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.simpleScatter:
        return true;
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.scatter2d:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return false;
    }
  },
  isContour() {
    return (
      Session.get("plotType") === matsTypes.PlotTypes.contour ||
      Session.get("plotType") === matsTypes.PlotTypes.contourDiff
    );
  },
  isContourDiff() {
    return Session.get("plotType") === matsTypes.PlotTypes.contourDiff;
  },
  isNotMap() {
    return Session.get("plotType") !== matsTypes.PlotTypes.map;
  },
  sentAddresses() {
    const addresses = [];
    const a = matsCollections.SentAddresses.find(
      {},
      { fields: { address: 1 } }
    ).fetch();
    for (let i = 0; i < a.length; i += 1) {
      addresses.push(a[i].address);
    }
    return addresses;
  },
  hideButtonText() {
    const sval = `${this.label}hideButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide curve");
    }
    return Session.get(sval);
  },
  pointsButtonText() {
    const sval = `${this.label}pointsButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide points");
    }
    return Session.get(sval);
  },
  errorBarButtonText() {
    const sval = `${this.label}errorBarButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide error bars");
    }
    return Session.get(sval);
  },
  barChartButtonText() {
    const sval = `${this.label}barChartButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide bars");
    }
    return Session.get(sval);
  },
  annotateButtonText() {
    const sval = `${this.label}annotateButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide annotation");
    }
    return Session.get(sval);
  },
  legendButtonText() {
    const sval = `${this.label}legendButtonText`;
    if (Session.get(sval) === undefined) {
      Session.set(sval, "hide legend");
    }
    return Session.get(sval);
  },
  heatMapButtonText() {
    const sval = `${this.label}heatMapButtonText`;
    const { appName } = matsCollections.Settings.findOne({});
    if (Session.get(sval) === undefined) {
      if (
        appName !== undefined &&
        (appName.includes("ceiling") || appName.includes("visibility"))
      ) {
        Session.set(sval, "hide heat map");
      } else {
        Session.set(sval, "show heat map");
      }
    }
    return Session.get(sval);
  },
  curveShowHideDisplay() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
        return "block";
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.scatter2d:
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return "none";
    }
  },
  pointsShowHideDisplay() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.scatter2d:
        return "block";
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return "none";
    }
  },
  errorbarsShowHideDisplay() {
    const plotType = Session.get("plotType");
    const isMatched = Session.get("plotParameter") === "matched";
    if (isMatched) {
      switch (plotType) {
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.profile:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.yearToYear:
          return "block";
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.gridscaleProb:
        case matsTypes.PlotTypes.map:
        case matsTypes.PlotTypes.histogram:
        case matsTypes.PlotTypes.ensembleHistogram:
        case matsTypes.PlotTypes.scatter2d:
        case matsTypes.PlotTypes.simpleScatter:
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
        default:
          return "none";
      }
    } else {
      return "none";
    }
  },
  barsShowHideDisplay() {
    const plotType = Session.get("plotType");
    if (plotType.includes("Histogram") || plotType.includes("histogram")) {
      return "block";
    }
    return "none";
  },
  annotateShowHideDisplay() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.scatter2d:
      case matsTypes.PlotTypes.map:
        return "block";
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
      default:
        return "none";
    }
  },
  legendShowHideDisplay() {
    const plotType = Session.get("plotType");
    switch (plotType) {
      case matsTypes.PlotTypes.timeSeries:
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.dieoff:
      case matsTypes.PlotTypes.threshold:
      case matsTypes.PlotTypes.validtime:
      case matsTypes.PlotTypes.gridscale:
      case matsTypes.PlotTypes.dailyModelCycle:
      case matsTypes.PlotTypes.yearToYear:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.gridscaleProb:
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.histogram:
      case matsTypes.PlotTypes.ensembleHistogram:
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        return "block";
      case matsTypes.PlotTypes.map:
      case matsTypes.PlotTypes.scatter2d:
      default:
        return "none";
    }
  },
  heatMapShowHideDisplay() {
    const plotType = Session.get("plotType");
    if (plotType !== matsTypes.PlotTypes.map) {
      return "none";
    }
    return "block";
  },
  xAxisControlsNumberVisibility() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (
      plotType === matsTypes.PlotTypes.timeSeries ||
      plotType === matsTypes.PlotTypes.dailyModelCycle ||
      plotType === matsTypes.PlotTypes.yearToYear ||
      ((plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
        $("#placeholder")[0].layout.xaxis.title.text.indexOf("Date") > -1)
    ) {
      return "none";
    }
    return "block";
  },
  xAxisControlsTextVisibility() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (
      plotType === matsTypes.PlotTypes.timeSeries ||
      plotType === matsTypes.PlotTypes.dailyModelCycle ||
      plotType === matsTypes.PlotTypes.yearToYear ||
      ((plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
        $("#placeholder")[0].layout.xaxis.title.text.indexOf("Date") > -1)
    ) {
      return "block";
    }
    return "none";
  },
  yAxisControlsNumberVisibility() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (
      (plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
      $("#placeholder")[0].layout.yaxis.title.text.indexOf("Date") > -1
    ) {
      return "none";
    }
    return "block";
  },
  yAxisControlsTextVisibility() {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (
      (plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
      $("#placeholder")[0].layout.yaxis.title.text.indexOf("Date") > -1
    ) {
      return "block";
    }
    return "none";
  },
  displayReplotZoom() {
    // the replot to zoom function is only really appropriate for downsampled graphs which are
    // only possible in timeseries or dailymodelcycle plots
    Session.get("PlotParams");
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (
      plotType === matsTypes.PlotTypes.timeSeries ||
      plotType === matsTypes.PlotTypes.dailyModelCycle
    ) {
      return "block";
    }
    return "none";
  },
  recacheButtonRadius() {
    // Make sure the button group is rounded for maps
    Session.get("PlotParams");
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    if (plotType === matsTypes.PlotTypes.map) {
      return "5px";
    }
    return "0";
  },
  metApp() {
    Session.get("PlotParams");
    Session.get("PlotResultsUpDated");
    if (
      matsCollections.Settings.findOne({}) &&
      matsCollections.Settings.findOne({}).appType &&
      matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress &&
      Session.get("PlotParams")["metexpress-mode"] === "matsmv"
    ) {
      return "block";
    }
    return "none";
  },
  xAxisTitle(xAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const xAxisKey = `xaxis${xAxis === 0 ? "" : xAxis + 1}`;
    if (
      options !== undefined &&
      options[xAxisKey] !== undefined &&
      options[xAxisKey].title !== undefined &&
      options[xAxisKey].title.text !== undefined
    ) {
      return options[xAxisKey].title.text;
    }
    return "";
  },
  xAxisTitleFont(xAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const xAxisKey = `xaxis${xAxis === 0 ? "" : xAxis + 1}`;
    if (
      options !== undefined &&
      options[xAxisKey] !== undefined &&
      options[xAxisKey].title !== undefined &&
      options[xAxisKey].title.font !== undefined &&
      options[xAxisKey].title.font.size !== undefined
    ) {
      return options[xAxisKey].title.font.size;
    }
    return "";
  },
  xAxisMin(xAxis) {
    Session.get("PlotResultsUpDated");
    Session.get("plotType");
    const options = Session.get("options");
    const xAxisKey = `xaxis${xAxis === 0 ? "" : xAxis + 1}`;
    if (
      options !== undefined &&
      options[xAxisKey] !== undefined &&
      options[xAxisKey].range !== undefined
    ) {
      try {
        return options[xAxisKey].range[0].toPrecision(4);
      } catch {
        return options[xAxisKey].range[0];
      }
    } else {
      return "";
    }
  },
  xAxisMax(xAxis) {
    Session.get("PlotResultsUpDated");
    Session.get("plotType");
    const options = Session.get("options");
    const xAxisKey = `xaxis${xAxis === 0 ? "" : xAxis + 1}`;
    if (
      options !== undefined &&
      options[xAxisKey] !== undefined &&
      options[xAxisKey].range !== undefined
    ) {
      try {
        return options[xAxisKey].range[1].toPrecision(4);
      } catch {
        return options[xAxisKey].range[1];
      }
    } else {
      return "";
    }
  },
  xAxisTickFont(xAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const xAxisKey = `xaxis${xAxis === 0 ? "" : xAxis + 1}`;
    if (
      options !== undefined &&
      options[xAxisKey] !== undefined &&
      options[xAxisKey].tickfont !== undefined &&
      options[xAxisKey].tickfont.size !== undefined
    ) {
      return options[xAxisKey].tickfont.size;
    }
    return "";
  },
  yAxisTitle(yAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const yAxisKey = `yaxis${yAxis === 0 ? "" : yAxis + 1}`;
    if (
      options !== undefined &&
      options[yAxisKey] !== undefined &&
      options[yAxisKey].title !== undefined &&
      options[yAxisKey].title.text !== undefined
    ) {
      return options[yAxisKey].title.text;
    }
    return "";
  },
  yAxisTitleFont(yAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const yAxisKey = `yaxis${yAxis === 0 ? "" : yAxis + 1}`;
    if (
      options !== undefined &&
      options[yAxisKey] !== undefined &&
      options[yAxisKey].title !== undefined &&
      options[yAxisKey].title.font !== undefined &&
      options[yAxisKey].title.font.size !== undefined
    ) {
      return options[yAxisKey].title.font.size;
    }
    return "";
  },
  yAxisMin(yAxis) {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    const options = Session.get("options");
    const yAxisKey = `yaxis${yAxis === 0 ? "" : yAxis + 1}`;
    if (
      options !== undefined &&
      options[yAxisKey] !== undefined &&
      options[yAxisKey].range !== undefined
    ) {
      if (plotType === matsTypes.PlotTypes.profile) {
        try {
          return options[yAxisKey].range[1].toPrecision(4);
        } catch {
          return options[yAxisKey].range[1];
        }
      } else {
        try {
          return options[yAxisKey].range[0].toPrecision(4);
        } catch {
          return options[yAxisKey].range[0];
        }
      }
    } else {
      return "";
    }
  },
  yAxisMax(yAxis) {
    Session.get("PlotResultsUpDated");
    const plotType = Session.get("plotType");
    const options = Session.get("options");
    const yAxisKey = `yaxis${yAxis === 0 ? "" : yAxis + 1}`;
    if (
      options !== undefined &&
      options[yAxisKey] !== undefined &&
      options[yAxisKey].range !== undefined
    ) {
      if (plotType === matsTypes.PlotTypes.profile) {
        try {
          return options[yAxisKey].range[0].toPrecision(4);
        } catch {
          return options[yAxisKey].range[0];
        }
      } else {
        try {
          return options[yAxisKey].range[1].toPrecision(4);
        } catch {
          return options[yAxisKey].range[1];
        }
      }
    } else {
      return "";
    }
  },
  yAxisTickFont(yAxis) {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    const yAxisKey = `yaxis${yAxis === 0 ? "" : yAxis + 1}`;
    if (
      options !== undefined &&
      options[yAxisKey] !== undefined &&
      options[yAxisKey].tickfont !== undefined &&
      options[yAxisKey].tickfont.size !== undefined
    ) {
      return options[yAxisKey].tickfont.size;
    }
    return "";
  },
  legendFontSize() {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    if (
      options !== undefined &&
      options.legend !== undefined &&
      options.legend.font !== undefined &&
      options.legend.font.size !== undefined
    ) {
      return options.legend.font.size;
    }
    return "";
  },
  gridWeight() {
    Session.get("PlotResultsUpDated");
    const options = Session.get("options");
    if (
      options !== undefined &&
      options.xaxis !== undefined &&
      options.xaxis.gridwidth !== undefined
    ) {
      return options.xaxis.gridwidth;
    }
    return "";
  },
  /**
   * @return {string}
   */
  RdWhBuTriplet() {
    // rgb values for custom RdWhBu colormap
    return '[[0,"rgb(5,10,172)"],[0.35,"rgb(106,137,247)"],[0.45,"rgb(255,255,255)"],[0.55,"rgb(255,255,255)"],[0.6,"rgb(220,170,132)"],[0.7,"rgb(230,145,90)"],[1,"rgb(178,10,28)"]]';
  },
  /**
   * @return {string}
   */
  MPL_BrBGTriplet() {
    // rgb values for custom MPL_BrBG colormap
    return '[[0,"rgb(86,49,5)"],[0.008,"rgb(91,52,6)"],[0.016,"rgb(95,54,6)"],[0.023,"rgb(99,57,6)"],[0.031,"rgb(104,60,7)"],[0.039,"rgb(108,62,7)"],[0.047,"rgb(113,65,8)"],[0.055,"rgb(117,67,8)"],[0.063,"rgb(121,70,8)"],[0.070,"rgb(124,71,9)"],[0.078,"rgb(130,75,9)"],[0.086,"rgb(132,76,9)"],[0.094,"rgb(139,80,10)"],[0.102,"rgb(141,82,11)"],[0.109,"rgb(147,88,15)"],[0.117,"rgb(149,89,16)"],[0.125,"rgb(155,95,20)"],[0.133,"rgb(159,99,23)"],[0.141,"rgb(161,101,24)"],[0.148,"rgb(167,106,29)"],[0.156,"rgb(171,110,31)"],[0.164,"rgb(175,114,34)"],[0.172,"rgb(177,116,35)"],[0.180,"rgb(183,121,40)"],[0.188,"rgb(187,125,42)"],[0.195,"rgb(191,129,45)"],[0.203,"rgb(192,132,48)"],[0.211,"rgb(196,139,58)"],[0.219,"rgb(199,144,64)"],[0.227,"rgb(201,149,70)"],[0.234,"rgb(202,152,73)"],[0.242,"rgb(206,160,83)"],[0.250,"rgb(209,165,89)"],[0.258,"rgb(211,170,95)"],[0.266,"rgb(214,175,101)"],[0.273,"rgb(216,180,108)"],[0.281,"rgb(219,185,114)"],[0.289,"rgb(220,188,117)"],[0.297,"rgb(223,195,126)"],[0.305,"rgb(225,198,132)"],[0.313,"rgb(227,201,137)"],[0.320,"rgb(229,204,143)"],[0.328,"rgb(231,207,148)"],[0.336,"rgb(232,210,154)"],[0.344,"rgb(234,213,159)"],[0.352,"rgb(235,214,162)"],[0.359,"rgb(238,219,170)"],[0.367,"rgb(240,222,176)"],[0.375,"rgb(241,225,181)"],[0.383,"rgb(243,228,187)"],[0.391,"rgb(245,231,192)"],[0.398,"rgb(246,233,197)"],[0.406,"rgb(246,234,201)"],[0.414,"rgb(246,234,203)"],[0.422,"rgb(246,236,209)"],[0.430,"rgb(246,237,213)"],[0.438,"rgb(246,238,217)"],[0.445,"rgb(245,239,220)"],[0.453,"rgb(245,240,224)"],[0.461,"rgb(245,241,228)"],[0.469,"rgb(245,242,232)"],[0.477,"rgb(245,242,234)"],[0.484,"rgb(245,244,240)"],[0.492,"rgb(245,245,244)"],[0.500,"rgb(242,244,244)"],[0.508,"rgb(239,243,243)"],[0.516,"rgb(235,243,242)"],[0.523,"rgb(231,242,240)"],[0.531,"rgb(228,241,239)"],[0.539,"rgb(224,240,238)"],[0.547,"rgb(221,239,237)"],[0.555,"rgb(217,238,235)"],[0.563,"rgb(213,237,234)"],[0.570,"rgb(210,237,233)"],[0.578,"rgb(206,236,232)"],[0.586,"rgb(204,235,231)"],[0.594,"rgb(199,234,229)"],[0.602,"rgb(193,232,226)"],[0.609,"rgb(188,229,223)"],[0.617,"rgb(182,227,221)"],[0.625,"rgb(177,225,218)"],[0.633,"rgb(171,223,215)"],[0.641,"rgb(166,220,212)"],[0.648,"rgb(160,218,209)"],[0.656,"rgb(154,216,206)"],[0.664,"rgb(149,214,204)"],[0.672,"rgb(143,211,201)"],[0.680,"rgb(138,209,198)"],[0.688,"rgb(132,207,195)"],[0.695,"rgb(127,204,192)"],[0.703,"rgb(121,200,188)"],[0.711,"rgb(118,198,186)"],[0.719,"rgb(109,191,180)"],[0.727,"rgb(103,187,176)"],[0.734,"rgb(97,183,172)"],[0.742,"rgb(91,179,168)"],[0.750,"rgb(85,174,165)"],[0.758,"rgb(79,170,161)"],[0.766,"rgb(74,166,157)"],[0.773,"rgb(68,162,153)"],[0.781,"rgb(62,157,149)"],[0.789,"rgb(56,153,145)"],[0.797,"rgb(51,149,141)"],[0.805,"rgb(47,145,137)"],[0.813,"rgb(43,141,133)"],[0.820,"rgb(39,138,130)"],[0.828,"rgb(35,134,126)"],[0.836,"rgb(33,132,124)"],[0.844,"rgb(26,126,118)"],[0.852,"rgb(22,122,114)"],[0.859,"rgb(18,118,110)"],[0.867,"rgb(14,114,106)"],[0.875,"rgb(10,111,103)"],[0.883,"rgb(6,107,99)"],[0.891,"rgb(2,103,95)"],[0.898,"rgb(1,100,91)"],[0.906,"rgb(1,96,88)"],[0.914,"rgb(1,93,84)"],[0.922,"rgb(1,90,80)"],[0.930,"rgb(1,86,77)"],[0.938,"rgb(1,83,73)"],[0.945,"rgb(0,80,70)"],[0.953,"rgb(0,76,66)"],[0.961,"rgb(0,75,64)"],[0.969,"rgb(0,70,59)"],[0.977,"rgb(0,67,55)"],[0.984,"rgb(0,63,52)"],[1,"rgb(0,60,48)"]]';
  },
  /**
   * @return {string}
   */
  MPL_BrBWGTriplet() {
    // rgb values for custom MPL_BrBG colormap
    return '[[0,"rgb(86,49,5)"],[0.008,"rgb(91,52,6)"],[0.016,"rgb(95,54,6)"],[0.023,"rgb(99,57,6)"],[0.031,"rgb(104,60,7)"],[0.039,"rgb(108,62,7)"],[0.047,"rgb(113,65,8)"],[0.055,"rgb(117,67,8)"],[0.063,"rgb(121,70,8)"],[0.070,"rgb(124,71,9)"],[0.078,"rgb(130,75,9)"],[0.086,"rgb(132,76,9)"],[0.094,"rgb(139,80,10)"],[0.102,"rgb(141,82,11)"],[0.109,"rgb(147,88,15)"],[0.117,"rgb(149,89,16)"],[0.125,"rgb(155,95,20)"],[0.133,"rgb(159,99,23)"],[0.141,"rgb(161,101,24)"],[0.148,"rgb(167,106,29)"],[0.156,"rgb(171,110,31)"],[0.164,"rgb(175,114,34)"],[0.172,"rgb(177,116,35)"],[0.180,"rgb(183,121,40)"],[0.188,"rgb(187,125,42)"],[0.195,"rgb(191,129,45)"],[0.203,"rgb(192,132,48)"],[0.211,"rgb(196,139,58)"],[0.219,"rgb(199,144,64)"],[0.227,"rgb(201,149,70)"],[0.234,"rgb(202,152,73)"],[0.242,"rgb(206,160,83)"],[0.250,"rgb(209,165,89)"],[0.258,"rgb(211,170,95)"],[0.266,"rgb(214,175,101)"],[0.273,"rgb(216,180,108)"],[0.281,"rgb(219,185,114)"],[0.289,"rgb(220,188,117)"],[0.297,"rgb(223,195,126)"],[0.305,"rgb(225,198,132)"],[0.313,"rgb(227,201,137)"],[0.320,"rgb(229,204,143)"],[0.328,"rgb(231,207,148)"],[0.336,"rgb(232,210,154)"],[0.344,"rgb(234,213,159)"],[0.352,"rgb(235,214,162)"],[0.359,"rgb(238,219,170)"],[0.367,"rgb(240,222,176)"],[0.375,"rgb(241,225,181)"],[0.383,"rgb(243,228,187)"],[0.391,"rgb(245,231,192)"],[0.398,"rgb(246,233,197)"],[0.406,"rgb(246,234,201)"],[0.414,"rgb(246,234,203)"],[0.422,"rgb(246,236,209)"],[0.430,"rgb(246,237,213)"],[0.438,"rgb(246,238,217)"],[0.445,"rgb(255,255,255)"],[0.555,"rgb(255,255,255)"],[0.563,"rgb(213,237,234)"],[0.570,"rgb(210,237,233)"],[0.578,"rgb(206,236,232)"],[0.586,"rgb(204,235,231)"],[0.594,"rgb(199,234,229)"],[0.602,"rgb(193,232,226)"],[0.609,"rgb(188,229,223)"],[0.617,"rgb(182,227,221)"],[0.625,"rgb(177,225,218)"],[0.633,"rgb(171,223,215)"],[0.641,"rgb(166,220,212)"],[0.648,"rgb(160,218,209)"],[0.656,"rgb(154,216,206)"],[0.664,"rgb(149,214,204)"],[0.672,"rgb(143,211,201)"],[0.680,"rgb(138,209,198)"],[0.688,"rgb(132,207,195)"],[0.695,"rgb(127,204,192)"],[0.703,"rgb(121,200,188)"],[0.711,"rgb(118,198,186)"],[0.719,"rgb(109,191,180)"],[0.727,"rgb(103,187,176)"],[0.734,"rgb(97,183,172)"],[0.742,"rgb(91,179,168)"],[0.750,"rgb(85,174,165)"],[0.758,"rgb(79,170,161)"],[0.766,"rgb(74,166,157)"],[0.773,"rgb(68,162,153)"],[0.781,"rgb(62,157,149)"],[0.789,"rgb(56,153,145)"],[0.797,"rgb(51,149,141)"],[0.805,"rgb(47,145,137)"],[0.813,"rgb(43,141,133)"],[0.820,"rgb(39,138,130)"],[0.828,"rgb(35,134,126)"],[0.836,"rgb(33,132,124)"],[0.844,"rgb(26,126,118)"],[0.852,"rgb(22,122,114)"],[0.859,"rgb(18,118,110)"],[0.867,"rgb(14,114,106)"],[0.875,"rgb(10,111,103)"],[0.883,"rgb(6,107,99)"],[0.891,"rgb(2,103,95)"],[0.898,"rgb(1,100,91)"],[0.906,"rgb(1,96,88)"],[0.914,"rgb(1,93,84)"],[0.922,"rgb(1,90,80)"],[0.930,"rgb(1,86,77)"],[0.938,"rgb(1,83,73)"],[0.945,"rgb(0,80,70)"],[0.953,"rgb(0,76,66)"],[0.961,"rgb(0,75,64)"],[0.969,"rgb(0,70,59)"],[0.977,"rgb(0,67,55)"],[0.984,"rgb(0,63,52)"],[1,"rgb(0,60,48)"]]';
  },
});

Template.graph.events({
  "click .mvCtrlButton"() {
    const mvWindow = window.open(this.url, "mv", "height=200,width=200");
    setTimeout(function () {
      mvWindow.reload();
    }, 500);
  },
  "click .back"() {
    const plotType = Session.get("plotType");
    if (plotType === matsTypes.PlotTypes.contourDiff) {
      const oldCurves = Session.get("oldCurves");
      Session.set("Curves", oldCurves);
    }
    matsPlotUtils.enableActionButtons();
    matsGraphUtils.setDefaultView();
    matsCurveUtils.resetPlotResultData();
    return false;
  },

  "click .header"() {
    document.getElementById("graph-control").style.display = "block";
    // document.getElementById('showAdministration').style.display = 'block';
    document.getElementById("navbar").style.display = "block";
    document.getElementById("footnav").style.display = "block";

    const ctbgElems = $('*[id^="curve-text-buttons-grp"]');
    for (let i = 0; i < ctbgElems.length; i += 1) {
      ctbgElems[i].style.display = "block";
    }
  },
  "click .preview"() {
    // capture the layout
    const { layout } = $("#placeholder")[0];
    const key = Session.get("plotResultKey");
    matsMethods.saveLayout
      .callAsync({
        resultKey: key,
        layout,
        curveOpsUpdate: { curveOpsUpdate },
        annotation,
      })
      .then()
      .catch(function (error) {
        setError(error);
      });
    // open a new window with a standAlone graph of the current graph
    const plotType = Session.get("plotType");
    let h;
    let w;
    switch (plotType) {
      case matsTypes.PlotTypes.profile:
      case matsTypes.PlotTypes.reliability:
      case matsTypes.PlotTypes.roc:
      case matsTypes.PlotTypes.performanceDiagram:
      case matsTypes.PlotTypes.simpleScatter:
      case matsTypes.PlotTypes.scatter2d:
        // set the dimensions square
        h =
          Math.max(document.documentElement.clientHeight, window.innerWidth || 0) *
          0.85;
        w = h * 0.9;
        break;
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
        // set the dimensions rectangular
        h =
          Math.max(document.documentElement.clientHeight, window.innerWidth || 0) *
          0.65;
        w = h * 1.35;
        break;
    }
    const appName = Meteor.settings.public.app;
    const graphFunction = Session.get("graphFunction");
    const plotParameter = Session.get("plotParameter");
    const wind = window.open(
      `${window.location.href}/preview/${graphFunction}/${key}/${plotParameter}/${appName}`,
      "_blank",
      "status=no,titlebar=no,toolbar=no,scrollbars=no,menubar=no,resizable=yes",
      `height=${h},width=${w}`
    );
    setTimeout(function () {
      wind.resizeTo(w, h);
    }, 100);
    openWindows.push(wind);
  },
  "click .closeapp"() {
    for (let widx = 0; widx < openWindows.length; widx += 1) {
      openWindows[widx].close();
    }
    openWindows = [];
  },
  "click .reload"() {
    const dataset = matsCurveUtils.getGraphResult().data;
    const { options } = matsCurveUtils.getGraphResult();
    const graphFunction = Session.get("graphFunction");
    window[graphFunction](dataset, options);
  },
  "click .plotButton"() {
    matsGraphUtils.setGraphView(Session.get("plotType"));
    Session.set("graphViewMode", matsTypes.PlotView.graph);
    matsCurveUtils.hideSpinner();
  },
  "click .textButton"() {
    matsGraphUtils.setTextView(Session.get("plotType"));
    Session.set("graphViewMode", matsTypes.PlotView.text);
    Session.set("pageIndex", 0);
    Session.set("newPageIndex", 1);
    Session.set("textRefreshNeeded", true);
  },
  "click .export"() {
    document.getElementById("text_export").click();
  },
  "click .sentAddresses"(event) {
    const address =
      event.currentTarget.options[event.currentTarget.selectedIndex].value;
    document.getElementById("sendAddress").value = address;
  },
  "click .share"() {
    // show address modal
    if (!Meteor.user()) {
      setError(new Error("You must be logged in to use the 'share' feature"));
      return false;
    }
    $("#sendModal").modal("show");
    return null;
  },
  "click .basis"() {
    const appName = Meteor.settings.public.app;
    const graphFunction = Session.get("graphFunction");
    const plotResultKey = Session.get("plotResultKey");
    const plotParameter = Session.get("plotParameter");
    window.open(
      `${window.location.href}/JSON/${graphFunction}/${plotResultKey}/${plotParameter}/${appName}`,
      "_blank",
      "resizable=yes"
    );
  },
  "click .axisLimitButton"() {
    $("#axisLimitModal").modal("show");
  },
  "click .lineTypeButton"() {
    $("#lineTypeModal").modal("show");
  },
  "click .showHideButton"() {
    $("#showHideModal").modal("show");
  },
  "click .legendTextButton"() {
    $("#legendTextModal").modal("show");
  },
  "click .filterPointsButton"() {
    $("#filterPointsModal").modal("show");
  },
  "click .colorbarButton"() {
    $("#colorbarModal").modal("show");
  },
  "click .axisYScale"() {
    // get all yaxes and change their scales
    const newOpts = {};
    let yAxis;
    for (let k = 0; k < yAxes.length; k += 1) {
      yAxis = yAxes[k];
      newOpts[`${yAxis}.type`] =
        $("#placeholder")[0].layout[yAxis].type === "linear" ? "log" : "linear";
    }
    Plotly.relayout($("#placeholder")[0], newOpts);
  },
  "click .axisCombineButton"() {
    const newOpts = {};
    const updates = [];
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const options = Session.get("options");
    const reservedWords = Object.values(matsTypes.ReservedWords);
    const nCurves = dataset.filter(function (k) {
      return (
        reservedWords.indexOf(k.label) === -1 &&
        !k.label.includes(matsTypes.ReservedWords.noSkill)
      );
    }).length;
    let newAxisLabel;
    let min = Number.MAX_VALUE; // placeholder xmin
    let max = -1 * Number.MAX_VALUE; // placeholder xmax
    let didx;
    let xidx;
    let yidx;
    if (nCurves > 1) {
      if (!Session.get("axesCollapsed")) {
        // combine all x- or y-axes into the same axis
        for (didx = 0; didx < dataset.length; didx += 1) {
          if (
            reservedWords.indexOf(dataset[didx].label) === -1 &&
            !dataset[didx].label.includes(matsTypes.ReservedWords.noSkill)
          ) {
            if (plotType === matsTypes.PlotTypes.profile) {
              updates[didx] = {
                xaxis: "x1",
              };
            } else if (plotType === matsTypes.PlotTypes.simpleScatter) {
              updates[didx] = {
                xaxis: "x1",
                yaxis: "y1",
              };
            } else {
              updates[didx] = {
                yaxis: "y1",
              };
            }
            Plotly.restyle($("#placeholder")[0], updates[didx], didx);
          }
        }
        if (
          plotType === matsTypes.PlotTypes.profile ||
          plotType === matsTypes.PlotTypes.simpleScatter
        ) {
          newAxisLabel = "";
          for (xidx = 0; xidx < xAxes.length; xidx += 1) {
            newAxisLabel =
              newAxisLabel === ""
                ? options[xAxes[xidx]].title.text
                : `${newAxisLabel}/${options[xAxes[xidx]].title.text}`;
            min =
              options[xAxes[xidx]].range[0] < min ? options[xAxes[xidx]].range[0] : min;
            max =
              options[xAxes[xidx]].range[1] > max ? options[xAxes[xidx]].range[1] : max;
          }
          newOpts["xaxis.title.text"] = newAxisLabel;
          newOpts["xaxis.range[0]"] = min - (max - min) * 0.125;
          newOpts["xaxis.range[1]"] = max + (max - min) * 0.125;
        }
        if (plotType !== matsTypes.PlotTypes.profile) {
          newAxisLabel = "";
          for (yidx = 0; yidx < yAxes.length; yidx += 1) {
            newAxisLabel =
              newAxisLabel === ""
                ? options[yAxes[yidx]].title.text
                : `${newAxisLabel}/${options[yAxes[yidx]].title.text}`;
            min =
              options[yAxes[yidx]].range[0] < min ? options[yAxes[yidx]].range[0] : min;
            max =
              options[yAxes[yidx]].range[1] > max ? options[yAxes[yidx]].range[1] : max;
          }
          newOpts["yaxis.title.text"] = newAxisLabel;
          newOpts["yaxis.range[0]"] = min - (max - min) * 0.125;
          newOpts["yaxis.range[1]"] = max + (max - min) * 0.125;
        }
        Plotly.relayout($("#placeholder")[0], newOpts);
        Session.set("axesCollapsed", true);
      } else {
        // separate x- or y-axes back out
        const lineTypeResetOpts = Session.get("lineTypeResetOpts");
        for (didx = 0; didx < dataset.length; didx += 1) {
          if (
            reservedWords.indexOf(dataset[didx].label) === -1 &&
            !dataset[didx].label.includes(matsTypes.ReservedWords.noSkill)
          ) {
            if (plotType === matsTypes.PlotTypes.profile) {
              updates[didx] = {
                xaxis: lineTypeResetOpts[didx].xaxis,
              };
            } else if (plotType === matsTypes.PlotTypes.simpleScatter) {
              updates[didx] = {
                xaxis: lineTypeResetOpts[didx].xaxis,
                yaxis: lineTypeResetOpts[didx].yaxis,
              };
            } else {
              updates[didx] = {
                yaxis: lineTypeResetOpts[didx].yaxis,
              };
            }
            Plotly.restyle($("#placeholder")[0], updates[didx], didx);
          }
        }
        if (
          plotType === matsTypes.PlotTypes.profile ||
          plotType === matsTypes.PlotTypes.simpleScatter
        ) {
          for (xidx = 0; xidx < xAxes.length; xidx += 1) {
            newOpts[`${xAxes[xidx]}.title.text`] = options[xAxes[xidx]].title.text;
            [newOpts[`${xAxes[xidx]}.range[0]`]] = options[xAxes[xidx]].range;
            [, newOpts[`${xAxes[xidx]}.range[1]`]] = options[xAxes[xidx]].range;
          }
        }
        if (plotType !== matsTypes.PlotTypes.profile) {
          for (yidx = 0; yidx < yAxes.length; yidx += 1) {
            newOpts[`${yAxes[yidx]}.title.text`] = options[yAxes[yidx]].title.text;
            [newOpts[`${yAxes[yidx]}.range[0]`]] = options[yAxes[yidx]].range;
            [, newOpts[`${yAxes[yidx]}.range[1]`]] = options[yAxes[yidx]].range;
          }
        }
        Plotly.relayout($("#placeholder")[0], newOpts);
        Session.set("axesCollapsed", false);
      }
      // save the updates in case we want to pass them to a pop-out window.
      for (let uidx = 0; uidx < updates.length; uidx += 1) {
        saveUpdatesToJSON(updates[uidx], uidx);
      }
    }
  },
  "click .axisXSpace"(event) {
    // equally space the x values, or restore them.
    event.preventDefault();
    const dataset = matsCurveUtils.getGraphResult().data;
    const thresholdEquiX = Session.get("thresholdEquiX"); // boolean that has the current state of the axes
    const newOpts = {};
    const updates = [];
    let origX = [];
    const equiX = [];
    let tickvals = [];
    let ticktext = [];
    let didx;
    newOpts["xaxis.range[0]"] = Number.MAX_VALUE; // placeholder xmin
    newOpts["xaxis.range[1]"] = -1 * Number.MAX_VALUE; // placeholder xmax
    const reservedWords = Object.values(matsTypes.ReservedWords);
    if (!thresholdEquiX) {
      // axes are not equally spaced, so make them so
      for (didx = 0; didx < dataset.length; didx += 1) {
        // save the original x values
        origX.push(dataset[didx].x);

        // create new array of equally-space x values
        const newX = [];
        if (
          reservedWords.indexOf(dataset[didx].label) >= 0 ||
          dataset[didx].label.includes(matsTypes.ReservedWords.noSkill)
        ) {
          // for zero or max curves, the two x points should be the axis min and max
          newX.push(newOpts["xaxis.range[0]"]);
          newX.push(newOpts["xaxis.range[1]"]);
        } else {
          // otherwise just use the first n integers
          for (let xidx = 0; xidx < dataset[didx].x.length; xidx += 1) {
            newX.push(xidx);
          }
        }
        equiX.push([newX]);

        // redraw the curves with equally-spaced x values
        updates[didx] = updates[didx] === undefined ? {} : updates[didx];
        updates[didx].x = [newX];
        Plotly.restyle($("#placeholder")[0], updates[didx], didx);

        // save the updates in case we want to pass them to a pop-out window.
        curveOpsUpdate[didx] =
          curveOpsUpdate[didx] === undefined ? {} : curveOpsUpdate[didx];
        curveOpsUpdate[didx].x = [newX];

        // store the new xmax and xmin from this curve
        newOpts["xaxis.range[0]"] =
          newOpts["xaxis.range[0]"] < newX[0] ? newOpts["xaxis.range[0]"] : newX[0];
        newOpts["xaxis.range[1]"] =
          newOpts["xaxis.range[1]"] > newX[newX.length - 1]
            ? newOpts["xaxis.range[1]"]
            : newX[newX.length - 1];

        // store previous and new x values to craft consistent tick marks
        if (
          reservedWords.indexOf(dataset[didx].label) === -1 &&
          !dataset[didx].label.includes(matsTypes.ReservedWords.noSkill)
        ) {
          tickvals = _.union(tickvals, newX);
          ticktext = _.union(ticktext, origX[didx]);
        }
      }
      Session.set("thresholdEquiX", true);
      Session.set("origX", origX);
      Session.set("equiX", equiX);
    } else {
      // axes are equally spaced, so make them not
      origX = Session.get("origX"); // get the original x values back out of the session
      for (didx = 0; didx < dataset.length; didx += 1) {
        // redraw the curves with the original x values
        updates[didx] = updates[didx] === undefined ? {} : updates[didx];
        updates[didx].x = [origX[didx]];
        Plotly.restyle($("#placeholder")[0], updates[didx], didx);

        // store the new xmax and xmin from this curve
        newOpts["xaxis.range[0]"] =
          newOpts["xaxis.range[0]"] < origX[didx][0]
            ? newOpts["xaxis.range[0]"]
            : origX[didx][0];
        newOpts["xaxis.range[1]"] =
          newOpts["xaxis.range[1]"] > origX[didx][origX[didx].length - 1]
            ? newOpts["xaxis.range[1]"]
            : origX[didx][origX[didx].length - 1];

        // store previous and new x values to craft consistent tick marks
        if (
          reservedWords.indexOf(dataset[didx].label) === -1 &&
          !dataset[didx].label.includes(matsTypes.ReservedWords.noSkill)
        ) {
          tickvals = _.union(tickvals, origX[didx]);
          ticktext = _.union(ticktext, origX[didx]);
        }

        // remove new formatting that would have been passed to pop-out windows
        delete curveOpsUpdate[didx].x;
      }
      Session.set("thresholdEquiX", false);
    }
    // redraw the plot with the new axis options
    newOpts["xaxis.tickvals"] = tickvals.sort(function (a, b) {
      return a - b;
    });
    newOpts["xaxis.ticktext"] = ticktext
      .sort(function (a, b) {
        return a - b;
      })
      .map(String);
    const xPad =
      (newOpts["xaxis.range[1]"] - newOpts["xaxis.range[0]"]) * 0.025 !== 0
        ? (newOpts["xaxis.range[1]"] - newOpts["xaxis.range[0]"]) * 0.025
        : 0.025;
    newOpts["xaxis.range[0]"] -= xPad;
    newOpts["xaxis.range[1]"] += xPad;
    Plotly.relayout($("#placeholder")[0], newOpts);
  },
  "click .firstPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      Session.set("pageIndex", 0);
      Session.set("newPageIndex", 1);
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .previousTenPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      const pageTextDirection = Session.get("pageTextDirection");
      // if the navigation direction is changing, you have to increment the page index an additional time,
      // or you just move to the other end of the current page, and nothing appears to change.
      if (pageTextDirection !== undefined && pageTextDirection === -1) {
        Session.set("newPageIndex", pageIndex - 10);
      } else {
        Session.set("newPageIndex", pageIndex - 11);
      }
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .previousPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      const pageTextDirection = Session.get("pageTextDirection");
      // if the navigation direction is changing, you have to increment the page index an additional time,
      // or you just move to the other end of the current page, and nothing appears to change.
      if (pageTextDirection !== undefined && pageTextDirection === -1) {
        Session.set("newPageIndex", pageIndex - 1);
      } else {
        Session.set("newPageIndex", pageIndex - 2);
      }
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .nextPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      const pageTextDirection = Session.get("pageTextDirection");
      // if the navigation direction is changing, you have to increment the page index an additional time,
      // or you just move to the other end of the current page, and nothing appears to change.
      if (pageTextDirection !== undefined && pageTextDirection === 1) {
        Session.set("newPageIndex", pageIndex + 1);
      } else {
        Session.set("newPageIndex", pageIndex + 2);
      }
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .nextTenPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      const pageTextDirection = Session.get("pageTextDirection");
      // if the navigation direction is changing, you have to increment the page index an additional time,
      // or you just move to the other end of the current page, and nothing appears to change.
      if (pageTextDirection !== undefined && pageTextDirection === 1) {
        Session.set("newPageIndex", pageIndex + 10);
      } else {
        Session.set("newPageIndex", pageIndex + 11);
      }
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .lastPageButton"() {
    const pageIndex = Session.get("pageIndex");
    // if pageIndex is NaN, it means we only have one page and these buttons shouldn't do anything
    if (!Number.isNaN(pageIndex)) {
      Session.set("newPageIndex", -2000);
      Session.set("textRefreshNeeded", true);
    }
  },
  "click .replotZoomButton"() {
    const plotType = Session.get("plotType");
    if (
      plotType === matsTypes.PlotTypes.timeSeries ||
      plotType === matsTypes.PlotTypes.dailyModelCycle
    ) {
      const newDateRange = `${moment
        .utc($("#placeholder")[0].layout.xaxis.range[0])
        .format("M/DD/YYYY HH:mm")} - ${moment
        .utc($("#placeholder")[0].layout.xaxis.range[1])
        .format("M/DD/YYYY HH:mm")}`;
      console.log(newDateRange);
      document.getElementById("controlButton-dates-value").innerHTML = newDateRange;
      document.getElementById("plot-curves").click();
    }
  },
  "click .reCacheButton"() {
    Session.get("plotType");
    Session.set("expireKey", true);
    document.getElementById("plot-curves").click();
  },
  "click .curveVisibility"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const { id } = event.target;
    const label = id.replace("-curve-show-hide", "");
    const myDataIdx = dataset.findIndex(function (d) {
      return d.curveId === label;
    });
    let noSkillIdx;
    if (plotType === matsTypes.PlotTypes.reliability) {
      noSkillIdx = dataset.findIndex(function (d) {
        return (
          d.curveId ===
          `${label}-${
            myDataIdx === 0
              ? matsTypes.ReservedWords.noSkill
              : matsTypes.ReservedWords.noSkillNoLabel
          }`
        );
      });
    }
    let update;
    let noSkillUpdate;
    if (dataset[myDataIdx].x.length > 0) {
      if (dataset[myDataIdx].visible !== "legendonly") {
        if (dataset[myDataIdx].mode === "lines") {
          // in line mode, lines are visible, so make nothing visible
          update = {
            visible: "legendonly",
          };
          $(`#${id}`)[0].value = "show curve";
          if (plotType === matsTypes.PlotTypes.reliability) {
            noSkillUpdate = {
              visible: false,
            };
          }
        } else if (dataset[myDataIdx].mode === "lines+markers") {
          // in line and point mode, lines and points are visible, so make nothing visible
          update = {
            visible: "legendonly",
          };
          $(`#${id}`)[0].value = "show curve";
          $(`#${id}-points`)[0].value = "show points";
          if (plotType === matsTypes.PlotTypes.reliability) {
            noSkillUpdate = {
              visible: false,
            };
          }
        } else if (
          dataset[myDataIdx].mode === "markers" &&
          plotType !== matsTypes.PlotTypes.simpleScatter
        ) {
          // in point mode, points are visible, so make lines and points visible
          update = {
            mode: "lines+markers",
          };
          $(`#${id}`)[0].value = "hide curve";
          if (plotType === matsTypes.PlotTypes.reliability) {
            noSkillUpdate = {
              visible: true,
            };
          }
        }
      } else if (dataset[myDataIdx].mode === "lines") {
        // in line mode, nothing is visible, so make lines visible
        update = {
          visible: true,
        };
        $(`#${id}`)[0].value = "hide curve";
        if (plotType === matsTypes.PlotTypes.reliability) {
          noSkillUpdate = {
            visible: true,
          };
        }
      } else if (dataset[myDataIdx].mode === "lines+markers") {
        // in line and point mode, nothing is visible, so make lines and points visible
        update = {
          visible: true,
        };
        if (plotType === matsTypes.PlotTypes.reliability) {
          noSkillUpdate = {
            visible: true,
          };
        }
        $(`#${id}`)[0].value = "hide curve";
        $(`#${id}-points`)[0].value = "hide points";
      }
    }
    Plotly.restyle($("#placeholder")[0], update, myDataIdx);
    if (plotType === matsTypes.PlotTypes.reliability && noSkillUpdate) {
      Plotly.restyle($("#placeholder")[0], noSkillUpdate, noSkillIdx);
    }

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, myDataIdx);
    if (plotType === matsTypes.PlotTypes.reliability) {
      saveUpdatesToJSON(noSkillUpdate, noSkillIdx);
    }
  },
  "click .pointsVisibility"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const { id } = event.target;
    const label = id.replace("-curve-show-hide-points", "");
    const myDataIdx = dataset.findIndex(function (d) {
      return d.curveId === label;
    });
    let noSkillIdx;
    if (plotType === matsTypes.PlotTypes.reliability) {
      noSkillIdx = dataset.findIndex(function (d) {
        return (
          d.curveId ===
          `${label}-${
            myDataIdx === 0
              ? matsTypes.ReservedWords.noSkill
              : matsTypes.ReservedWords.noSkillNoLabel
          }`
        );
      });
    }
    let update;
    let noSkillUpdate;
    if (dataset[myDataIdx].x.length > 0) {
      if (dataset[myDataIdx].visible !== "legendonly") {
        if (dataset[myDataIdx].mode === "lines") {
          // lines are visible, so make lines and points visible
          update = {
            mode: "lines+markers",
          };
          $(`#${id}`)[0].value = "hide points";
        } else if (dataset[myDataIdx].mode === "lines+markers") {
          // lines and points are visible, so make only lines visible
          update = {
            mode: "lines",
          };
          $(`#${id}`)[0].value = "show points";
        } else if (dataset[myDataIdx].mode === "markers") {
          // points are visible, so make nothing visible
          update = {
            visible: "legendonly",
          };
          if (plotType !== matsTypes.PlotTypes.simpleScatter) {
            update.mode = "lines";
          }
          $(`#${id}`)[0].value = "show points";
          if (plotType === matsTypes.PlotTypes.reliability) {
            noSkillUpdate = {
              visible: false,
            };
          }
        }
      } else {
        // nothing is visible, so make points visible
        update = {
          visible: true,
          mode: "markers",
        };
        $(`#${id}`)[0].value = "hide points";
        if (plotType === matsTypes.PlotTypes.reliability) {
          noSkillUpdate = {
            visible: true,
          };
        }
      }
    }
    Plotly.restyle($("#placeholder")[0], update, myDataIdx);
    if (plotType === matsTypes.PlotTypes.reliability && noSkillUpdate) {
      Plotly.restyle($("#placeholder")[0], noSkillUpdate, noSkillIdx);
    }

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, myDataIdx);
    if (plotType === matsTypes.PlotTypes.reliability) {
      saveUpdatesToJSON(noSkillUpdate, noSkillIdx);
    }
  },
  "click .errorBarVisibility"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const { id } = event.target;
    const label = id.replace("-curve-show-hide-errorbars", "");
    const myDataIdx = dataset.findIndex(function (d) {
      return d.curveId === label;
    });
    let update;
    if (dataset[myDataIdx].x.length > 0) {
      if (plotType !== matsTypes.PlotTypes.profile) {
        update = {
          "error_y.visible": dataset[myDataIdx].error_y.visible,
        };
        update["error_y.visible"] = !update["error_y.visible"];
        if (update["error_y.visible"]) {
          $(`#${id}`)[0].value = "hide error bars";
        } else {
          $(`#${id}`)[0].value = "show error bars";
        }
      } else {
        update = {
          "error_x.visible": dataset[myDataIdx].error_x.visible,
        };
        update["error_x.visible"] = !update["error_x.visible"];
        if (update["error_x.visible"]) {
          $(`#${id}`)[0].value = "hide error bars";
        } else {
          $(`#${id}`)[0].value = "show error bars";
        }
      }
    }
    Plotly.restyle($("#placeholder")[0], update, myDataIdx);

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, myDataIdx);
  },
  "click .barVisibility"(event) {
    event.preventDefault();
    const dataset = matsCurveUtils.getGraphResult().data;
    const { id } = event.target;
    const label = id.replace("-curve-show-hide-bars", "");
    const myDataIdx = dataset.findIndex(function (d) {
      return d.curveId === label;
    });
    let update;
    if (dataset[myDataIdx].x.length > 0) {
      if (dataset[myDataIdx].visible === "legendonly") {
        $(`#${id}`)[0].value = "hide bars";
        update = {
          visible: true,
        };
      } else {
        $(`#${id}`)[0].value = "show bars";
        update = {
          visible: "legendonly",
        };
      }
    }
    Plotly.restyle($("#placeholder")[0], update, myDataIdx);

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, myDataIdx);
  },
  "click .annotateVisibility"(event) {
    event.preventDefault();
    const { id } = event.target;
    const label = id.replace("-curve-show-hide-annotate", "");
    const legendContainer = $(`#legendContainer${label}`);
    if (legendContainer[0].hidden) {
      legendContainer[0].style.display = "block";
      $(`#${label}-curve-show-hide-annotate`)[0].value = "hide annotation";
      legendContainer[0].hidden = false;
    } else {
      legendContainer[0].style.display = "none";
      $(`#${label}-curve-show-hide-annotate`)[0].value = "show annotation";
      legendContainer[0].hidden = true;
    }
    annotation = $("#curves")[0].innerHTML;
  },
  "click .legendVisibility"(event) {
    event.preventDefault();
    const dataset = matsCurveUtils.getGraphResult().data;
    const { id } = event.target;
    const label = id.replace("-curve-show-hide-legend", "");
    const myDataIdx = dataset.findIndex(function (d) {
      return d.curveId === label;
    });
    let update;
    if (dataset[myDataIdx].x.length > 0) {
      update = {
        showlegend: !dataset[myDataIdx].showlegend,
      };
      if (update.showlegend) {
        $(`#${id}`)[0].value = "hide legend";
      } else {
        $(`#${id}`)[0].value = "show legend";
      }
    }
    Plotly.restyle($("#placeholder")[0], update, myDataIdx);

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, myDataIdx);
  },
  "click .heatMapVisibility"(event) {
    event.preventDefault();
    const { id } = event.target;
    const dataset = matsCurveUtils.getGraphResult().data;
    if (dataset[0].lat.length > 0) {
      let update;
      let didx;
      if (dataset[0].marker.opacity === 0) {
        update = {
          "marker.opacity": 1,
        };
        Plotly.restyle($("#placeholder")[0], update, 0);
        // save the updates in case we want to pass them to a pop-out window.
        curveOpsUpdate[0] = curveOpsUpdate[0] === undefined ? {} : curveOpsUpdate[0];
        curveOpsUpdate[0].marker____opacity = update["marker.opacity"];
        update = {
          visible: "legendonly",
        };
        for (didx = 1; didx < dataset.length; didx += 1) {
          Plotly.restyle($("#placeholder")[0], update, didx);
          // save the updates in case we want to pass them to a pop-out window.
          curveOpsUpdate[didx] =
            curveOpsUpdate[didx] === undefined ? {} : curveOpsUpdate[didx];
          curveOpsUpdate[didx].visible = update.visible;
        }
        $(`#${id}`)[0].value = "hide heat map";
      } else {
        update = {
          "marker.opacity": 0,
        };
        Plotly.restyle($("#placeholder")[0], update, 0);
        // save the updates in case we want to pass them to a pop-out window.
        curveOpsUpdate[0] = curveOpsUpdate[0] === undefined ? {} : curveOpsUpdate[0];
        curveOpsUpdate[0].marker____opacity = update["marker.opacity"];
        update = {
          visible: true,
        };
        for (didx = 1; didx < dataset.length; didx += 1) {
          Plotly.restyle($("#placeholder")[0], update, didx);
          // save the updates in case we want to pass them to a pop-out window.
          curveOpsUpdate[didx] =
            curveOpsUpdate[didx] === undefined ? {} : curveOpsUpdate[didx];
          curveOpsUpdate[didx].visible = update.visible;
        }
        $(`#${id}`)[0].value = "show heat map";
      }
    }
  },
  // add refresh button handler
  "click #refresh-plot"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    const options = Session.get("options");
    Session.set("thresholdEquiX", false);
    Session.set("axesCollapsed", false);
    let lastCurveIndex;
    let lineTypeResetOpts;
    let thisAnnotation;
    let annotationCurrentlyHidden;
    let localAnnotation;
    let barTypeResetOpts;
    let mapResetOpts;
    if (curveOpsUpdate.length === 0) {
      // we just need a relayout
      Plotly.relayout($("#placeholder")[0], options);
    } else {
      // we need both a relayout and a restyle
      curveOpsUpdate = [];
      switch (plotType) {
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
          // restyle for contour plots
          Plotly.restyle($("#placeholder")[0], Session.get("colorbarResetOpts"), 0);
          // deal with sig dots that some of the difference contours have
          lastCurveIndex = dataset.length - 1;
          if (
            dataset[lastCurveIndex].label === matsTypes.ReservedWords.contourSigLabel &&
            dataset[lastCurveIndex].x.length > 0
          ) {
            const sigDotReset = { "marker.color": "rgb(0,0,0)" };
            Plotly.restyle($("#placeholder")[0], sigDotReset, lastCurveIndex);
          }
          break;
        case matsTypes.PlotTypes.timeSeries:
        case matsTypes.PlotTypes.profile:
        case matsTypes.PlotTypes.dieoff:
        case matsTypes.PlotTypes.threshold:
        case matsTypes.PlotTypes.validtime:
        case matsTypes.PlotTypes.gridscale:
        case matsTypes.PlotTypes.dailyModelCycle:
        case matsTypes.PlotTypes.yearToYear:
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.gridscaleProb:
        case matsTypes.PlotTypes.simpleScatter:
          // restyle for line plots
          lineTypeResetOpts = Session.get("lineTypeResetOpts");
          for (let lidx = 0; lidx < lineTypeResetOpts.length; lidx += 1) {
            Plotly.restyle($("#placeholder")[0], lineTypeResetOpts[lidx], lidx);
            if (
              Object.values(matsTypes.ReservedWords).indexOf(dataset[lidx].label) ===
                -1 &&
              !dataset[lidx].label.includes(matsTypes.ReservedWords.noSkill)
            ) {
              $(`#${dataset[lidx].label}-curve-show-hide`)[0].value = "hide curve";
              $(`#${dataset[lidx].label}-curve-show-hide-points`)[0].value =
                "hide points";
              $(`#${dataset[lidx].label}-curve-show-hide-errorbars`)[0].value =
                "hide error bars";
              $(`#${dataset[lidx].label}-curve-show-hide-legend`)[0].value =
                "hide legend";

              // revert the annotation to the original colors
              // annotation color needs to be darkened for proper section 508 contrast compliance
              const darkerAnnotationColor = LightenDarkenColor.LightenDarkenColor(
                rgbHex(lineTypeResetOpts[lidx]["line.color"]),
                -75
              )
                .toString()
                .padStart(6, "0");

              switch (plotType) {
                case matsTypes.PlotTypes.timeSeries:
                case matsTypes.PlotTypes.profile:
                case matsTypes.PlotTypes.dieoff:
                case matsTypes.PlotTypes.threshold:
                case matsTypes.PlotTypes.validtime:
                case matsTypes.PlotTypes.gridscale:
                case matsTypes.PlotTypes.dailyModelCycle:
                case matsTypes.PlotTypes.yearToYear:
                case matsTypes.PlotTypes.scatter2d:
                case matsTypes.PlotTypes.map:
                  thisAnnotation = $(`#legendContainer${dataset[lidx].label}`);
                  annotationCurrentlyHidden = thisAnnotation[0].hidden;
                  localAnnotation = `<div id='${dataset[lidx].label}-annotation' style='color:#${darkerAnnotationColor}'>${dataset[lidx].annotation} </div>`;
                  thisAnnotation.empty().append(localAnnotation);
                  thisAnnotation[0].hidden = annotationCurrentlyHidden;
                  thisAnnotation[0].style.display = thisAnnotation[0].hidden
                    ? "none"
                    : "block";
                  annotation = $("#curves")[0].innerHTML;
                  break;
                case matsTypes.PlotTypes.reliability:
                case matsTypes.PlotTypes.roc:
                case matsTypes.PlotTypes.performanceDiagram:
                case matsTypes.PlotTypes.gridscaleProb:
                case matsTypes.PlotTypes.simpleScatter:
                case matsTypes.PlotTypes.histogram:
                case matsTypes.PlotTypes.ensembleHistogram:
                case matsTypes.PlotTypes.contour:
                case matsTypes.PlotTypes.contourDiff:
                default:
                  break;
              }
            }
          }
          break;
        case matsTypes.PlotTypes.histogram:
        case matsTypes.PlotTypes.ensembleHistogram:
          // restyle for bar plots
          barTypeResetOpts = Session.get("barTypeResetOpts");
          for (let bidx = 0; bidx < barTypeResetOpts.length; bidx += 1) {
            Plotly.restyle($("#placeholder")[0], barTypeResetOpts[bidx], bidx);
            if (
              Object.values(matsTypes.ReservedWords).indexOf(dataset[bidx].label) === -1
            ) {
              $(`#${dataset[bidx].label}-curve-show-hide-bars`)[0].value = "hide bars";
              $(`#${dataset[bidx].label}-curve-show-hide-legend`)[0].value =
                "hide legend";
            }
          }
          break;
        case matsTypes.PlotTypes.map:
          // restyle for maps
          mapResetOpts = Session.get("mapResetOpts");
          for (let midx = 0; midx < mapResetOpts.length; midx += 1) {
            Plotly.restyle($("#placeholder")[0], mapResetOpts[midx], midx);
          }
          $(`#${dataset[0].label}-curve-show-hide-heatmap`)[0].value = "show heat map";
          break;
        case matsTypes.PlotTypes.scatter2d:
        default:
          break;
      }
      Plotly.relayout($("#placeholder")[0], options);
    }
  },
  // add axis customization modal submit button
  "click #axisSubmit"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const axesCollapsed = Session.get("axesCollapsed");
    let changeYScaleBack = false;
    const newOpts = {};
    // get input axis limits and labels
    $("input[id^=x][id$=AxisLabel]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          if (!axesCollapsed || index === 0) {
            // if we've collapsed the axes we only want to process the first one
            newOpts[`xaxis${index === 0 ? "" : index + 1}.title.text`] = elem.value;
          }
        }
      });
    $("input[id^=x][id$=AxisFont]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          if (!axesCollapsed || index === 0) {
            // if we've collapsed the axes we only want to process the first one
            newOpts[`xaxis${index === 0 ? "" : index + 1}.title.font.size`] =
              elem.value;
          }
        }
      });
    if (
      plotType === matsTypes.PlotTypes.timeSeries ||
      plotType === matsTypes.PlotTypes.dailyModelCycle ||
      plotType === matsTypes.PlotTypes.yearToYear ||
      ((plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
        $("#placeholder")[0].layout.xaxis.title.text.indexOf("Date") > -1)
    ) {
      $("input[id^=x][id$=AxisMinText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.range[0]`] = elem.value;
            }
          }
        });
      $("input[id^=x][id$=AxisMaxText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.range[1]`] = elem.value;
            }
          }
        });
      $("input[id^=x][id$=TickFontText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.tickfont.size`] =
                elem.value;
            }
          }
        });
    } else {
      $("input[id^=x][id$=AxisMin]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.range[0]`] = elem.value;
            }
          }
        });
      $("input[id^=x][id$=AxisMax]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.range[1]`] = elem.value;
            }
          }
        });
      $("input[id^=x][id$=TickFont]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`xaxis${index === 0 ? "" : index + 1}.tickfont.size`] =
                elem.value;
            }
          }
        });
      $("input[id^=x][id$=SigFigs]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (!matsMethods.isThisANaN(elem.value)) {
                newOpts[
                  `xaxis${index === 0 ? "" : index + 1}.tickformat`
                ] = `.${elem.value.toString()}r`;
              }
            }
          }
        });
      $("input[id^=x][id$=TickInterval]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (!matsMethods.isThisANaN(elem.value)) {
                newOpts[`xaxis${index === 0 ? "" : index + 1}.dtick`] = Number(
                  elem.value
                );
              }
            }
          }
        });
    }
    $("input[id^=y][id$=AxisLabel]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          if (!axesCollapsed || index === 0) {
            // if we've collapsed the axes we only want to process the first one
            newOpts[`yaxis${index === 0 ? "" : index + 1}.title.text`] = elem.value;
          }
        }
      });
    $("input[id^=y][id$=AxisFont]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          if (!axesCollapsed || index === 0) {
            // if we've collapsed the axes we only want to process the first one
            newOpts[`yaxis${index === 0 ? "" : index + 1}.title.font.size`] =
              elem.value;
          }
        }
      });
    if (
      (plotType === matsTypes.PlotTypes.contour ||
        plotType === matsTypes.PlotTypes.contourDiff) &&
      $("#placeholder")[0].layout.yaxis.title.text.indexOf("Date") > -1
    ) {
      $("input[id^=y][id$=AxisMinText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            newOpts[`yaxis${index === 0 ? "" : index + 1}.range[0]`] = elem.value;
          }
        });
      $("input[id^=y][id$=AxisMaxText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            newOpts[`yaxis${index === 0 ? "" : index + 1}.range[1]`] = elem.value;
          }
        });
      $("input[id^=y][id$=TickFontText]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            newOpts[`yaxis${index === 0 ? "" : index + 1}.tickfont.size`] = elem.value;
          }
        });
    } else {
      $("input[id^=y][id$=AxisMin]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (plotType === matsTypes.PlotTypes.profile) {
                newOpts[`yaxis${index === 0 ? "" : index + 1}.range[1]`] = elem.value;
                // plotly can't seem to set axis limits on a log axis, so this needs to be changed to linear
                if (
                  $("#placeholder")[0].layout[`yaxis${index === 0 ? "" : index + 1}`]
                    .type === "log"
                ) {
                  $("#axisYScale").click();
                  changeYScaleBack = true;
                }
              } else {
                newOpts[`yaxis${index === 0 ? "" : index + 1}.range[0]`] = elem.value;
              }
            }
          }
        });
      $("input[id^=y][id$=AxisMax]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (plotType === matsTypes.PlotTypes.profile) {
                newOpts[`yaxis${index === 0 ? "" : index + 1}.range[0]`] = elem.value;
                // plotly can't seem to set axis limits on a log axis, so this needs to be changed to linear
                if (
                  $("#placeholder")[0].layout[`yaxis${index === 0 ? "" : index + 1}`]
                    .type === "log"
                ) {
                  $("#axisYScale").click();
                  changeYScaleBack = true;
                }
              } else {
                newOpts[`yaxis${index === 0 ? "" : index + 1}.range[1]`] = elem.value;
              }
            }
          }
        });
      $("input[id^=y][id$=TickFont]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              newOpts[`yaxis${index === 0 ? "" : index + 1}.tickfont.size`] =
                elem.value;
            }
          }
        });
      $("input[id^=y][id$=SigFigs]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (!matsMethods.isThisANaN(elem.value)) {
                newOpts[
                  `yaxis${index === 0 ? "" : index + 1}.tickformat`
                ] = `.${elem.value.toString()}r`;
              }
            }
          }
        });
      $("input[id^=y][id$=TickInterval]")
        .get()
        .forEach(function (elem, index) {
          if (elem.value !== undefined && elem.value !== "") {
            if (!axesCollapsed || index === 0) {
              // if we've collapsed the axes we only want to process the first one
              if (!matsMethods.isThisANaN(elem.value)) {
                newOpts[`yaxis${index === 0 ? "" : index + 1}.dtick`] = Number(
                  elem.value
                );
              }
            }
          }
        });
    }
    $("[id$=legendFontSize]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          newOpts["legend.font.size"] = elem.value;
        }
      });
    $("[id$=legendFontColor]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          newOpts["legend.font.color"] = elem.value;
        }
      });
    $("[id$=gridWeight]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          newOpts[`xaxis${index === 0 ? "" : index + 1}.gridwidth`] = elem.value;
          newOpts[`yaxis${index === 0 ? "" : index + 1}.gridwidth`] = elem.value;
        }
      });
    $("[id$=gridColor]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          newOpts[`xaxis${index === 0 ? "" : index + 1}.gridcolor`] = elem.value;
          newOpts[`yaxis${index === 0 ? "" : index + 1}.gridcolor`] = elem.value;
        }
      });
    Plotly.relayout($("#placeholder")[0], newOpts);
    // if needed, restore the log axis
    if (changeYScaleBack) {
      $("#axisYScale").click();
    }
    $("#axisLimitModal").modal("hide");
  },
  // add line style modal submit button
  "click #lineTypeSubmit"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    let thisAnnotation;
    let annotationCurrentlyHidden;
    let localAnnotation;
    const updates = [];
    // get input line style change
    $("[id$=LineColor]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];

          // annotation color needs to be darkened for proper section 508 contrast compliance
          const darkerAnnotationColor = LightenDarkenColor.LightenDarkenColor(
            elem.value,
            -75
          )
            .toString()
            .padStart(6, "0");

          switch (plotType) {
            case matsTypes.PlotTypes.timeSeries:
            case matsTypes.PlotTypes.profile:
            case matsTypes.PlotTypes.dieoff:
            case matsTypes.PlotTypes.threshold:
            case matsTypes.PlotTypes.validtime:
            case matsTypes.PlotTypes.gridscale:
            case matsTypes.PlotTypes.dailyModelCycle:
            case matsTypes.PlotTypes.yearToYear:
            case matsTypes.PlotTypes.reliability:
            case matsTypes.PlotTypes.roc:
            case matsTypes.PlotTypes.performanceDiagram:
            case matsTypes.PlotTypes.gridscaleProb:
              // options for line plots
              updates[index]["line.color"] = elem.value;
              updates[index]["marker.color"] = elem.value;
              if (
                dataset[index].error_x !== undefined &&
                dataset[index].error_x !== null &&
                dataset[index].error_x.color !== undefined
              ) {
                updates[index]["error_x.color"] = elem.value;
              }
              if (
                dataset[index].error_y !== undefined &&
                dataset[index].error_y !== null &&
                dataset[index].error_y.color !== undefined
              ) {
                updates[index]["error_y.color"] = elem.value;
              }

              // update the annotation with the new color
              thisAnnotation = $(`#legendContainer${dataset[index].curveId}`);
              annotationCurrentlyHidden = thisAnnotation[0].hidden;
              localAnnotation = `<div id='${dataset[index].curveId}-annotation' style='color:#${darkerAnnotationColor}'>${dataset[index].annotation} </div>`;
              thisAnnotation.empty().append(localAnnotation);
              thisAnnotation[0].hidden = annotationCurrentlyHidden;
              thisAnnotation[0].style.display = thisAnnotation[0].hidden
                ? "none"
                : "block";
              annotation = $("#curves")[0].innerHTML;
              break;
            case matsTypes.PlotTypes.histogram:
            case matsTypes.PlotTypes.ensembleHistogram:
            case matsTypes.PlotTypes.simpleScatter:
              // options for bar plots
              updates[index]["marker.color"] = elem.value;
              break;
            case matsTypes.PlotTypes.contour:
            case matsTypes.PlotTypes.contourDiff:
            case matsTypes.PlotTypes.map:
            case matsTypes.PlotTypes.scatter2d:
            default:
              break;
          }
        }
      });
    $("[id$=LineStyle]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];
          updates[index]["line.dash"] = elem.value;
        }
      });
    $("input[id$=LineWeight]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];
          updates[index]["line.width"] = elem.value;
        }
      });
    $("input[id$=ErrorWeight]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];
          if (plotType === matsTypes.PlotTypes.profile) {
            updates[index]["error_x.thickness"] = elem.value;
          } else {
            updates[index]["error_y.thickness"] = elem.value;
          }
        }
      });
    $("[id$=LineMarker]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];
          updates[index]["marker.symbol"] = elem.value;
        }
      });
    $("[id$=MarkerWeight]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = updates[index] === undefined ? {} : updates[index];
          updates[index]["marker.size"] = elem.value;
        }
      });
    for (let uidx = 0; uidx < updates.length; uidx += 1) {
      // apply new settings
      Plotly.restyle($("#placeholder")[0], updates[uidx], uidx);
    }

    // save the updates in case we want to pass them to a pop-out window.
    for (let uidx = 0; uidx < updates.length; uidx += 1) {
      saveUpdatesToJSON(updates[uidx], uidx);
    }
    $("#lineTypeModal").modal("hide");
  },
  // add show/hide modal submit button
  "click #showHideSubmit"(event) {
    event.preventDefault();
    const options = Session.get("options");
    const newOpts = {};
    $("input[id=showHideNOAADisclaimer]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem && elem.checked) {
          newOpts["title.text"] = options.title.text;
        } else {
          newOpts["title.text"] = "";
        }
      });
    Plotly.relayout($("#placeholder")[0], newOpts);
    $("#showHideModal").modal("hide");
  },
  // add legend text modal submit button
  "click #legendTextSubmit"(event) {
    event.preventDefault();
    const updates = [];
    // get input legend text change
    $("[id$=LegendText]")
      .get()
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          updates[index] = {};
          updates[index].name = elem.value;
        }
      });
    for (let uidx = 0; uidx < updates.length; uidx += 1) {
      // apply new settings
      Plotly.restyle($("#placeholder")[0], updates[uidx], uidx);
    }

    // save the updates in case we want to pass them to a pop-out window.
    for (let uidx = 0; uidx < updates.length; uidx += 1) {
      curveOpsUpdate[uidx] =
        curveOpsUpdate[uidx] === undefined ? {} : curveOpsUpdate[uidx];
      curveOpsUpdate[uidx].name = updates[uidx].name;
    }

    // get input legend position change
    const options = Session.get("options");
    const newOpts = {};
    const legendPosition = document.getElementById("legendPositionSelect").value;
    if (legendPosition === "TL") {
      newOpts["legend.x"] = 0;
      newOpts["legend.y"] = options.legend.y;
      newOpts["legend.xanchor"] = "left";
      newOpts["legend.yanchor"] = "top";
    } else if (legendPosition === "TR") {
      newOpts["legend.x"] = 1;
      newOpts["legend.y"] = options.legend.y;
      newOpts["legend.xanchor"] = "right";
      newOpts["legend.yanchor"] = "top";
    } else if (legendPosition === "BL") {
      newOpts["legend.x"] = 0;
      newOpts["legend.y"] = 0;
      newOpts["legend.xanchor"] = "left";
      newOpts["legend.yanchor"] = "bottom";
    } else {
      newOpts["legend.x"] = 1;
      newOpts["legend.y"] = 0;
      newOpts["legend.xanchor"] = "right";
      newOpts["legend.yanchor"] = "bottom";
    }
    Plotly.relayout($("#placeholder")[0], newOpts);

    $("#legendTextModal").modal("hide");
  },
  // add filter points modal submit button
  "click #filterPointsSubmit"(event) {
    event.preventDefault();
    const plotType = Session.get("plotType");
    const dataset = matsCurveUtils.getGraphResult().data;
    // reset previously deleted points
    const lineTypeResetOpts = Session.get("lineTypeResetOpts");
    let resetAttrs = {};
    for (let lidx = 0; lidx < lineTypeResetOpts.length; lidx += 1) {
      resetAttrs = {
        x: lineTypeResetOpts[lidx].x,
        y: lineTypeResetOpts[lidx].y,
        text: lineTypeResetOpts[lidx].text,
      };
      if (
        lineTypeResetOpts[lidx].error_x &&
        !Array.isArray(lineTypeResetOpts[lidx].error_x) &&
        typeof lineTypeResetOpts[lidx].error_x === "object" &&
        lineTypeResetOpts[lidx].error_x.array !== undefined
      ) {
        resetAttrs["error_x.array"] = [lineTypeResetOpts[lidx].error_x.array];
      }
      if (
        lineTypeResetOpts[lidx].error_y &&
        !Array.isArray(lineTypeResetOpts[lidx].error_y) &&
        typeof lineTypeResetOpts[lidx].error_y === "object" &&
        lineTypeResetOpts[lidx].error_y.array !== undefined
      ) {
        resetAttrs["error_y.array"] = [lineTypeResetOpts[lidx].error_y.array];
      }
      if (lineTypeResetOpts[lidx].binVals !== undefined) {
        resetAttrs.binVals = lineTypeResetOpts[lidx].binVals;
      } else if (lineTypeResetOpts[lidx].threshold_all !== undefined) {
        resetAttrs.threshold_all = lineTypeResetOpts[lidx].threshold_all;
      }
      // need to deal with different x values if this is a threshold plot and we've equi-spaced the x axis
      if (plotType === matsTypes.PlotTypes.threshold && Session.get("thresholdEquiX")) {
        resetAttrs.x = Session.get("equiX")[lidx];
        dataset[lidx].x = Session.get("equiX")[lidx];
        dataset[lidx].origX = Session.get("origX")[lidx];
      }
      Plotly.restyle($("#placeholder")[0], resetAttrs, lidx);
      resetAttrs = {};
    }
    // now remove this event's specified points
    const updates = [];
    // get input check box data
    $("[id$=filterPoint]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.checked === false) {
          const splitElemId = elem.id.split("---");
          const curveLabel = splitElemId[0];
          const indVal = splitElemId[1];
          for (let i = 0; i < dataset.length; i += 1) {
            if (dataset[i].label === curveLabel) {
              let j;
              let indArray;
              switch (plotType) {
                // line plots only
                case matsTypes.PlotTypes.profile:
                  j = matsMethods.isThisANaN(Number(indVal))
                    ? dataset[i].y.indexOf(indVal)
                    : dataset[i].y.indexOf(Number(indVal));
                  break;
                case matsTypes.PlotTypes.reliability:
                case matsTypes.PlotTypes.roc:
                case matsTypes.PlotTypes.performanceDiagram:
                case matsTypes.PlotTypes.simpleScatter:
                  indArray =
                    dataset[i].binVals !== undefined
                      ? dataset[i].binVals
                      : dataset[i].threshold_all;
                  j = matsMethods.isThisANaN(Number(indVal))
                    ? indArray.indexOf(indVal)
                    : indArray.indexOf(Number(indVal));
                  break;
                case matsTypes.PlotTypes.timeSeries:
                case matsTypes.PlotTypes.dieoff:
                case matsTypes.PlotTypes.validtime:
                case matsTypes.PlotTypes.gridscale:
                case matsTypes.PlotTypes.dailyModelCycle:
                case matsTypes.PlotTypes.yearToYear:
                case matsTypes.PlotTypes.gridscaleProb:
                  j = matsMethods.isThisANaN(Number(indVal))
                    ? dataset[i].x.indexOf(indVal)
                    : dataset[i].x.indexOf(Number(indVal));
                  break;
                case matsTypes.PlotTypes.threshold:
                  indArray = Session.get("thresholdEquiX")
                    ? dataset[i].origX
                    : dataset[i].x;
                  j = matsMethods.isThisANaN(Number(indVal))
                    ? indArray.indexOf(indVal)
                    : indArray.indexOf(Number(indVal));
                  break;
                default:
                  j = -1;
                  break;
              }
              if (j !== -1) {
                dataset[i].x.splice(j, 1);
                dataset[i].y.splice(j, 1);
                dataset[i].text.splice(j, 1);
                if (dataset[i].binVals !== undefined) {
                  dataset[i].binVals.splice(j, 1);
                } else if (dataset[i].threshold_all !== undefined) {
                  dataset[i].threshold_all.splice(j, 1);
                }
                if (dataset[i].origX !== undefined) {
                  dataset[i].origX.splice(j, 1);
                }
                if (
                  dataset[i].error_x &&
                  !Array.isArray(dataset[i].error_x) &&
                  typeof dataset[i].error_x === "object" &&
                  dataset[i].error_x.array !== undefined
                ) {
                  dataset[i].error_x.array.splice(j, 1);
                }
                if (
                  dataset[i].error_y &&
                  !Array.isArray(dataset[i].error_y) &&
                  typeof dataset[i].error_y === "object" &&
                  dataset[i].error_y.array !== undefined
                ) {
                  dataset[i].error_y.array.splice(j, 1);
                }
              }
              break;
            }
          }
        }
      });

    for (let i = 0; i < dataset.length; i += 1) {
      // extract relevant fields from dataset to update the plot
      updates[i] = {
        x: [dataset[i].x],
        y: [dataset[i].y],
        text: [dataset[i].text],
      };
      if (
        dataset[i].error_x &&
        !Array.isArray(dataset[i].error_x) &&
        typeof dataset[i].error_x === "object" &&
        dataset[i].error_x.array !== undefined
      ) {
        updates[i]["error_x.array"] = [dataset[i].error_x.array];
      }
      if (
        dataset[i].error_y &&
        !Array.isArray(dataset[i].error_y) &&
        typeof dataset[i].error_y === "object" &&
        dataset[i].error_y.array !== undefined
      ) {
        updates[i]["error_y.array"] = [dataset[i].error_y.array];
      }
      if (dataset[i].binVals !== undefined) {
        updates[i].binVals = [dataset[i].binVals];
      } else if (dataset[i].threshold_all !== undefined) {
        updates[i].threshold_all = [dataset[i].threshold_all];
      }
      // apply new settings
      Plotly.restyle($("#placeholder")[0], updates[i], i);

      // save the updates in case we want to pass them to a pop-out window.
      // curveOpsUpdate maintains a record of changes from all curve styling fields, not just this one.
      saveUpdatesToJSON(updates[i], i);
    }
    $("#filterPointsModal").modal("hide");
  },
  // add colorbar customization modal submit button
  "click #colorbarSubmit"(event) {
    event.preventDefault();
    const dataset = matsCurveUtils.getGraphResult().data;
    let update = {};
    // get new formatting
    $("input[id=colorbarLabel]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          update["colorbar.title.text"] = elem.value;
        }
      });
    $("input[id=colorbarMin]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          update.autocontour = false;
          update["contours.start"] = elem.value;
        }
      });
    $("input[id=colorbarMax]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          update.autocontour = false;
          update["contours.end"] = elem.value;
        }
      });
    $("input[id=colorbarNumber]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          update.autocontour = false;
          update.ncontours = elem.value; // sadly plotly regards this as a "less than or equal to" value, so we have to manually set contour size
          const isStartDefined = update["contours.start"] !== undefined;
          const isEndDefined = update["contours.end"] !== undefined;
          const startVal = isStartDefined
            ? update["contours.start"]
            : dataset[0].zmin + (dataset[0].zmax - dataset[0].zmin) / 16;
          const endVal = isEndDefined
            ? update["contours.end"]
            : dataset[0].zmax - (dataset[0].zmax - dataset[0].zmin) / 16;
          update["contours.size"] =
            (endVal - startVal) / (Number(update.ncontours) - 1);
        }
      });
    $("input[id=colorbarStep]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem.value !== undefined && elem.value !== "") {
          if (update.ncontours === undefined) {
            update.autocontour = false;
            update["contours.size"] = elem.value;
          }
        }
      });
    $("input[id=colorbarReverse]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem && elem.checked) {
          update.reversescale = true;
        } else {
          update.reversescale = false;
        }
      });
    $("input[id=nullSmooth]")
      .get()
      // eslint-disable-next-line no-unused-vars
      .forEach(function (elem, index) {
        if (elem && elem.checked) {
          update.connectgaps = true;
        } else {
          update.connectgaps = false;
        }
      });
    const thisElem = document.getElementById("colormapSelect");
    if (thisElem !== undefined && thisElem.value !== undefined) {
      update.colorscale = thisElem.value;
    }
    // apply new settings
    Plotly.restyle($("#placeholder")[0], update, 0);

    // save the updates in case we want to pass them to a pop-out window.
    saveUpdatesToJSON(update, 0);

    // deal with sig dots that some of the difference contours have
    const lastCurveIndex = dataset.length - 1;
    if (
      dataset[lastCurveIndex].label === matsTypes.ReservedWords.contourSigLabel &&
      dataset[lastCurveIndex].x.length > 0
    ) {
      $("[id$=sigDotColor]")
        .get()
        // eslint-disable-next-line no-unused-vars
        .forEach(function (elem, index) {
          update = {};
          if (elem.value !== undefined && elem.value !== "") {
            update["marker.color"] = elem.value;
          }
        });
      Plotly.restyle($("#placeholder")[0], update, lastCurveIndex);
    }

    // save the update in case we want to pass it to a pop-out window.
    curveOpsUpdate[lastCurveIndex] =
      curveOpsUpdate[lastCurveIndex] === undefined
        ? {}
        : curveOpsUpdate[lastCurveIndex];
    curveOpsUpdate[lastCurveIndex].marker____color = update["marker.color"];
    $("#colorbarModal").modal("hide");
  },
});
