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
    }
});

Template.ScorecardHome.events({
    'change #date-range-custom-relative-radioGroup-relative'(event) {
        if (document.getElementById('date-range-custom-relative-radioGroup-relative').checked === true) {
            document.getElementById("date-range-item").style.display = "none";
            document.getElementById("relative-date-range-value-item").style.display = "block";
            document.getElementById("relative-date-range-type-item").style.display = "block";
            document.getElementById("relative-date-range-type-item").value = "hours";
            document.getElementById("cron-hour-item").style.display = "block";
            document.getElementById("cron-day-item").style.display = "block";
            document.getElementById("cron-day-of-month-item").style.display = "block";
            document.getElementById("cron-month-item").style.display = "block";
            document.getElementById("cron-year-item").style.display = "block";
        } else {
            document.getElementById("date-range-item").style.display = "block";
            document.getElementById("relative-date-range-value-item").style.display = "none";
            document.getElementById("relative-date-range-type-item").style.display = "none";
            document.getElementById("cron-hour-item").style.display = "none";
            document.getElementById("cron-day-item").style.display = "none";
            document.getElementById("cron-day-of-month-item").style.display = "none";
            document.getElementById("cron-month-item").style.display = "none";
            document.getElementById("cron-year-item").style.display = "none";
        }
    },
    'change #date-range-custom-relative-radioGroup-custom'(event) {
        if (document.getElementById('date-range-custom-relative-radioGroup-custom').checked === true) {
            document.getElementById("date-range-item").style.display = "block";
            document.getElementById("relative-date-range-value-item").style.display = "none";
            document.getElementById("relative-date-range-type-item").style.display = "none";
            document.getElementById("cron-hour-item").style.display = "none";
            document.getElementById("cron-day-item").style.display = "none";
            document.getElementById("cron-day-of-month-item").style.display = "none";
            document.getElementById("cron-month-item").style.display = "none";
            document.getElementById("cron-year-item").style.display = "none";
        } else {
            document.getElementById("date-range-item").style.display = "none";
            document.getElementById("relative-date-range-value-item").style.display = "block";
            document.getElementById("relative-date-range-type-item").style.display = "block";
            matsParamUtils.setInputForParamName("relative-type-item","hours");

            document.getElementById("cron-hour-item").style.display = "block";
            document.getElementById("cron-day-item").style.display = "block";
            document.getElementById("cron-day-of-month-item").style.display = "block";
            document.getElementById("cron-month-item").style.display = "block";
            document.getElementById("cron-year-item").style.display = "block";
        }
    }
});