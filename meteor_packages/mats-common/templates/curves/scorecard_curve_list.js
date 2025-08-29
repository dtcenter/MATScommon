/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCurveUtils,
  matsPlotUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $ */
/* eslint-disable no-console */

Template.scorecardCurveList.helpers({
  displayScorecardStatus() {
    // don't allow plotting when editing
    const mode = Session.get("editMode");
    if (mode === undefined || mode === "") {
      return "block";
    }
    return "none";
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
  editMode() {
    if (Session.get("editMode") === "") {
      return "";
    }
    return `Changing ${Session.get("editMode")}`;
  },
});

/*
    A note about how things get to the backend, and then to the graph or display view.
    When the user clicks "Submit Scorecard" on the curve-list page
    there is a spinner displayed and a plotParameter set, and then
    the "plot-curves" button in the plot-form in plot_list.html which is a submit button
    which triggers the event for the class 'submit-params' in plot_list.js.
    the submit-params handler in plot_list.js is BADLY IN NEED OF REFACTORING, it has a complexity
    rating of "Complexity is 131 Bloody hell..." - see MATS github issue #810 -RTP.
    The submit handler transforms all the params into a plotParms document and puts it into the session, then
    uses a switch on 'action' which is the event.currentTarget.name "save|restore|plot" which are
    the names of type="submit" buttons in the form, like name="plot" or name="save".
    In the type="submit" and name-"plot" case of the switch this call...
    matsMethods.getGraphData.callAsync({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
    */

Template.scorecardCurveList.events({
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
  "click .submitScorecard"(event) {
    document.getElementById("spinner").style.display = "block";
    matsPlotUtils.disableActionButtons();
    event.preventDefault();
    // trigger the submit-params event (plot-curves) on plot_list.js - click plot-curves
    Session.set("plotParameter", matsTypes.PlotActions.scorecard);
    document.getElementById("plot-curves").click();
    return false;
  },
});
