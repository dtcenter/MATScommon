/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {matsTypes} from 'meteor/randyp:mats-common';
import {matsCollections} from 'meteor/randyp:mats-common';
import {matsCurveUtils} from 'meteor/randyp:mats-common';
import {matsParamUtils} from 'meteor/randyp:mats-common';


Template.plotType.helpers({
    plotTypes: function () {
        return matsCollections.PlotGraphFunctions.find({}).fetch();
    },
    title: function () {
        if (matsCollections.Settings === undefined || matsCollections.Settings.findOne({}, {fields: {Title: 1}}) === undefined) {
            return "";
        } else {
            return matsCollections.Settings.findOne({}, {fields: {Title: 1}}).Title;
        }
    },
    display: function () {    // don't display the choice if there is only one choice
        if (matsCollections.PlotGraphFunctions.find({}).fetch().length === 1) {
            return "hidden";
        } else {
            return "";
        }
    }
});

const matchPlotTypeSelector = function (plotType) {
    // used in met apps to only display the options appropriate to a particular plot type in each selector
    if (matsCollections['plot-type'] !== undefined && matsCollections['plot-type'].findOne({name: 'plot-type'}) !== undefined) {
        const currentDatabase = matsParamUtils.getValueForParamName('database');
        const currentDataSource = matsParamUtils.getValueForParamName('data-source');
        if (matsCollections['plot-type'].findOne({name: 'plot-type'}).optionsMap[currentDatabase][currentDataSource].indexOf(plotType) !== -1) {
            matsParamUtils.setInputValueForParamAndTriggerChange('plot-type', plotType);
        } else {
            setInfo(('INFO:  Plot type ' + plotType + ' is not available for the database/model combination ' + currentDatabase + ' and ' + currentDataSource + '.'));
        }
    }
};

const setDatesAndShowFace = function (plotType, dateSelector) {
    // display appropriate selectors for each plot type, and make sure the previous dates or curve-dates values
    // carry across to the appropriate new selector
    const appName = matsCollections.appName.findOne({}).app;
    var oldDatesExist;
    if (dateSelector === 'dates') {
        oldDatesExist = matsParamUtils.isParamVisible('dates');
    } else if (dateSelector === 'curve-dates') {
        oldDatesExist = matsParamUtils.isParamVisible('curve-dates');
    }
    var selectorsToReset = {};
    switch (plotType) {
        case matsTypes.PlotTypes.timeSeries:
            selectorsToReset = matsCurveUtils.showTimeseriesFace();
            break;
        case matsTypes.PlotTypes.profile:
            selectorsToReset = matsCurveUtils.showProfileFace();
            break;
        case matsTypes.PlotTypes.dieoff:
            selectorsToReset = matsCurveUtils.showDieOffFace();
            break;
        case matsTypes.PlotTypes.threshold:
            selectorsToReset = matsCurveUtils.showThresholdFace();
            break;
        case matsTypes.PlotTypes.validtime:
            selectorsToReset = matsCurveUtils.showValidTimeFace();
            break;
        case matsTypes.PlotTypes.gridscale:
            selectorsToReset = matsCurveUtils.showGridScaleFace();
            break;
        case matsTypes.PlotTypes.dailyModelCycle:
            selectorsToReset = matsCurveUtils.showDailyModelCycleFace();
            break;
        case matsTypes.PlotTypes.yearToYear:
            selectorsToReset = matsCurveUtils.showYearToYearFace();
            break;
        case matsTypes.PlotTypes.reliability:
            selectorsToReset = matsCurveUtils.showReliabilityFace();
            break;
        case matsTypes.PlotTypes.roc:
            selectorsToReset = matsCurveUtils.showROCFace();
            break;
        case matsTypes.PlotTypes.performanceDiagram:
            selectorsToReset = matsCurveUtils.showPerformanceDiagramFace();
            break;
        case matsTypes.PlotTypes.map:
            selectorsToReset = matsCurveUtils.showMapFace();
            break;
        case matsTypes.PlotTypes.histogram:
            selectorsToReset = matsCurveUtils.showHistogramFace();
            break;
        case matsTypes.PlotTypes.ensembleHistogram:
            selectorsToReset = matsCurveUtils.showEnsembleHistogramFace();
            break;
        case matsTypes.PlotTypes.contour:
        case matsTypes.PlotTypes.contourDiff:
            selectorsToReset = matsCurveUtils.showContourFace();
            break;
        case matsTypes.PlotTypes.scatter2d:
            selectorsToReset = matsCurveUtils.showScatterFace();
            break;
    }
    if (dateSelector === 'dates') {
        if (!oldDatesExist) {
            const curveDate = $('#controlButton-curve-dates-value').text();
            matsParamUtils.setValueTextForParamName('dates', curveDate);
            return [curveDate, selectorsToReset];
        } else {
            return [0, selectorsToReset];
        }
    } else if (dateSelector === 'curve-dates') {
        if (!oldDatesExist) {
            const tsDate = $('#controlButton-dates-value').text();
            matsParamUtils.setValueTextForParamName('curve-dates', tsDate);
            return [tsDate, selectorsToReset];
        } else {
            return [0, selectorsToReset];
        }
    } else {
        return [0, selectorsToReset];
    }
};

