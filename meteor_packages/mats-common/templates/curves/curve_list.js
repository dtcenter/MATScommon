/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsTypes} from "meteor/randyp:mats-common";
import {matsCollections} from "meteor/randyp:mats-common";
import {matsMethods} from "meteor/randyp:mats-common";
import {matsCurveUtils} from 'meteor/randyp:mats-common';
import {matsPlotUtils} from 'meteor/randyp:mats-common';
import {matsParamUtils} from 'meteor/randyp:mats-common';

Template.curveList.helpers({
    displayPlotUnMatched: function() {
        // scatter plots can't match
        if (Session.get('plotType') === matsTypes.PlotTypes.scatter2d) {
            return "none";
        }
        // don't allow plotting when editing
        const mode = Session.get("editMode");
        if (mode === undefined || mode === "") {
            return "block";
        } else {
            return "none";
        }
    },
    displayPlotMatched: function() {
        // don't allow plotting when editing, or for ROC / single contour / reliability curves
        const mode = Session.get("editMode");
        const plotType = Session.get('plotType');
        if (mode === undefined || mode === "") {
            switch (plotType) {
                case matsTypes.PlotTypes.map:
                case matsTypes.PlotTypes.reliability:
                case matsTypes.PlotTypes.roc:
                case matsTypes.PlotTypes.performanceDiagram:
                case matsTypes.PlotTypes.simpleScatter:
                case matsTypes.PlotTypes.contour:
                case matsTypes.PlotTypes.scorecard:
                    // allow matching for non-metexpress ROCs and performance diagrams
                    if ((matsCollections.Settings.findOne({}) !== undefined
                        && matsCollections.Settings.findOne({}).appType !== undefined
                        && matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress)
                        || (plotType !== matsTypes.PlotTypes.performanceDiagram
                            && plotType !== matsTypes.PlotTypes.roc)) {
                        return "none";
                    } else {
                        return "block";
                    }
                case matsTypes.PlotTypes.timeSeries:
                case matsTypes.PlotTypes.profile:
                case matsTypes.PlotTypes.dieoff:
                case matsTypes.PlotTypes.threshold:
                case matsTypes.PlotTypes.validtime:
                case matsTypes.PlotTypes.gridscale:
                case matsTypes.PlotTypes.dailyModelCycle:
                case matsTypes.PlotTypes.yearToYear:
                case matsTypes.PlotTypes.histogram:
                case matsTypes.PlotTypes.ensembleHistogram:
                case matsTypes.PlotTypes.contourDiff:
                case matsTypes.PlotTypes.scatter2d:
                default:
                    return "block";
            }
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
    metarMismatchHidden: function () {
        const appName = matsCollections.Settings.findOne({}).appName;
        var curves = Session.get('Curves');
        if (curves === undefined || curves.length === 0 || (appName !== "surface")) {
            return "none";
        }
        var i;
        var truth;
        var otherTruth;
        for (i = 0; i < curves.length; i++) {
            if (curves[i]["region-type"] === "Predefined region") {
                truth = curves[i].truth;
                break;
            } else {
                truth = 'METAR';
            }
        }
        for (i = 0; i < curves.length; i++) {
            if (curves[i]["region-type"] === "Predefined region") {
                otherTruth = curves[i].truth;
            } else {
                otherTruth = 'METAR';
            }
            if (truth !== otherTruth) {
                return "block";
            }
        }
        return "none"
    },
    editMode: function() {
        if (Session.get('editMode') === '') {
            return '';
        } else {
            return "Changing " + Session.get('editMode');
        }
    },
    matchedLabel: function() {
        if (Session.get('matchName'  === undefined)) {
            if (setMatchName) {
                setMatchName();
            } else {
                Session.set('matchName','plot matched');
            }
        } else {
            Session.set('matchName','plot matched');
        }
        return Session.get('matchName');
    }
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
    matsMethods.getGraphData.call({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
    */

Template.curveList.events({
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
    'click .plot-curves-unmatched': function (event) {
        document.getElementById("spinner").style.display = "block";
        matsPlotUtils.disableActionButtons();
        event.preventDefault();
        // trigger the submit on the plot_list plot_list.js - click .submit-params
        Session.set('plotParameter', matsTypes.PlotActions.unmatched);
        document.getElementById("plot-curves").click();
        return false;
    },
    'click .plot-curves-matched': function (event) {
        document.getElementById("spinner").style.display = "block";
        matsPlotUtils.disableActionButtons();
        event.preventDefault();
        // trigger the submit on the plot_list plot_list.js - click .submit-params
        Session.set('plotParameter', matsTypes.PlotActions.matched);
        document.getElementById("plot-curves").click();
        return false;
    },
    'click .no-gaps-check': function (event) {
        // make the Interpolate Over Nulls option on the colorbar modal match up with this.
        if (document.getElementById("nullSmooth")) {
            if (document.getElementById("noGapsCheck").checked) {
                document.getElementById("nullSmooth").checked = true;
            } else {
                document.getElementById("nullSmooth").checked = false;
            }
        }
    },
    'click .save-settings': function (event) {
        event.preventDefault();
        document.getElementById("save-settings").click();
        return false;
    }
});