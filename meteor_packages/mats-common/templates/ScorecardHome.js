/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsCollections} from 'meteor/randyp:mats-common';
import {matsParamUtils} from 'meteor/randyp:mats-common';
import {matsMethods} from 'meteor/randyp:mats-common';

Template.ScorecardHome.onCreated(function() {
    this.subscribe("matsPlotUtils").ready();
    this.subscribe("matsTypes").ready();
    this.subscribe("matsCollections").ready();
    this.subscribe("matsCurveUtils").ready();
    this.subscribe("matsParamUtils").ready();
    this.subscribe("plotType").ready();
});

Template.ScorecardHome.helpers({
    isUnderConstruction: function () {
        return matsCollections['underConstruction'] !== undefined && matsCollections['underConstruction'].findOne({name:'underConstruction'}) !== undefined;
    },
    resetDefaults: function() {
        matsMethods.refreshMetaData.call({}, function (error, result) {
            if (error !== undefined) {
                setError(new Error(error.message));
            }
            matsParamUtils.setAllParamsToDefault();
        });
    },
    hideForScorecard: function() {
        if (matsCollections.Settings === undefined || matsCollections.Settings.findOne({}) === undefined) return "hidden";
        const isScorecard = matsCollections.Settings.findOne({}).scorecard;
        if (isScorecard === undefined || isScorecard === "") {
            return "";
        } else {
            return "hidden";
        }
    }
});
