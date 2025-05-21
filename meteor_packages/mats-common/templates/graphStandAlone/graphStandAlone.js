/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsCurveUtils,
  matsGraphUtils,
  matsMethods,
  matsTypes,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";
import { moment } from "meteor/momentjs:moment";
import "./graphStandAlone.html";

/* global Session, Plotly, $, setError */
/* eslint-disable no-console */

const { jsPDF: JsPDF } = require("jspdf");
const html2canvas = require("html2canvas");

let resizeOptions;

Template.graphStandAlone.onCreated(function () {
  // get the params for what this window will contain from the route
  console.log("graphStandAlone.onCreated");
  Session.set("route", FlowRouter.getRouteName());
  Session.set("graphFunction", FlowRouter.getParam("graphFunction"));
  Session.set("plotResultKey", FlowRouter.getParam("key"));
  Session.set("plotParameter", FlowRouter.getParam("matching"));
  Session.set("appName", FlowRouter.getParam("appName"));
});

Template.graphStandAlone.onRendered(function () {
  // the window resize event needs to also resize the graph
  $(window).resize(function () {
    const plotType = Session.get("plotType");
    document.getElementById("placeholder").style.width =
      matsGraphUtils.standAloneWidth(plotType);
    document.getElementById("placeholder").style.height =
      matsGraphUtils.standAloneHeight(plotType);
    const dataset = matsCurveUtils.getGraphResult().data;
    Plotly.newPlot($("#placeholder")[0], dataset, resizeOptions, { showLink: true });
  });
  document.getElementById("graph-container").style.backgroundColor = "white";
});

