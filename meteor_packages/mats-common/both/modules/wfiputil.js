Modules.server.wfip2 = {};

var sortFunction = function (a, b) {
    if (a[0] === b[0]) {
        return 0;
    }
    else {
        return (a[0] < b[0]) ? -1 : 1;
    }
};
Modules.server.wfip2.sortFunction = sortFunction;

var dateConvert = function (dStr) {
    if (dStr === undefined || dStr === " ") {
        var now = new Date();
        var date = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
        var yr = date.getFullYear();
        var day = date.getDate();
        var month = date.getMonth();
        var hour = date.getHours();
        var minute = date.getMinutes();
        return month + "-" + day + '-' + yr + ' ' + hour + ":" + minute;
    }
    var dateParts = dStr.split(' ');
    var dateArray = dateParts[0].split('/');
    var month = dateArray[0];
    var day = dateArray[1];
    var yr = dateArray[2];
    var hour = 0;
    var minute = 0;
    if (dateParts[1]) {
        var timeArray = dateParts[1].split(":");
        hour = timeArray[0];
        minute = timeArray[1];
    }
    return month + "-" + day + '-' + yr + ' ' + hour + ":" + minute;
};
Modules.server.wfip2.dateConvert = dateConvert;

var secsConvert = function (dStr) {
    if (dStr === undefined || dStr === " ") {
        var now = new Date();
        return now.getTime() / 1000;
    }
    else {
        var dateParts = dStr.split(' ');
        var dateArray = dateParts[0].split('-');
        var timeArray = dateParts[1].split(":");
        var yr = dateArray[2];
        var day = dateArray[1];
        var month = dateArray[0];
        var hour = timeArray[0];
        var minute = timeArray[1];
        var my_date = new Date(yr, month - 1, day, hour, minute, 0);
        // to UTC time, not local time
        var date_in_secs = my_date.getTime();
    }
    // to UTC time, not local time
    //return date_in_secs/1000 -3600*6;
    return date_in_secs / 1000;
};
Modules.server.wfip2.secsConvert = secsConvert;

var getDatum = function (rawAxisData, axisTime, levelCompletenessX, levelCompletenessY, siteCompletenessX, siteCompletenessY,
                         levelBasisX, levelBasisY, siteBasisX, siteBasisY) {
    // sum and average all of the means for all of the sites
    var datum = {};
    var commonSitesBasisLengthX = siteBasisX.length;
    var commonSitesBasisLengthY = siteBasisY.length;
    var tSitesX = rawAxisData['xaxis']['data'][axisTime];
    var tSitesY = rawAxisData['yaxis']['data'][axisTime];
    // Do we have enough sites (based on the quality) for this time to qualify the data for this time? We need to have enough for x AND y
    var sitesXQuality = (Object.keys(tSitesX).length / commonSitesBasisLengthX) * 100;
    if (sitesXQuality < siteCompletenessX) {
        return []; // reject this site (it does not qualify for x axis) for this time
    }
    var sitesYQuality = (Object.keys(tSitesY).length / commonSitesBasisLengthY) * 100;
    if (sitesYQuality < siteCompletenessY) {
        return []; // reject this site (it does not qualify for y axis) for this time
    }

    // still here? process the sites
    var axisArr = ['xaxis', 'yaxis'];
    for (var ai = 0; ai < axisArr.length; ai++) {
        var axisStr = axisArr[ai];
        var tSiteIds = Object.keys(tSitesX);
        var commonLevelsBasisLength = levelBasisX.length;
        var qualityLevels = levelCompletenessX;
        if (axisArr[ai] == 'yaxis') {
            tSiteIds = Object.keys(tSitesY);
            commonLevelsBasisLength = levelBasisY.length;
            qualityLevels = levelCompletenessY;
        }
        var siteSum = 0;
        var siteNum = 0;
        var filteredSites = [];   // used for the modal data view
        for (var si = 0; si < tSiteIds.length; si++) {
            var siteId = tSiteIds[si];
            var siteMean = 0;
            if (qualityLevels == 0) {  // no need to recalculate if everything is accepted i.e. quality = 0
                siteSum += rawAxisData[axisStr]['data'][axisTime][siteId]['mean'];
                siteNum +=  rawAxisData[axisStr]['data'][axisTime][siteId]['numLevels'];
                filteredSites = rawAxisData[axisStr]['data'][axisTime];
                //combine the levels and the values into single array (for using in the modal data view)
                filteredSites[siteId].levelsValues = filteredSites[siteId].levels.map(function(level, index) { return [level, filteredSites[siteId].values[index]] });
                rawAxisData[axisStr]['data'][axisTime][siteId].levelsValues = filteredSites[siteId].levelsValues;
            } else {
                // quality filter is required (>0)  so we have to recalculate the statistics for this site for qualified levels
                // recalculate sMean for filtered levels
                var sLevels = rawAxisData[axisStr]['data'][axisTime][siteId]['levels'];
                //combine the levels and the values into single array (for using in the modal data view) - raw values - unfiltered
                rawAxisData[axisStr]['data'][axisTime][siteId].levelsValues = rawAxisData[axisStr]['data'][axisTime][siteId].levels.map(function(level, index) { return [level, rawAxisData[axisStr]['data'][axisTime][siteId].values[index]] });

                // What we really want is to put in a quality control
                // that says "what percentage of the commonSitesBasis set of levels does the Levels for this site and time need to be
                // in order to qualify the data?" In other words, throw away any data that doesn't meet the quality criteria.
                var matchQuality = (sLevels.length / commonLevelsBasisLength) * 100;
                if (matchQuality < qualityLevels) {
                    continue;
                }
                var sValues = rawAxisData[axisStr]['data'][axisTime][siteId]['values'];
                filteredSites[siteId].levelsValues = filteredSites[siteId].levels.map(function(level, index) { return [level, filteredSites[siteId].values[index]] });
                for (var li = 0; li < sLevels.length; li++) {
                    siteSum += sValues[li];
                    siteNum++;
                }
            }
        }

        siteMean = siteSum / siteNum;
        datum[axisStr + '-mean'] = siteMean;
        datum[axisStr + '-sites'] = rawAxisData[axisStr]['data'][axisTime];  // used to get levelsValues from raw data for data modal
        datum[axisStr + '-filteredSites'] = filteredSites;
    }
    return datum;
};
Modules.server.wfip2.getDatum = getDatum;

