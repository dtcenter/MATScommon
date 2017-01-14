import { matsCollections } from 'meteor/randyp:mats-common';
import { matsTypes } from 'meteor/randyp:mats-common';
import { matsCurveUtils } from 'meteor/randyp:mats-common';
import { moment } from 'meteor/momentjs:moment';
import { matsPlotUtils } from 'meteor/randyp:mats-common';

var curveIndexes = [];
var levels = [];

Template.textProfileOutput.helpers({
    plotName: function() {
        return Session.get('plotName');
    },
    curves: function () {
        /*
         This (plotResultsUpDated) is very important.
         The page is rendered whe the graph page comes up, but the data from the data processing callback
         in plotList.js or curveList.js may not have set the global variable
         PlotResult. The callback sets the variable then sets the session variable plotResultsUpDated.
         Referring to plotResultsUpDated here causes the html to get re-rendered with the current graph data
         (which is in the PlotResults global). This didn't used to be necessary because the plot data
         was contained in the session, but some unknown ddp behaviour having to do with the amount of plot data
         made that unworkable.
         */
        const plotResultsUpDated = Session.get('PlotResultsUpDated');
        if (plotResultsUpDated === undefined) {
            return [];
        }
        return Session.get('Curves');
    },
    curveText: function () {
        this.regionName = this.region.split(' ')[0];  // regionName might be needed in getCurveText but only region is defined
        const text = matsPlotUtils.getCurveText(matsPlotUtils.getPlotType(),this);
        return text;
    },
    curveLabel: function (curve) {
        return curve.label;
    },
    pressureLevels: function() {
        /*
         This (plotResultsUpDated) is very important.
         The page is rendered when the graph page comes up, but the data from the data processing callback
         in plotList.js or curveList.js may not have set the global variable
         PlotResult. The callback sets the variable then sets the session variable plotResultsUpDated.
         Referring to plotResultsUpDated here causes the html to get re-rendered with the current graph data
         (which is in the PlotResults global). This didn't used to be necessary because the plot data
         was contained in the session, but some unknown ddp behaviour having to do with the amount of plot data
         made that unworkable.
         */
        const plotResultsUpDated = Session.get('PlotResultsUpDated');
        const curves = Session.get('Curves');
        if (plotResultsUpDated === undefined) {
            return [];
        }

        if (matsCurveUtils.PlotResult.data === undefined) {
            return [];
        }
        if (matsPlotUtils.getPlotType() != matsTypes.PlotTypes.profile) {
            return [];
        }
        var levelSet = new Set();
        var di = 0;
        for (var i = 0; i < matsCurveUtils.PlotResult.data.length; i++) {
            for (di = 0; di < matsCurveUtils.PlotResult.data[i].data.length; di++) {
                matsCurveUtils.PlotResult.data[i] && matsCurveUtils.PlotResult.data[i].data[di] && levelSet.add(matsCurveUtils.PlotResult.data[i].data[di][1]);
            }
        }
        levels = Array.from (levelSet);
        levels.sort((a, b) => (a - b));

        // curveIndexes are used to index each curve of the dataset - they all start with 0
        curveIndexes = [];
        for (var curveIndex = 0; curveIndex < curves.length; curveIndex++) {
            curveIndexes.push(0);
        }
        return levels;
    },

    points: function(level) {
        /*
         This (plotResultsUpDated) is very important.
         The page is rendered whe the graph page comes up, but the data from the data processing callback
         in plotList.js or curveList.js may not have set the global variable
         PlotResult. The callback sets the variable then sets the session variable plotResultsUpDated.
         Referring to plotResultsUpDated here causes the html to get re-rendered with the current graph data
         (which is in the PlotResults global). This didn't used to be necessary because the plot data
         was contained in the session, but some unknown ddp behaviour having to do with the amount of plot data
         made that unworkable.
         */
        const plotResultsUpDated = Session.get('PlotResultsUpDated');
        if (plotResultsUpDated === undefined) {
            return [];
        }
        if (matsCurveUtils.PlotResult.data === undefined ||
            matsCurveUtils.PlotResult.length == 0) {
            return false;
        }
        if (matsPlotUtils.getPlotType() != matsTypes.PlotTypes.profile) {
            return false;
        }

        var curves = Session.get('Curves');
        if (curves === undefined || curves.length == 0) {
            return false;
        }

        var line = "<td>" + level + "</td>";
        const settings = matsCollections.Settings.findOne({},{fields:{NullFillString:1}});
        if (settings === undefined) {
            return false;
        }
        const fillStr = settings.NullFillString;
        var pdata = fillStr;
        for (var curveIndex = 0; curveIndex < curves.length; curveIndex++) {
            pdata = fillStr;
            try {
                // if there isn't any data in this curve for this level, catch the exception, ignore it and use fillStr
                // otherwise save the data in the line
                // do NOT increment the data pointer unless there is a match (curveIndexes[curveIndex]++ comes after any Exception would be thrown)
                if (matsCurveUtils.PlotResult.data[curveIndex].data[curveIndexes[curveIndex]] && matsCurveUtils.PlotResult.data[curveIndex].data[curveIndexes[curveIndex]][1] == level) {
                    if (matsCurveUtils.PlotResult.data[curveIndex].data[curveIndexes[curveIndex]][0] !== null) {
                        pdata = Number(matsCurveUtils.PlotResult.data[curveIndex].data[curveIndexes[curveIndex]][0]).toPrecision(4);
                    }
                    curveIndexes[curveIndex]++;
                }
            } catch (no_data_this_level_this_curve) {
                curveIndexes[curveIndex]++;
            }
            // pdata is either real value or fillStr
            line += "<td>" + pdata + "</td>";
        }
        return line;
    }
});

Template.textProfileOutput.events({
    'click .export': function() {
        const settings = matsCollections.Settings.findOne({},{fields:{NullFillString:1}});
        if (settings === undefined) {
            return false;
        }
        const fillStr = settings.NullFillString;
        var data = [];
        const curves = Session.get('Curves');
        if (curves === undefined || curves.length == 0) {
            return data;
        }
        var clabels = 'time';
        for (var c=0; c < curves.length;c++) {
            clabels += "," + curves[c].label;
        }
        data.push(clabels);
        //var dataSet = Session.get('dataset');
        const curveNums = matsCurveUtils.PlotResult.data.length;
        const dataRows = _.range(matsCurveUtils.PlotResult.data[0].data.length);
        for (var rowIndex = 0; rowIndex < dataRows.length; rowIndex ++) {
            var line = moment.utc(Number(matsCurveUtils.PlotResult.data[0].data[rowIndex][0])).format('YYYY-MM-DD:HH:mm');
            for (var curveIndex = 0; curveIndex < curveNums; curveIndex++) {
                const pdata = matsCurveUtils.PlotResult.data[curveIndex].data[rowIndex][1] !== null?(Number(matsCurveUtils.PlotResult.data[curveIndex].data[rowIndex][1])).toPrecision(4):fillStr;
                line += "," + pdata;
            }
            data.push(line);
        }
        const csvString = data.join("%0A");
        const a         = document.createElement('a');
        a.href        = 'data:attachment/csv,' + csvString;
        a.target      = '_blank';
        a.download    = 'data.csv';
        document.body.appendChild(a);
        a.click();
    }
});