const changePlotType = function (plotType, selectorsToInitialize, dateSelector) {
    if (Session.get("confirmPlotChange")) {
        // change has been confirmed
        // the MET apps have a hidden plot-type selector than needs to match the actual plot type
        matchPlotTypeSelector(plotType);

        // display appropriate selectors for this plot type, and make sure the previous dates or curve-dates values
        // carry across to the appropriate new selector
        var newDate = 0;
        var selectorsToReset = {};
        [newDate, selectorsToReset] = setDatesAndShowFace(plotType, dateSelector);
        const resetSelectors = Object.keys(selectorsToReset);

        // make sure the curves already added also have the correct parameters displayed
        var curves = Session.get('Curves');
        if (curves === undefined) {
            // in a healthy session, there should either be an array of curves or an empty array of no curves
            setError(new Error("It looks like your current browser session might have expired, so there is not enough information to successfully change the plot type. Please refresh your browser window."));
        }
        if (curves.length > 0) {
            for (var ci = curves.length-1; ci >= 0; ci--) {
                // remove any difference curves for plot types that don't support them
                var curveGone = false;
                if (curves[ci].diffFrom !== undefined && curves[ci].diffFrom !== null) {
                    switch (plotType){
                        case matsTypes.PlotTypes.reliability:
                        case matsTypes.PlotTypes.roc:
                        case matsTypes.PlotTypes.performanceDiagram:
                        case matsTypes.PlotTypes.scatter2d:
                        case matsTypes.PlotTypes.map:
                        case matsTypes.PlotTypes.contour:
                        case matsTypes.PlotTypes.contourDiff:
                            curves.splice(ci, 1);
                            curveGone = true;
                            break;
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
                        default:
                            curveGone = false;
                            break;
                    }
                }
                if (!curveGone) {
                    // change options that were valid for the plot type where this curve was added but not for this one
                    for (var ri = 0; ri < resetSelectors.length; ri++) {
                        if (curves[ci][resetSelectors[ri]] !== undefined) {
                            curves[ci][resetSelectors[ri]] = selectorsToReset[resetSelectors[ri]];
                        }
                    }
                    // initialize options for parameters not used in the plot type where this curve was added
                    for (var si = 0; si < selectorsToInitialize.length; si++) {
                        if (dateSelector === 'curve-dates' && newDate !== 0) {
                            curves[ci]['curve-dates'] = newDate;
                        }
                        if (!curves[ci][selectorsToInitialize[si]] && matsCollections[selectorsToInitialize[si]] && matsCollections[selectorsToInitialize[si]].findOne({name: selectorsToInitialize[si]})) {
                            if (matsCollections[selectorsToInitialize[si]].findOne({name: selectorsToInitialize[si]}).default) {
                                // we have a default. Use that.
                                curves[ci][selectorsToInitialize[si]] = matsCollections[selectorsToInitialize[si]].findOne({name: selectorsToInitialize[si]}).default;
                            } else if (matsCollections[selectorsToInitialize[si]].findOne({name: selectorsToInitialize[si]}).options) {
                                // we don't have a default, but we have a list of options. Use the first one of those.
                                curves[ci][selectorsToInitialize[si]] = matsCollections[selectorsToInitialize[si]].findOne({name: selectorsToInitialize[si]}).options[0];
                            }
                        }
                    }
                }
            }
            Session.set('Curves', curves);
        }
        Session.set("confirmPlotChange", "");
        Session.set('plotChangeType', "");
    } else {
        // no confirmation yet so check to see if we have any curves and if so then show the confirm dialog
        if (Session.get("Curves").length > 0) {
            Session.set('plotChangeType', plotType);
            $("#modal-change-plot-type").modal();
        } else {
            // no curves - just set the new plot type face
            // the MET apps have a hidden plot-type selector than needs to match the actual plot type
            matchPlotTypeSelector(plotType);

            // display appropriate selectors for this plot type, and make sure the previous dates or curve-dates values
            // carry across to the appropriate new selector
            setDatesAndShowFace(plotType, dateSelector);
        }
    }
};

