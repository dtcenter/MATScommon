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
    'change #scorecard-schedule-mode-radioGroup-recurring'(event) {
        if (document.getElementById('scorecard-schedule-mode-radioGroup-recurring').checked === true) {
            document.getElementById("one-time-data-range-item").style.display = "none";
            document.getElementById("scorecard-recurrence-interval-item").style.display = "block";
            document.getElementById("scorecard-recurrence-interval-radioGroup-weekly").checked = true;
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "block";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
        } else {
            document.getElementById("one-time-data-range-item").style.display = "block";
            document.getElementById("scorecard-recurrence-interval-item").style.display = "none";
            document.getElementById("these-hours-of-the-day-item").style.display = "none";
            document.getElementById("these-days-of-the-week-item").style.display = "none";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
            document.getElementById("these-years-item").style.display = "none";
        }
    },
    'change #scorecard-schedule-mode-radioGroup-once'(event) {
        if (document.getElementById('scorecard-schedule-mode-radioGroup-once').checked === true) {
            document.getElementById("one-time-data-range-item").style.display = "block";
            document.getElementById("scorecard-recurrence-interval-item").style.display = "none";
            document.getElementById("these-hours-of-the-day-item").style.display = "none";
            document.getElementById("these-days-of-the-week-item").style.display = "none";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
            document.getElementById("these-years-item").style.display = "none";
        } else {
            document.getElementById("one-time-data-range-item").style.display = "none";
            matsParamUtils.setInputForParamName("relative-type-item", "hours");
            document.getElementById("scorecard-recurrence-interval-item").style.display = "block";
            document.getElementById("scorecard-recurrence-interval-radioGroup-weekly").checked = true;
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "block";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
        }
    },
    'change #scorecard-recurrence-interval-item'(event) {
        if (document.getElementById("scorecard-recurrence-interval-radioGroup-daily").checked) {
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "none";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
        }
        if (document.getElementById("scorecard-recurrence-interval-radioGroup-weekly").checked) {
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "block";
            document.getElementById("these-days-of-the-month-item").style.display = "none";
            document.getElementById("these-months-item").style.display = "none";
        }
        if (document.getElementById("scorecard-recurrence-interval-radioGroup-monthly").checked) {
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "none";
            document.getElementById("these-days-of-the-month-item").style.display = "block";
            document.getElementById("these-months-item").style.display = "none";
        }
        if (document.getElementById("scorecard-recurrence-interval-radioGroup-yearly").checked) {
            document.getElementById("these-hours-of-the-day-item").style.display = "block";
            document.getElementById("these-days-of-the-week-item").style.display = "none";
            document.getElementById("these-days-of-the-month-item").style.display = "block";
            document.getElementById("these-months-item").style.display = "block";
        }
    },
    'click #controlButton-scorecard-ends-on-value' (event) {
            if (datepicker === undefined) {
            today=new Date();
            datepicker = new Datepicker(
                document.getElementById('scorecard-ends-on-textInput'),
                {
                    buttonClass: 'btn',
                    autohide: true,
                    defaultViewDate:today,
                    minDate:today,
                });
        }
    }
});