Template.graphStandAlone.helpers({
  /**
   * @return {string}
   * @return {string}
   */
  graphFunction() {
    // causes graph display routine to be processed
    const graphFunction = FlowRouter.getParam("graphFunction");
    const key = FlowRouter.getParam("key");
    matsMethods.getGraphDataByKey
      .callAsync({ resultKey: key })
      .then(function (ret) {
        matsCurveUtils.setGraphResult(ret.result);
        Session.set("plotResultKey", ret.key);
        Session.set("Curves", ret.result.basis.plotParams.curves);
        Session.set("graphFunction", graphFunction);
        Session.set("PlotResultsUpDated", new Date());
        Session.set("PlotParams", ret.result.basis.plotParams);
        const ptypes = Object.keys(ret.result.basis.plotParams.plotTypes);
        for (let i = 0; i < ptypes.length; i += 1) {
          if (ret.result.basis.plotParams.plotTypes[ptypes[i]] === true) {
            Session.set("plotType", ptypes[i]);
            break;
          }
        }
        matsGraphUtils.graphPlotly();
        const plotType = Session.get("plotType");
        const dataset = matsCurveUtils.getGraphResult().data;
        let { options } = matsCurveUtils.getGraphResult();
        if (dataset === undefined) {
          return false;
        }
        // make sure to capture the options (layout) from the old graph - which were stored in graph.js
        matsMethods.getLayout
          .callAsync({ resultKey: key })
          .then(function (r) {
            let mapLoadPause = 0;
            options = r.layout;
            if (plotType === matsTypes.PlotTypes.map) {
              options.mapbox.zoom = 2.75;
              mapLoadPause = 1000;
            }
            options.hovermode = false;
            resizeOptions = options;

            // initial plot
            $("#legendContainer").empty();
            $("#placeholder").empty();

            // need a slight delay for plotly to load
            setTimeout(function () {
              Plotly.newPlot($("#placeholder")[0], dataset, options, {
                showLink: false,
                displayModeBar: false,
              });
              // update changes to the curve ops -- need to pause if we're doing a map so the map can finish loading before we try to edit it
              setTimeout(function () {
                const updates = r.curveOpsUpdate.curveOpsUpdate;
                for (let uidx = 0; uidx < updates.length; uidx += 1) {
                  const curveOpsUpdate = {};
                  if (updates[uidx]) {
                    const updatedKeys = Object.keys(updates[uidx]);
                    for (let kidx = 0; kidx < updatedKeys.length; kidx += 1) {
                      const jsonHappyKey = updatedKeys[kidx];
                      // turn the json placeholder back into .
                      const updatedKey = jsonHappyKey.split("____").join(".");
                      curveOpsUpdate[updatedKey] = updates[uidx][jsonHappyKey];
                    }
                    Plotly.restyle($("#placeholder")[0], curveOpsUpdate, uidx);
                  }
                }
              }, mapLoadPause);
            }, 500);

            // append annotations
            $("#legendContainer").append(r.annotation);
            document.getElementById("gsaSpinner").style.display = "none";
            return null;
          })
          .catch(function (e) {
            setError(e);
            return false;
          });
        return null;
      })
      .catch(function (error) {
        matsCurveUtils.resetGraphResult();
        setError(error);
      });
  },
  graphFunctionDispay() {
    return "block";
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
  width() {
    const plotType = Session.get("plotType");
    return matsGraphUtils.standAloneWidth(plotType);
  },
  height() {
    const plotType = Session.get("plotType");
    return matsGraphUtils.standAloneHeight(plotType);
  },
  curves() {
    return Session.get("Curves");
  },
  plotName() {
    return Session.get("PlotParams").length === 0 ||
      Session.get("PlotParams").plotAction === undefined ||
      Session.get("plotType") === matsTypes.PlotTypes.map
      ? ""
      : Session.get("PlotParams").plotAction.toUpperCase();
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
          case matsTypes.PlotTypes.ensembleHistogram:
          case matsTypes.PlotTypes.simpleScatter:
            return `${plotType.replace(/([A-Z][a-z])/g, " $1").trim()}: ${format}`;
          case matsTypes.PlotTypes.map:
            return `Map ${p.dates} `;
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
  matsplotFilemname() {
    return `newplot-${moment(new Date()).format("DD-MM-YYYY-hh:mm:ss")}`;
  },
  spinnerUrl() {
    return `${
      document.location.href.split("preview")[0]
    }/packages/randyp_mats-common/public/img/spinner.gif`;
  },
});

Template.graphStandAlone.events({
  "click .exportpdf"() {
    $(".previewCurveButtons").each(function (i, obj) {
      // eslint-disable-next-line no-param-reassign
      obj.style.display = "none";
    });
    html2canvas(document.querySelector("#graph-container"), { scale: 3.0 }).then(
      (canvas) => {
        const h = 419.53;
        const w = 595.28;
        const filename = document.getElementById("exportFileName").value;
        const pdf = new JsPDF({
          orientation: "landscape",
          unit: "pt",
          format: [w, h],
        });
        pdf.addImage(canvas.toDataURL("image/jpeg"), "JPEG", 0, 0, w, h);
        pdf.save(filename);
        $(".previewCurveButtons").each(function (i, obj) {
          // eslint-disable-next-line no-param-reassign
          obj.style.display = "block";
        });
      }
    );
  },
  "click .exportpng"() {
    $(".previewCurveButtons").each(function (i, obj) {
      // eslint-disable-next-line no-param-reassign
      obj.style.display = "none";
    });
    function saveAs(uri, filename) {
      const link = document.createElement("a");
      if (typeof link.download === "string") {
        link.href = uri;
        link.download = filename;

        // Firefox requires the link to be in the body
        document.body.appendChild(link);

        // simulate click
        link.click();

        // remove the link when done
        document.body.removeChild(link);
      } else {
        window.open(uri);
      }
    }
    html2canvas(document.querySelector("#graph-container"), { scale: 3.0 }).then(
      (canvas) => {
        const filename = document.getElementById("exportFileName").value;
        saveAs(canvas.toDataURL(), `${filename}.png`);
        $(".previewCurveButtons").each(function (i, obj) {
          // eslint-disable-next-line no-param-reassign
          obj.style.display = "block";
        });
      }
    );
  },
});