Template.plotType.events({
    'click .plot-type-TimeSeries': function (event) {
        const plotType = matsTypes.PlotTypes.timeSeries;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'average', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Profile': function (event) {
        const plotType = matsTypes.PlotTypes.profile;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-DieOff': function (event) {
        const plotType = matsTypes.PlotTypes.dieoff;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'dieoff-type', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Threshold': function (event) {
        const plotType = matsTypes.PlotTypes.threshold;
        const selectorsToInitialize = ['statistic', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-ValidTime': function (event) {
        const plotType = matsTypes.PlotTypes.validtime;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-GridScale': function (event) {
        const plotType = matsTypes.PlotTypes.gridscale;
        const selectorsToInitialize = ['statistic', 'threshold', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-DailyModelCycle': function (event) {
        const plotType = matsTypes.PlotTypes.dailyModelCycle;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'utc-cycle-start', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-YearToYear': function (event) {
        const plotType = matsTypes.PlotTypes.yearToYear;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'region-type', 'region'];
        const dateSelector = 'none';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Reliability': function (event) {
        const plotType = matsTypes.PlotTypes.reliability;
        const selectorsToInitialize = ['threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-ROC': function (event) {
        const plotType = matsTypes.PlotTypes.roc;
        const selectorsToInitialize = ['threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-PerformanceDiagram': function (event) {
        const plotType = matsTypes.PlotTypes.performanceDiagram;
        const selectorsToInitialize = ['threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region', 'bin-parameter'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Map': function (event) {
        const plotType = matsTypes.PlotTypes.map;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Histogram': function (event) {
        const plotType = matsTypes.PlotTypes.histogram;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-EnsembleHistogram': function (event) {
        const plotType = matsTypes.PlotTypes.ensembleHistogram;
        const selectorsToInitialize = ['threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region'];
        const dateSelector = 'curve-dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Contour': function (event) {
        const plotType = matsTypes.PlotTypes.contour;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region', 'x-axis-parameter', 'y-axis-parameter'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-ContourDiff': function (event) {
        const plotType = matsTypes.PlotTypes.contourDiff;
        const selectorsToInitialize = ['statistic', 'threshold', 'scale', 'level', 'forecast-length', 'valid-time', 'truth', 'year', 'storm', 'region-type', 'region', 'x-axis-parameter', 'y-axis-parameter'];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    },
    'click .plot-type-Scatter2d': function (event) {
        const plotType = matsTypes.PlotTypes.scatter2d;
        const selectorsToInitialize = [];
        const dateSelector = 'dates';
        changePlotType(plotType, selectorsToInitialize, dateSelector);
    }
});
