/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsTypes} from "meteor/randyp:mats-common";
import {matsCollections} from "meteor/randyp:mats-common";
import {matsMethods} from "meteor/randyp:mats-common";
import {matsCurveUtils} from 'meteor/randyp:mats-common';
import {matsPlotUtils} from 'meteor/randyp:mats-common';
import {matsParamUtils} from 'meteor/randyp:mats-common';

Template.scorecardCurveList.helpers({
    displayScorecardStatus: function() {
        // don't allow plotting when editing
        const mode = Session.get("editMode");
        if (mode === undefined || mode === "") {
            return "block";
        } else {
            return "none";
        }
    },
    displaySaveSettings: function() {
        // don't allow saving settings when editing
        const mode = Session.get("editMode");
        if (mode === undefined || mode === "") {
            return "block";
        } else {
            return "none";
        }
    },

    curves: function () {
        return Session.get('Curves');
    },
    displayCurves: function () {
        if (Session.get('Curves') === undefined || Session.get('Curves').length === 0) {
            return "none";
        } else {
            return "block";
        }
    },
    log: function () {
        console.log(this);
    },
    editMode: function() {
        if (Session.get('editMode') === '') {
            return '';
        } else {
            return "Changing " + Session.get('editMode');
        }
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
    matsMethods.getGraphData.call({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
    */
Template.scorecardCurveList.events({
    'click .remove-all': function () {
        if (Session.get("confirmRemoveAll")) {
            matsCurveUtils.clearAllUsed();
            matsParamUtils.setAllParamsToDefault();
            Session.set("editMode", "");
            Session.set("paramWellColor", "#f5f5f5");  // default grey
            Session.set("lastUpdate", Date.now());
            Session.set("confirmRemoveAll","");
            return false;
        } else {
            if (Session.get("Curves").length > 0 ) {
                $("#modal-confirm-remove-all").modal();
            }
        }
    },
    'click .confirm-remove-all': function () {
        Session.set("confirmRemoveAll", Date.now());
        $("#remove-all").trigger('click');
    },
    'click .submitScorecard': function (event) {
        document.getElementById("spinner").style.display = "block";
        matsPlotUtils.disableActionButtons();
        event.preventDefault();
        // trigger the submit-params event (plot-curves) on plot_list.js - click plot-curves
        Session.set('plotParameter', matsTypes.PlotActions.scorecard);
        document.getElementById("plot-curves").click();
        return false;
    },
    'click .save-settings': function (event) {
        event.preventDefault();
        document.getElementById("save-settings").click();
        return false;
    }
});