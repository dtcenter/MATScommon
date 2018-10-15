import {moment} from 'meteor/momentjs:moment'
import {matsTypes} from 'meteor/randyp:mats-common';
import {matsCurveUtils} from 'meteor/randyp:mats-common';
import {matsGraphUtils} from 'meteor/randyp:mats-common';

graphHistogram = function (key) {
    // get plot info
    var route = Session.get('route');
    var vpw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
    var vph = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);
    var min = Math.min(vpw, vph);

    // get dataset info and options
    var resultSet = matsCurveUtils.getGraphResult();
    if (resultSet === null || resultSet === undefined || resultSet.data === undefined) {
        return false;
    }
    var dataset = resultSet.data;
    var options = resultSet.options;

    //set options
    if (min < 400) {
        options !== undefined && options.series && options.series.points && (options.series.points.radius = 1);
    } else {
        options !== undefined && options.series && options.series.points && (options.series.points.radius = 2);
    }
    if (route !== undefined && route !== "") {
        options.selection = [];
    }

    // initializa show/hide button labels
    matsGraphUtils.setNoDataLabels(dataset);
};