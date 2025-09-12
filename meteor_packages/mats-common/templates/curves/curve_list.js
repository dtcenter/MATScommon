/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsPlotUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $ */
/* eslint-disable no-console */

Template.curveList.helpers({
  displayPlotUnMatched() {
    // don't allow plotting when editing
    const mode = Session.get("editMode");
    if (mode === undefined || mode === "") {
      return "block";
    }
    return "none";
  },
  displayPlotMatched() {
    // don't allow plotting when editing, or for plot types without matching
    const mode = Session.get("editMode");
    const plotType = Session.get("plotType");
    if (mode === undefined || mode === "") {
      switch (plotType) {
        case matsTypes.PlotTypes.map:
        case matsTypes.PlotTypes.reliability:
        case matsTypes.PlotTypes.roc:
        case matsTypes.PlotTypes.performanceDiagram:
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.scorecard:
          // allow matching for non-metexpress Reliabilities, ROCs, and performance diagrams
          if (
            (matsCollections.Settings.findOne({}) !== undefined &&
              matsCollections.Settings.findOne({}).appType !== undefined &&
              matsCollections.Settings.findOne({}).appType ===
                matsTypes.AppTypes.metexpress) ||
            (plotType !== matsTypes.PlotTypes.performanceDiagram &&
              plotType !== matsTypes.PlotTypes.roc &&
              plotType !== matsTypes.PlotTypes.reliability)
          ) {
            return "none";
          }
          return "block";

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
        case matsTypes.PlotTypes.contourDiff:
        case matsTypes.PlotTypes.simpleScatter:
        default:
          return "block";
      }
    } else {
      return "none";
    }
  },
  displaySaveSettings() {
    // don't allow saving settings when editing
    const mode = Session.get("editMode");
    if (mode === undefined || mode === "") {
      return "block";
    }
    return "none";
  },
  curves() {
    return Session.get("Curves");
  },
  displayCurves() {
    if (Session.get("Curves") === undefined || Session.get("Curves").length === 0) {
      return "none";
    }
    return "block";
  },
  log() {
    console.log(this);
  },
  metarMismatchHidden() {
    const { appName } = matsCollections.Settings.findOne({});
    const curves = Session.get("Curves");
    if (curves === undefined || curves.length === 0 || appName !== "surface") {
      return "none";
    }
    let i;
    let truth;
    let otherTruth;
    for (i = 0; i < curves.length; i += 1) {
      if (curves[i]["region-type"] === "Predefined region") {
        truth = curves[i].truth;
        break;
      } else {
        truth = "METAR";
      }
    }
    for (i = 0; i < curves.length; i += 1) {
      if (curves[i]["region-type"] === "Predefined region") {
        otherTruth = curves[i].truth;
      } else {
        otherTruth = "METAR";
      }
      if (truth !== otherTruth) {
        return "block";
      }
    }
    return "none";
  },
  editMode() {
    if (Session.get("editMode") === "") {
      return "";
    }
    return `Changing ${Session.get("editMode")}`;
  },
  matchedLabel() {
    if (Session.get(undefined === "matchName")) {
      Session.set("matchName", "plot matched");
    } else {
      Session.set("matchName", "plot matched");
    }
    return Session.get("matchName");
  },
});

/*
    A note about how things get to the backend, and then to the graph or display view.
    When the user clicks "plot or plot matched" on the curve-list page
    there is a spinner displayed and a plotParameter set, and then dynamically clicks
    the "plot-curves" button in the plot-form in plot_list.html, which is a submit button,
    that triggers the event for the class 'submit-params' in plot_list.js.
    The submit-params handler in plot_list.js is BADLY IN NEED OF REFACTORING, it has a complexity
    rating of "Complexity is 131 Bloody hell..." - RTP MATS issue .
    It transforms all the params into a plotParms document and puts that into the session, then
    uses a switch on 'action' which is the event.currentTarget.name "save|restore|plot" which are
    the names of type="submit" buttons in the form, like name="plot" or name="save".
    In the type="submit" and name-"plot" case of the switch this call...
    matsMethods.getGraphData.callAsync({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
    */

Template.curveList.events({
  "click .remove-all"() {
    if (Session.get("confirmRemoveAll")) {
      matsCurveUtils.clearAllUsed();
      matsParamUtils.setAllParamsToDefault();
      Session.set("editMode", "");
      Session.set("paramWellColor", "#f5f5f5"); // default grey
      Session.set("lastUpdate", Date.now());
      Session.set("confirmRemoveAll", "");
    }
    if (Session.get("Curves").length > 0) {
      $("#removeAllModal").modal("show");
    }
  },
  "click .confirm-remove-all"() {
    Session.set("confirmRemoveAll", Date.now());
    $("#remove-all").trigger("click");
  },
  "click .plot-curves-unmatched"(event) {
    document.getElementById("spinner").style.display = "block";
    matsPlotUtils.disableActionButtons();
    event.preventDefault();
    // trigger the submit on the plot_list plot_list.js - click .submit-params
    Session.set("plotParameter", matsTypes.PlotActions.unmatched);
    document.getElementById("plot-curves").click();
    return false;
  },
  "click .plot-curves-matched"(event) {
    document.getElementById("spinner").style.display = "block";
    matsPlotUtils.disableActionButtons();
    event.preventDefault();
    // trigger the submit on the plot_list plot_list.js - click .submit-params
    Session.set("plotParameter", matsTypes.PlotActions.matched);
    document.getElementById("plot-curves").click();
    return false;
  },
  "click .no-gaps-check"() {
    // make the Interpolate Over Nulls option on the colorbar modal match up with this.
    if (document.getElementById("nullSmooth")) {
      if (document.getElementById("noGapsCheck").checked) {
        document.getElementById("nullSmooth").checked = true;
      } else {
        document.getElementById("nullSmooth").checked = false;
      }
    }
  },
  "click .save-settings"(event) {
    event.preventDefault();
    document.getElementById("save-settings").click();
    return false;
  },
});
