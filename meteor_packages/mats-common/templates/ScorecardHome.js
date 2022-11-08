/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
    matsCollections
} from 'meteor/randyp:mats-common';
import {
    matsParamUtils
} from 'meteor/randyp:mats-common';
import {
    matsMethods
} from 'meteor/randyp:mats-common';

import {
    Datepicker
} from 'vanillajs-datepicker';

let datepicker;

Template.ScorecardHome.onCreated(function () {
    this.subscribe("matsPlotUtils").ready();
    this.subscribe("matsTypes").ready();
    this.subscribe("matsCollections").ready();
    this.subscribe("matsCurveUtils").ready();
    this.subscribe("matsParamUtils").ready();
    this.subscribe("plotType").ready();
});

Template.ScorecardHome.helpers({
    isUnderConstruction: function () {
        return matsCollections['underConstruction'] !== undefined && matsCollections['underConstruction'].findOne({
            name: 'underConstruction'
        }) !== undefined;
    },
    resetDefaults: function () {
        matsMethods.refreshMetaData.call({}, function (error, result) {
            if (error !== undefined) {
                setError(new Error(error.message));
            }
            matsParamUtils.setAllParamsToDefault();
        });
    },
    title: function () {
        if (matsCollections.Settings === undefined || matsCollections.Settings.findOne({}, {
                fields: {
                    Title: 1
                }
            }) === undefined) {
            return "";
        } else {
            return matsCollections.Settings.findOne({}, {
                fields: {
                    Title: 1
                }
            }).Title;
        }
    },
});

Template.ScorecardHome.events({
    'click #controlButton-scorecard-ends-on-value'(event) {
        today = new Date();
        if (datepicker === undefined) {
            // declared at top of file - lazy instantiation
            datepicker = new Datepicker(
                document.getElementById('scorecard-ends-on-textInput'), {
                    buttonClass: 'btn',
                    autohide: true,
                    defaultViewDate: today,
                    minDate: today,
                    container: "controlButton-scorecard-ends-on-value",
                    orientation: 'top',
                    title: "Scorecard ends on",
                });
        }
        datepicker.setDate(today);
        datepicker.refresh();
        datepicker.show();
    },
    'click #display-status'(event){
        matsGraphUtils.setScorecardDisplayView('displayScorecardStatusPage');
    },
    'change #scorecard-schedule-mode-radioGroup-recurring'(event) {
        // this event is only fired when 'recurring' is selected
        // firing off a blur event will cause the hideForOthers stuff in radiogroup.js to happen
        const defaultOption = matsParamUtils.getParameterForName('scorecard-recurrence-interval').default;
        let elem = document.getElementById('scorecard-recurrence-interval-radioGroup-' + defaultOption);
        elem.dispatchEvent(new Event("blur"));
    },
    'change #scorecard-color-theme-radioGroup-RedGreen'(event) {
        document.querySelector('[name="major-truth-color-icon"]').style.color="#ff0000";
        document.querySelector('[name="minor-truth-color-icon"]').style.color="#ff0000";
        document.querySelector('[name="major-source-color-icon"]').style.color="#00ff00";
        document.querySelector('[name="minor-source-color-icon"]').style.color="#00ff00";
    },
    'change #scorecard-color-theme-radioGroup-RedBlue'(event) {
        document.querySelector('[name="major-truth-color-icon"]').style.color="#ff0000";
        document.querySelector('[name="minor-truth-color-icon"]').style.color="#ff0000";
        document.querySelector('[name="major-source-color-icon"]').style.color="#0000ff";
        document.querySelector('[name="minor-source-color-icon"]').style.color="#0000ff";
    },
});