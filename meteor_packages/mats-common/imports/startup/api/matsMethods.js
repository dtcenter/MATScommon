/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
    Meteor
} from "meteor/meteor";
import {
    ValidatedMethod
} from 'meteor/mdg:validated-method';
import SimpleSchema from 'simpl-schema';
import {
    matsCache,
    matsCollections,
    matsDataQueryUtils,
    matsCouchbaseUtils,
    matsDataUtils,
    matsTypes,
    versionInfo
} from 'meteor/randyp:mats-common';
import {
    mysql
} from 'meteor/pcel:mysql';
import {
    url
} from 'url';
import {
    Mongo
} from 'meteor/mongo';

// PRIVATE

// local collection used to keep the table update times for refresh - won't ever be synchronized or persisted.
const metaDataTableUpdates = new Mongo.Collection(null);
// initialize collection used for pop-out window functionality
const LayoutStoreCollection = new Mongo.Collection("LayoutStoreCollection");
// initialize collection used to cache previously downsampled plots
const DownSampleResults = new Mongo.Collection("DownSampleResults");

// utility to check for empty object
const isEmpty = function (map) {
    for (var key in map) {
        if (map.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}
// Define routes for server
if (Meteor.isServer) {
    // add indexes to result and axes collections
    DownSampleResults.rawCollection().createIndex({
        "createdAt": 1
    }, {
        expireAfterSeconds: 3600 * 8
    }); // 8 hour expiration
    LayoutStoreCollection.rawCollection().createIndex({
        "createdAt": 1
    }, {
        expireAfterSeconds: 900
    }); // 15 min expiration

    // set the default proxy prefix path to ""
    // If the settings are not complete, they will be set by the configuration and written out, which will cause the app to reset
    if (Meteor.settings.public != null && Meteor.settings.public.proxy_prefix_path == null) {
        Meteor.settings.public.proxy_prefix_path = "";
    }

    Picker.route('/status', function (params, req, res, next) {
        Picker.middleware(_status(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/status', function (params, req, res, next) {
        Picker.middleware(_status(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/status', function (params, req, res, next) {
        Picker.middleware(_status(params, req, res, next));
    });


    Picker.route('/_getCSV/:key', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/_getCSV/:key', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/app:/_getCSV/:key', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route('/CSV/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/CSV/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/CSV/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getCSV(params, req, res, next));
    });

    Picker.route('/_getJSON/:key', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/_getJSON/:key', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/app:/_getJSON/:key', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route('/JSON/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/JSON/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/JSON/:f/:key/:m/:a', function (params, req, res, next) {
        Picker.middleware(_getJSON(params, req, res, next));
    });

    Picker.route('/clearCache', function (params, req, res, next) {
        Picker.middleware(_clearCache(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/clearCache', function (params, req, res, next) {
        Picker.middleware(_clearCache(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/clearCache', function (params, req, res, next) {
        Picker.middleware(_clearCache(params, req, res, next));
    });

    Picker.route('/getApps', function (params, req, res, next) {
        Picker.middleware(_getApps(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getApps', function (params, req, res, next) {
        Picker.middleware(_getApps(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getApps', function (params, req, res, next) {
        Picker.middleware(_getApps(params, req, res, next));
    });

    Picker.route('/getAppSumsDBs', function (params, req, res, next) {
        Picker.middleware(_getAppSumsDBs(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getAppSumsDBs', function (params, req, res, next) {
        Picker.middleware(_getAppSumsDBs(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getAppSumsDBs', function (params, req, res, next) {
        Picker.middleware(_getAppSumsDBs(params, req, res, next));
    });

    Picker.route('/getModels', function (params, req, res, next) {
        Picker.middleware(_getModels(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getModels', function (params, req, res, next) {
        Picker.middleware(_getModels(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getModels', function (params, req, res, next) {
        Picker.middleware(_getModels(params, req, res, next));
    });

    Picker.route('/getRegions', function (params, req, res, next) {
        Picker.middleware(_getRegions(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getRegions', function (params, req, res, next) {
        Picker.middleware(_getRegions(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getRegions', function (params, req, res, next) {
        Picker.middleware(_getRegions(params, req, res, next));
    });

    Picker.route('/getRegionsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getRegionsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getRegionsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getRegionsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getRegionsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getRegionsValuesMap(params, req, res, next));
    });

    Picker.route('/getStatistics', function (params, req, res, next) {
        Picker.middleware(_getStatistics(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getStatistics', function (params, req, res, next) {
        Picker.middleware(_getStatistics(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getStatistics', function (params, req, res, next) {
        Picker.middleware(_getStatistics(params, req, res, next));
    });

    Picker.route('/getStatisticsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getStatisticsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getStatisticsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getStatisticsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getStatisticsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getStatisticsValuesMap(params, req, res, next));
    });

    Picker.route('/getVariables', function (params, req, res, next) {
        Picker.middleware(_getVariables(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getVariables', function (params, req, res, next) {
        Picker.middleware(_getVariables(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getVariables', function (params, req, res, next) {
        Picker.middleware(_getVariables(params, req, res, next));
    });

    Picker.route('/getVariablesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getVariablesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getVariablesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getVariablesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getVariablesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getVariablesValuesMap(params, req, res, next));
    });

    Picker.route('/getThresholds', function (params, req, res, next) {
        Picker.middleware(_getThresholds(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getThresholds', function (params, req, res, next) {
        Picker.middleware(_getThresholds(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getThresholds', function (params, req, res, next) {
        Picker.middleware(_getThresholds(params, req, res, next));
    });

    Picker.route('/getThresholdsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getThresholdsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getThresholdsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getThresholdsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getThresholdsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getThresholdsValuesMap(params, req, res, next));
    });

    Picker.route('/getScales', function (params, req, res, next) {
        Picker.middleware(_getScales(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getScales', function (params, req, res, next) {
        Picker.middleware(_getScales(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getScales', function (params, req, res, next) {
        Picker.middleware(_getScales(params, req, res, next));
    });

    Picker.route('/getScalesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getScalesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getScalesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getScalesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getScalesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getScalesValuesMap(params, req, res, next));
    });

    Picker.route('/getTruths', function (params, req, res, next) {
        Picker.middleware(_getTruths(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getTruths', function (params, req, res, next) {
        Picker.middleware(_getTruths(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getTruths', function (params, req, res, next) {
        Picker.middleware(_getTruths(params, req, res, next));
    });

    Picker.route('/getTruthsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getTruthsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getTruthsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getTruthsValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getTruthsValuesMap', function (params, req, res, next) {
        Picker.middleware(_getTruthsValuesMap(params, req, res, next));
    });

    Picker.route('/getFcstLengths', function (params, req, res, next) {
        Picker.middleware(_getFcstLengths(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getFcstLengths', function (params, req, res, next) {
        Picker.middleware(_getFcstLengths(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getFcstLengths', function (params, req, res, next) {
        Picker.middleware(_getFcstLengths(params, req, res, next));
    });

    Picker.route('/getFcstTypes', function (params, req, res, next) {
        Picker.middleware(_getFcstTypes(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getFcstTypes', function (params, req, res, next) {
        Picker.middleware(_getFcstTypes(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getFcstTypes', function (params, req, res, next) {
        Picker.middleware(_getFcstTypes(params, req, res, next));
    });

    Picker.route('/getFcstTypesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getFcstTypesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getFcstTypesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getFcstTypesValuesMap(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getFcstTypesValuesMap', function (params, req, res, next) {
        Picker.middleware(_getFcstTypesValuesMap(params, req, res, next));
    });

    Picker.route('/getValidTimes', function (params, req, res, next) {
        Picker.middleware(_getValidTimes(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getValidTimes', function (params, req, res, next) {
        Picker.middleware(_getValidTimes(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getValidTimes', function (params, req, res, next) {
        Picker.middleware(_getValidTimes(params, req, res, next));
    });

    Picker.route('/getLevels', function (params, req, res, next) {
        Picker.middleware(_getLevels(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getLevels', function (params, req, res, next) {
        Picker.middleware(_getLevels(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getLevels', function (params, req, res, next) {
        Picker.middleware(_getLevels(params, req, res, next));
    });

    Picker.route('/getDates', function (params, req, res, next) {
        Picker.middleware(_getDates(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/getDates', function (params, req, res, next) {
        Picker.middleware(_getDates(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/getDates', function (params, req, res, next) {
        Picker.middleware(_getDates(params, req, res, next));
    });

    // create picker routes for refreshMetaData
    Picker.route('/refreshMetadata', function (params, req, res, next) {
        Picker.middleware(_refreshMetadataMWltData(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/refreshMetadata', function (params, req, res, next) {
        Picker.middleware(_refreshMetadataMWltData(params, req, res, next));
    });

    Picker.route(Meteor.settings.public.proxy_prefix_path + '/:app/refreshMetadata', function (params, req, res, next) {
        Picker.middleware(_refreshMetadataMWltData(params, req, res, next));
    });
}

// private - used to see if the main page needs to update its selectors
const _checkMetaDataRefresh = async function () {
    // This routine compares the current last modified time of the tables (MYSQL) or documents (Couchbase)
    // used for curveParameter metadata with the last update time to determine if an update is necessary.
    // We really only do this for Curveparams
    /*
        metaDataTableUpdates:
        {
            name: dataBaseName(MYSQL) or bucketName(couchbase),
            (for couchbase tables are documents)
            tables: [tableName1, tableName2 ..],
            lastRefreshed : timestamp
        }
     */
    var refresh = false;
    const tableUpdates = metaDataTableUpdates.find({}).fetch();
    const dbType = matsCollections.Settings.findOne() !== undefined ? matsCollections.Settings.findOne().dbType : matsTypes.DbTypes.mysql;
    for (var tui = 0; tui < tableUpdates.length; tui++) {
        var id = tableUpdates[tui]._id;
        var poolName = tableUpdates[tui].pool;
        var dbName = tableUpdates[tui].name;
        var tableNames = tableUpdates[tui].tables;
        var lastRefreshed = tableUpdates[tui]['lastRefreshed'];
        var updatedEpoch = Number.MAX_VALUE;
        for (var ti = 0; ti < tableNames.length; ti++) {
            var tName = tableNames[ti];
            try {
                if (Meteor.isServer) {
                    switch (dbType) {
                        case matsTypes.DbTypes.mysql:
                            var rows = matsDataQueryUtils.simplePoolQueryWrapSynchronous(global[poolName], "SELECT UNIX_TIMESTAMP(UPDATE_TIME)" +
                                "    FROM   information_schema.tables" +
                                "    WHERE  TABLE_SCHEMA = '" + dbName + "'" +
                                "    AND TABLE_NAME = '" + tName + "'");
                            updatedEpoch = rows[0]['UNIX_TIMESTAMP(UPDATE_TIME)'];
                            break;
                        case matsTypes.DbTypes.couchbase:
                            // the tName for couchbase is supposed to be the document id
                            var doc = await cbPool.getCB(tName);
                            updatedEpoch = doc.updated;
                            break;
                        default:
                            throw new Meteor.Error("resetApp: undefined DbType");
                    }
                }
                //console.log("DB says metadata for table " + dbName + "." + tName + " was updated at " + updatedEpoch);
                if (updatedEpoch === undefined || updatedEpoch === null || updatedEpoch === "NULL" || updatedEpoch === Number.MAX_VALUE) {
                    // if time of last update isn't stored by the database (thanks, Aurora DB), refresh automatically
                    //console.log("_checkMetaDataRefresh - cannot find last update time for database: " + dbName + " and table: " + tName);
                    refresh = true;
                    //console.log("FORCED Refreshing the metadata for table because updatedEpoch is undefined" + dbName + "." + tName + " : updated at " + updatedEpoch);
                    break;
                }
            } catch (e) {
                throw new Error("_checkMetaDataRefresh - error finding last update time for database: " + dbName + " and table: " + tName + ", ERROR:" + e.message);
            }
            const lastRefreshedEpoch = moment.utc(lastRefreshed).valueOf() / 1000;
            const updatedEpochMoment = moment.utc(updatedEpoch).valueOf();
            //console.log("Epoch of when this app last refreshed metadata for table " + dbName + "." + tName + " is " + lastRefreshedEpoch);
            //console.log("Epoch of when the DB says table " + dbName + "." + tName + " was last updated is " + updatedEpochMoment);
            if (lastRefreshedEpoch < updatedEpochMoment || updatedEpochMoment == 0) {
                // Aurora DB sometimes returns a 0 for last updated. In that case, do refresh the metadata.
                refresh = true;
                //console.log("Refreshing the metadata in the app selectors because table " + dbName + "." + tName + " was updated at " + moment.utc(updatedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss") + " while the metadata was last refreshed at " + moment.utc(lastRefreshedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss"));
                break;
            } else {
                //console.log("NOT Refreshing the metadata for table " + dbName + "." + tName + " : updated at " + moment.utc(updatedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss") + " : metadata last refreshed at " + moment.utc(lastRefreshedEpoch * 1000).format("YYYY-MM-DD HH:mm:ss"));
            }
        }
        if (refresh === true) {
            // refresh the app metadata
            // app specific routines
            // const asrKeys = Object.keys(appSpecificResetRoutines);
            const asrKeys = appSpecificResetRoutines;
            for (var ai = 0; ai < asrKeys.length; ai++) {
                global.appSpecificResetRoutines[ai]();
            }
            // remember that we updated ALL the metadata tables just now
            metaDataTableUpdates.update({
                _id: id
            }, {
                $set: {
                    lastRefreshed: moment().format()
                }
            });
        }
    }
    return true;
};

// private middleware for getting the status - think health check
const _status = function (params, req, res, next) {
    if (Meteor.isServer) {
        const settings = matsCollections.Settings.findOne();
        res.end("<body><div id='status'>Running: version - " + settings.appVersion + " </div></body>");
    }
};

// private middleware for clearing the cache
const _clearCache = function (params, req, res, next) {
    if (Meteor.isServer) {
        matsCache.clear();
        res.end("<body><h1>clearCache Done!</h1></body>");
    }
};

// private middleware for dropping a distinct instance (a single run) of a scorecard
const _dropScorecardInstance = async function (userName, name, submittedTime, processedAt) {
    try {
        if (cbScorecardPool == undefined) {
            throw new Meteor.Error("_dropScorecardInstance: No cbScorecardPool defined");
        }
        const statement = `DELETE
            From
                vxdata._default.SCORECARD sc
            WHERE
                sc.type='SC'
                AND sc.userName='` + userName + `'
                AND sc.name='` + name + `'
                AND sc.processedAt=` + processedAt + `
                AND sc.submitted=` + submittedTime + `;`
        const result = await cbScorecardPool.queryCB(statement);
        // delete this result from the mongo Scorecard collection
        return;
    } catch (err) {
        console.log("_dropScorecardInstance error : " + err.message);
        return {
            "error": err.message
        };
    }
};

// helper function to map a results array to specific apps
function _mapArrayToApps(result) {
    // put results in a map keyed by app
    let newResult = {};
    let apps = _getListOfApps();
    for (var aidx = 0; aidx < apps.length; aidx++) {
        if (result[aidx] === apps[aidx]) {
            newResult[apps[aidx]] = [result[aidx]];
        } else {
            newResult[apps[aidx]] = result;
        }
    }
    return newResult;
}

// helper function to map a results map to specific apps
function _mapMapToApps(result) {
    // put results in a map keyed by app
    let newResult = {};
    let apps = _getListOfApps();
    let resultKeys = Object.keys(result);
    if (!matsDataUtils.arraysEqual(apps.sort(), resultKeys.sort())) {
        if (resultKeys.includes('Predefined region')) result = result['Predefined region'];
        for (var aidx = 0; aidx < apps.length; aidx++) {
            newResult[apps[aidx]] = result;
        }
    } else {
        newResult = result;
    }
    return newResult;
}

// helper function for returning an array of database-distinct apps contained within a larger MATS app
function _getListOfApps() {
    let apps;
    if (matsCollections['database'] !== undefined && matsCollections['database'].findOne({name: 'database'}) !== undefined) {
        // get list of databases (one per app)
        apps = matsCollections['database'].findOne({
            name: 'database'
        }).options;
        if (!Array.isArray(apps)) apps = Object.keys(apps);
    } else if ((matsCollections['variable'] !== undefined && matsCollections['variable'].findOne({
            name: 'variable'
        }) !== undefined) &&
        (matsCollections['threshold'] !== undefined && matsCollections['threshold'].findOne({
            name: 'threshold'
        }) !== undefined)) {
        // get list of apps (variables in apps that also have thresholds)
        apps = matsCollections['variable'].findOne({
            name: 'variable'
        }).options;
        if (!Array.isArray(apps)) apps = Object.keys(apps);
    } else {
        apps = [matsCollections.Settings.findOne().Title];
    }
    return apps;
}

// helper function for returning a map of database-distinct apps contained within a larger MATS app and their DBs
function _getListOfAppDBs() {
    let apps;
    let result = {};
    let aidx;
    if (matsCollections['database'] !== undefined && matsCollections['database'].findOne({name: 'database'}) !== undefined) {
        // get list of databases (one per app)
        apps = matsCollections['database'].findOne({
            name: 'database'
        }).options;
        if (!Array.isArray(apps)) apps = Object.keys(apps);
        for (aidx = 0; aidx < apps.length; aidx++) {
            result[apps[aidx]] = matsCollections['database'].findOne({
                name: 'database'
            }).optionsMap[apps[aidx]].sumsDB;
        }
    } else if ((matsCollections['variable'] !== undefined && matsCollections['variable'].findOne({
            name: 'variable'
        }) !== undefined) &&
        (matsCollections['threshold'] !== undefined && matsCollections['threshold'].findOne({
            name: 'threshold'
        }) !== undefined)) {
        // get list of apps (variables in apps that also have thresholds)
        apps = matsCollections['variable'].findOne({
            name: 'variable'
        }).options;
        if (!Array.isArray(apps)) apps = Object.keys(apps);
        for (aidx = 0; aidx < apps.length; aidx++) {
            result[apps[aidx]] = matsCollections['variable'].findOne({
                name: 'variable'
            }).optionsMap[apps[aidx]];
            if (typeof result[apps[aidx]] !== 'string' && !(result[apps[aidx]] instanceof String)) result[apps[aidx]] = result[apps[aidx]].sumsDB;
        }
    } else {
        result[matsCollections.Settings.findOne().Title] = matsCollections.Databases.findOne({
            role: matsTypes.DatabaseRoles.SUMS_DATA,
            status: "active"
        }).database;
    }
    return result;
}

// helper function for getting a metadata map from a MATS selector, keyed by app title and model display text
function _getMapByAppAndModel(selector, mapType) {
    let flatJSON = "";
    try {
        let result;
        if (matsCollections[selector] !== undefined
            && matsCollections[selector].findOne({name: selector}) !== undefined
            && matsCollections[selector].findOne({name: selector})[mapType] !== undefined) {
            // get map of requested selector's metadata
            result = matsCollections[selector].findOne({
                name: selector
            })[mapType];
            let newResult = {};
            if (mapType === 'valuesMap' || selector === 'variable' || selector === 'statistic') {
                // valueMaps always need to be re-keyed by app (statistic and variable get their valuesMaps from optionsMaps)
                newResult = _mapMapToApps(result);
                result = newResult;
            } else if ((matsCollections['database'] === undefined) &&
                !(matsCollections['variable'] !== undefined && matsCollections['threshold'] !== undefined)) {
                // key by app title if we're not already
                const appTitle = matsCollections.Settings.findOne().Title;
                newResult[appTitle] = result;
                result = newResult;
            }
        } else {
            result = {};
        }
        flatJSON = JSON.stringify(result);
    } catch (e) {
        console.log('error retrieving metadata from ' + selector + ': ', e);
        flatJSON = JSON.stringify({
            error: e
        });
    }
    return flatJSON;
}

// helper function for getting a date metadata map from a MATS selector, keyed by app title and model display text
function _getDateMapByAppAndModel() {
    let flatJSON = "";
    try {
        let result;
        // the date map can be in a few places. we have to hunt for it.
        if (matsCollections['database'] !== undefined && matsCollections['database'].findOne({
                name: 'database'
            }) !==
            undefined && matsCollections['database'].findOne({
                name: 'database'
            }).dates !== undefined) {
            result = matsCollections['database'].findOne({
                name: 'database'
            }).dates;
        } else if (matsCollections['variable'] !== undefined && matsCollections['variable'].findOne({
                name: 'variable'
            }) !==
            undefined && matsCollections['variable'].findOne({
                name: 'variable'
            }).dates !== undefined) {
            result = matsCollections['variable'].findOne({
                name: 'variable'
            }).dates;
        } else if (matsCollections['data-source'] !== undefined && matsCollections['data-source'].findOne({
                name: 'data-source'
            }) !==
            undefined && matsCollections['data-source'].findOne({
                name: 'data-source'
            }).dates !== undefined) {
            result = matsCollections['data-source'].findOne({
                name: 'data-source'
            }).dates;
        } else {
            result = {};
        }
        if ((matsCollections['database'] === undefined) &&
            !(matsCollections['variable'] !== undefined && matsCollections['threshold'] !== undefined)) {
            // key by app title if we're not already
            const appTitle = matsCollections.Settings.findOne().Title;
            let newResult = {};
            newResult[appTitle] = result;
            result = newResult;
        }
        flatJSON = JSON.stringify(result);
    } catch (e) {
        console.log('error retrieving datemap', e);
        flatJSON = JSON.stringify({
            error: e
        });
    }
    return flatJSON;
}

// helper function for getting a metadata map from a MATS selector, keyed by app title
function _getMapByApp(selector) {
    let flatJSON = "";
    try {
        let result;
        if (matsCollections[selector] !== undefined && matsCollections[selector].findOne({name: selector}) !== undefined) {
            // get array of requested selector's metadata
            result = matsCollections[selector].findOne({
                name: selector
            }).options;
            if (!Array.isArray(result)) result = Object.keys(result);
        } else {
            if (selector === 'statistic') {
                result = ["ACC"];
            } else if (selector === 'variable') {
                result = [matsCollections.Settings.findOne().Title];
            } else {
                result = [];
            }
        }
        // put results in a map keyed by app
        let newResult;
        if (result.length === 0) {
            newResult = {};
        } else {
            newResult = _mapArrayToApps(result);
        }
        flatJSON = JSON.stringify(newResult);
    } catch (e) {
        console.log('error retrieving metadata from ' + selector + ': ', e);
        flatJSON = JSON.stringify({
            error: e
        });
    }
    return flatJSON;
}

// helper function for populating the levels in a MATS selector
function _getlevelsByApp() {
    let flatJSON = "";
    try {
        let result;
        if (matsCollections['level'] !== undefined && matsCollections['level'].findOne({name: 'level'}) !== undefined) {
            // we have levels already defined
            result = matsCollections['level'].findOne({
                name: 'level'
            }).options;
            if (!Array.isArray(result)) result = Object.keys(result);
        } else if (matsCollections['top'] !== undefined && matsCollections['top'].findOne({name: 'top'}) !== undefined) {
            // use the MATS mandatory levels
            result = _.range(100, 1050, 50);
            if (!Array.isArray(result)) result = Object.keys(result);
        } else {
            result = [];
        }
        let newResult;
        if (result.length === 0) {
            newResult = {};
        } else {
            newResult = _mapArrayToApps(result);
        }
        flatJSON = JSON.stringify(newResult);
    } catch (e) {
        console.log('error retrieving levels: ', e);
        flatJSON = JSON.stringify({
            error: e
        });
    }
    return flatJSON;
}

// private middleware for _getApps route
const _getApps = function (params, req, res, next) {
    // this function returns an array of apps.
    if (Meteor.isServer) {
        let flatJSON = "";
        try {
            let result = _getListOfApps();
            flatJSON = JSON.stringify(result);
        } catch (e) {
            console.log('error retrieving apps: ', e);
            flatJSON = JSON.stringify({
                error: e
            });
        }
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getAppSumsDBs route
const _getAppSumsDBs = function (params, req, res, next) {
    // this function returns map of apps and appRefs.
    if (Meteor.isServer) {
        let flatJSON = "";
        try {
            let result = _getListOfAppDBs();
            flatJSON = JSON.stringify(result);
        } catch (e) {
            console.log('error retrieving apps: ', e);
            flatJSON = JSON.stringify({
                error: e
            });
        }
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getModels route
const _getModels = function (params, req, res, next) {
    // this function returns a map of models keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('data-source', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getRegions route
const _getRegions = function (params, req, res, next) {
    // this function returns a map of regions keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('region', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getRegionsValuesMap route
const _getRegionsValuesMap = function (params, req, res, next) {
    // this function returns a map of regions values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('region', 'valuesMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getStatistics route
const _getStatistics = function (params, req, res, next) {
    // this function returns an map of statistics keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByApp('statistic');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getStatisticsValuesMap route
const _getStatisticsValuesMap = function (params, req, res, next) {
    // this function returns a map of statistic values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('statistic', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getVariables route
const _getVariables = function (params, req, res, next) {
    // this function returns an map of variables keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByApp('variable');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getVariablesValuesMap route
const _getVariablesValuesMap = function (params, req, res, next) {
    // this function returns a map of variable values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('variable', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getThresholds route
const _getThresholds = function (params, req, res, next) {
    // this function returns a map of thresholds keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('threshold', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getThresholdsValuesMap route
const _getThresholdsValuesMap = function (params, req, res, next) {
    // this function returns a map of threshold values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('threshold', 'valuesMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getScales route
const _getScales = function (params, req, res, next) {
    // this function returns a map of scales keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('scale', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getScalesValuesMap route
const _getScalesValuesMap = function (params, req, res, next) {
    // this function returns a map of scale values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('scale', 'valuesMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getTruth route
const _getTruths = function (params, req, res, next) {
    // this function returns a map of truths keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('truth', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getTruthValuesMap route
const _getTruthsValuesMap = function (params, req, res, next) {
    // this function returns a map of truth values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('truth', 'valuesMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getFcstLengths route
const _getFcstLengths = function (params, req, res, next) {
    // this function returns a map of forecast lengths keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('forecast-length', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getFcstTypes route
const _getFcstTypes = function (params, req, res, next) {
    // this function returns a map of forecast types keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('forecast-type', 'optionsMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getFcstTypesValuesMap route
const _getFcstTypesValuesMap = function (params, req, res, next) {
    // this function returns a map of forecast type values keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByAppAndModel('forecast-type', 'valuesMap');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getValidTimes route
const _getValidTimes = function (params, req, res, next) {
    // this function returns an map of valid times keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getMapByApp('valid-time');
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getValidTimes route
const _getLevels = function (params, req, res, next) {
    // this function returns an map of pressure levels keyed by app title
    if (Meteor.isServer) {
        let flatJSON = _getlevelsByApp();
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getDates route
const _getDates = function (params, req, res, next) {
    // this function returns a map of dates keyed by app title and model display text
    if (Meteor.isServer) {
        let flatJSON = _getDateMapByAppAndModel();
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private middleware for _getCSV route
const _getCSV = function (params, req, res, next) {
    if (Meteor.isServer) {
        var stringify = require('csv-stringify');
        var csv = "";
        try {
            var result = _getFlattenedResultData(params.key, 0, -1000);
            var statArray = Object.values(result.stats);
            var dataArray = Object.values(result.data);
            var statResultArray = [];
            var dataResultArray = [];
            for (var si = 0; si < statArray.length; si++) {
                statResultArray.push(Object.keys(statArray[si])); // push the stat header for this curve(keys)
                statResultArray.push(statArray[si]['n'] === 0 ? [statArray[si].label] : Object.values(statArray[si])); // push the stats for this curve
            }

            for (var di = 0; di < dataArray.length; di++) {
                var dataSubArray = Object.values(dataArray[di]);
                var dataHeader = dataSubArray[0] === undefined ? statArray[di].label : Object.keys(dataSubArray[0]);
                //dataHeader[0] = 'label';
                dataHeader[0] = dataSubArray[0] === undefined ? "NO DATA" : Object.keys(dataSubArray[0]).filter(key => key.indexOf('Curve') != -1)[0];
                dataResultArray.push(dataHeader); // push this curve data header (keys)
                if (dataSubArray[0] === undefined) {
                    continue;
                }
                for (var dsi = 0; dsi < dataSubArray.length; dsi++) { // push this curves data
                    dataResultArray.push(Object.values(dataSubArray[dsi]));
                }
            }
            var fileName = "matsplot-" + moment.utc().format('YYYYMMDD-HH.mm.ss') + ".csv";
            res.setHeader('Content-disposition', 'attachment; filename=' + fileName);
            res.setHeader('Content-Type', 'attachment.ContentType');
            stringify(statResultArray, {
                header: true
            }, function (err, output) {
                if (err) {
                    console.log("error in _getCSV:", err);
                    res.write("error," + err.toLocaleString());
                    res.end("<body><h1>_getCSV Error! " + err.toLocaleString() + "</h1></body>");
                    return;
                }
                res.write(output);
                stringify(dataResultArray, {
                    header: true
                }, function (err, output) {
                    if (err) {
                        console.log("error in _getCSV:", err);
                        res.write("error," + err.toLocaleString());
                        res.end("<body><h1>_getCSV Error! " + err.toLocaleString() + "</h1></body>");
                        return;
                    }
                    res.write(output);
                    res.end();
                });
            });
        } catch (e) {
            console.log('error retrieving data: ', e);
            csv = "error," + e.toLocaleString();
            res.setHeader('Content-disposition', 'attachment; filename=matsplot.csv');
            res.setHeader('Content-Type', 'attachment.ContentType');
            res.end("<body><h1>_getCSV Error! " + csv + "</h1></body>");
        }
    }
};

// private middleware for _getJSON route
const _getJSON = function (params, req, res, next) {
    if (Meteor.isServer) {
        var flatJSON = "";
        try {
            var result = _getPagenatedData(params.key, 0, -1000);
            flatJSON = JSON.stringify(result);
        } catch (e) {
            console.log('error retrieving data: ', e);
            flatJSON = JSON.stringify({
                error: e
            });
            delete flatJSON.dsiRealPageIndex;
            delete flatJSON.dsiTextDirection;
        }
        res.setHeader('Content-Type', 'application/json');
        res.write(flatJSON);
        res.end();
    }
};

// private method for getting pagenated results and flattening them in order to be appropriate for text display.
const _getFlattenedResultData = function (rk, p, np) {
    if (Meteor.isServer) {
        var resp;
        try {
            var r = rk;
            var p = p;
            var np = np;
            // get the pagenated data
            var result = _getPagenatedData(r, p, np);
            // find the type
            var plotTypes = result.basis.plotParams.plotTypes;
            var plotType = (_.invert(plotTypes))[true];
            // extract data
            let isCTC = false;
            let isModeSingle = false;
            let isModePairs = false;
            var data = result.data;
            var dsiRealPageIndex = result.dsiRealPageIndex;
            var dsiTextDirection = result.dsiTextDirection;
            switch (plotType) {
                case matsTypes.PlotTypes.timeSeries:
                case matsTypes.PlotTypes.profile:
                case matsTypes.PlotTypes.dieoff:
                case matsTypes.PlotTypes.threshold:
                case matsTypes.PlotTypes.validtime:
                case matsTypes.PlotTypes.dailyModelCycle:
                case matsTypes.PlotTypes.gridscale:
                case matsTypes.PlotTypes.yearToYear:
                    var labelSuffix;
                    switch (plotType) {
                        case matsTypes.PlotTypes.timeSeries:
                        case matsTypes.PlotTypes.dailyModelCycle:
                            labelSuffix = " time";
                            break;
                        case matsTypes.PlotTypes.profile:
                            labelSuffix = " level";
                            break;
                        case matsTypes.PlotTypes.dieoff:
                            labelSuffix = " forecast lead time";
                            break;
                        case matsTypes.PlotTypes.validtime:
                            labelSuffix = " hour of day";
                            break;
                        case matsTypes.PlotTypes.threshold:
                            labelSuffix = " threshold";
                            break;
                        case matsTypes.PlotTypes.gridscale:
                            labelSuffix = " grid scale";
                            break;
                        case matsTypes.PlotTypes.yearToYear:
                            labelSuffix = " year";
                            break;
                    }
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    for (var ci = 0; ci < data.length; ci++) { // for each curve
                        isCTC = data[ci] !== undefined &&
                            ((data[ci].stats !== undefined && data[ci].stats[0] !== undefined && data[ci].stats[0].hit !== undefined) ||
                                (data[ci].hitTextOutput !== undefined && data[ci].hitTextOutput.length > 0));
                        isModePairs = data[ci] !== undefined && ((data[ci].stats !== undefined && data[ci].stats[0] !== undefined &&
                            data[ci].stats[0].avgInterest !== undefined));
                        isModeSingle = data[ci] !== undefined && ((data[ci].stats !== undefined && data[ci].stats[0] !== undefined &&
                            data[ci].stats[0].n_forecast !== undefined));
                        // if the curve label is a reserved word do not process the curve (its a zero or max curve)
                        var reservedWords = Object.values(matsTypes.ReservedWords);
                        if (reservedWords.indexOf(data[ci].label) >= 0) {
                            continue; // don't process the zero or max curves
                        }
                        var stats = {};
                        stats['label'] = data[ci].label;
                        stats['mean'] = data[ci].glob_stats.d_mean;
                        stats['standard deviation'] = data[ci].glob_stats.sd;
                        stats['n'] = data[ci].glob_stats.n_good;
                        if (plotType === matsTypes.PlotTypes.timeSeries || plotType === matsTypes.PlotTypes.profile) {
                            stats['standard error'] = data[ci].glob_stats.stde_betsy;
                            stats['lag1'] = data[ci].glob_stats.lag1;
                        }
                        stats['minimum'] = data[ci].glob_stats.minVal;
                        stats['maximum'] = data[ci].glob_stats.maxVal;
                        returnData.stats[data[ci].label] = stats;

                        var curveData = []; // array of maps
                        for (var cdi = 0; cdi < data[ci].x.length; cdi++) { // for each datapoint
                            var curveDataElement = {};
                            if (plotType === matsTypes.PlotTypes.profile) {
                                curveDataElement[data[ci].label + labelSuffix] = data[ci].y[cdi];
                            } else {
                                curveDataElement[data[ci].label + labelSuffix] = data[ci].x[cdi];
                            }
                            if (isCTC) {
                                curveDataElement['stat'] = data[ci].stats[cdi].stat;
                                curveDataElement['n'] = data[ci].stats[cdi].n;
                                curveDataElement['hit'] = data[ci].stats[cdi].hit;
                                curveDataElement['fa'] = data[ci].stats[cdi].fa;
                                curveDataElement['miss'] = data[ci].stats[cdi].miss;
                                curveDataElement['cn'] = data[ci].stats[cdi].cn;
                            } else if (isModeSingle) {
                                curveDataElement['stat'] = data[ci].stats[cdi].stat;
                                curveDataElement['n_forecast'] = data[ci].stats[cdi].n_forecast;
                                curveDataElement['n_matched'] = data[ci].stats[cdi].n_matched;
                                curveDataElement['n_simple'] = data[ci].stats[cdi].n_simple;
                                curveDataElement['n_total'] = data[ci].stats[cdi].n_total;
                            } else if (isModePairs) {
                                curveDataElement['stat'] = data[ci].stats[cdi].stat;
                                curveDataElement['n'] = data[ci].stats[cdi].n;
                                curveDataElement['avgInterest'] = data[ci].stats[cdi].avgInterest;
                            } else {
                                curveDataElement['stat'] = data[ci].stats[cdi].stat;
                                curveDataElement['mean'] = data[ci].stats[cdi].mean;
                                curveDataElement['std dev'] = data[ci].stats[cdi].sd;
                                if (plotType === matsTypes.PlotTypes.timeSeries || plotType === matsTypes.PlotTypes.profile) {
                                    curveDataElement['std error'] = data[ci].stats[cdi].stde_betsy;
                                    curveDataElement['lag1'] = data[ci].stats[cdi].lag1;
                                }
                                curveDataElement['n'] = data[ci].stats[cdi].n_good;
                            }
                            curveData.push(curveDataElement);
                        }
                        returnData.data[data[ci].label] = curveData;
                    }
                    break;
                case matsTypes.PlotTypes.reliability:
                case matsTypes.PlotTypes.roc:
                case matsTypes.PlotTypes.performanceDiagram:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    for (var ci = 0; ci < data.length; ci++) { // for each curve
                        // if the curve label is a reserved word do not process the curve (its a zero or max curve)
                        var reservedWords = Object.values(matsTypes.ReservedWords);
                        if (reservedWords.indexOf(data[ci].label) >= 0) {
                            continue; // don't process the zero or max curves
                        }
                        var stats = {};
                        stats['label'] = data[ci].label;
                        if (plotType === matsTypes.PlotTypes.reliability) {
                            stats['sample climo'] = data[ci].glob_stats.sample_climo;
                        } else if (plotType === matsTypes.PlotTypes.roc) {
                            stats['auc'] = data[ci].glob_stats.auc;
                        }
                        returnData.stats[data[ci].label] = stats;

                        var curveData = []; // array of maps
                        for (var cdi = 0; cdi < data[ci].y.length; cdi++) { // for each datapoint
                            var curveDataElement = {};
                            if (plotType === matsTypes.PlotTypes.reliability) {
                                curveDataElement[data[ci].label + ' probability bin'] = data[ci].stats[cdi].prob_bin;
                                curveDataElement['hit rate'] = data[ci].stats[cdi].hit_rate;
                            } else {
                                curveDataElement[data[ci].label + ' bin value'] = data[ci].stats[cdi].bin_value;
                                curveDataElement['probability of detection'] = data[ci].stats[cdi].pody;
                                if (plotType === matsTypes.PlotTypes.roc) {
                                    curveDataElement['probability of false detection'] = data[ci].stats[cdi].pofd;
                                } else {
                                    curveDataElement['success ratio'] = data[ci].stats[cdi].fa;
                                }
                                curveDataElement['n'] = data[ci].stats[cdi].n;
                            }
                            curveDataElement['oy'] = data[ci].stats[cdi].obs_y;
                            curveDataElement['on'] = data[ci].stats[cdi].obs_n;
                            curveData.push(curveDataElement);
                        }
                        returnData.data[data[ci].label] = curveData;
                    }
                    break;
                case matsTypes.PlotTypes.simpleScatter:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    for (var ci = 0; ci < data.length; ci++) { // for each curve
                        // if the curve label is a reserved word do not process the curve (its a zero or max curve)
                        var reservedWords = Object.values(matsTypes.ReservedWords);
                        if (reservedWords.indexOf(data[ci].label) >= 0) {
                            continue; // don't process the zero or max curves
                        }
                        var stats = {};
                        stats['label'] = data[ci].label;

                        var curveData = []; // array of maps
                        for (var cdi = 0; cdi < data[ci].y.length; cdi++) { // for each datapoint
                            var curveDataElement = {};
                            curveDataElement[data[ci].label + ' bin value'] = data[ci].stats[cdi].bin_value;
                            curveDataElement['x-stat'] = data[ci].stats[cdi].xstat;
                            curveDataElement['y-stat'] = data[ci].stats[cdi].ystat;
                            curveDataElement['n'] = data[ci].stats[cdi].n;
                            curveData.push(curveDataElement);
                        }
                        returnData.data[data[ci].label] = curveData;
                    }
                    break;
                case matsTypes.PlotTypes.map:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps

                    var stats = {};
                    stats['label'] = data[0].label;
                    stats['total number of obs'] = data[0].stats.reduce(function (prev, curr) {
                        return prev + curr.N_times;
                    }, 0);
                    stats['mean difference'] = matsDataUtils.average(data[0].queryVal);
                    stats['standard deviation'] = matsDataUtils.stdev(data[0].queryVal);
                    stats['minimum time'] = data[0].stats.reduce(function (prev, curr) {
                        return (prev < curr.min_time ? prev : curr.min_time);
                    });
                    stats['minimum time'] = moment.utc(stats['minimum time'] * 1000).format('YYYY-MM-DD HH:mm');
                    stats['maximum time'] = data[0].stats.reduce(function (prev, curr) {
                        return (prev > curr.max_time ? prev : curr.max_time);
                    });
                    stats['maximum time'] = moment.utc(stats['maximum time'] * 1000).format('YYYY-MM-DD HH:mm');

                    returnData.stats[data[0].label] = stats;

                    var curveData = []; // map of maps
                    isCTC = data[0] !== undefined && data[0].stats !== undefined && data[0].stats[0] !== undefined && data[0].stats[0].hit !== undefined;
                    for (var si = 0; si < data[0].siteName.length; si++) {
                        var curveDataElement = {};
                        curveDataElement['site name'] = data[0].siteName[si];
                        curveDataElement['number of times'] = data[0].stats[si].N_times;
                        if (isCTC) {
                            curveDataElement['stat'] = data[0].queryVal[si];
                            curveDataElement['hit'] = data[0].stats[si].hit;
                            curveDataElement['fa'] = data[0].stats[si].fa;
                            curveDataElement['miss'] = data[0].stats[si].miss;
                            curveDataElement['cn'] = data[0].stats[si].cn;
                        } else {
                            curveDataElement['start date'] = moment.utc((data[0].stats[si].min_time) * 1000).format('YYYY-MM-DD HH:mm');
                            curveDataElement['end date'] = moment.utc((data[0].stats[si].max_time) * 1000).format('YYYY-MM-DD HH:mm');
                            curveDataElement['stat'] = data[0].queryVal[si];
                        }
                        curveData.push(curveDataElement);
                    }
                    returnData.data[data[0].label] = curveData;
                    break;
                case matsTypes.PlotTypes.histogram:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    for (var ci = 0; ci < data.length; ci++) { // for each curve
                        // if the curve label is a reserved word do not process the curve (its a zero or max curve)
                        var reservedWords = Object.values(matsTypes.ReservedWords);
                        if (reservedWords.indexOf(data[ci].label) >= 0) {
                            continue; // don't process the zero or max curves
                        }
                        var stats = {};
                        stats['label'] = data[ci].label;
                        stats['mean'] = data[ci].glob_stats.glob_mean;
                        stats['standard deviation'] = data[ci].glob_stats.glob_sd;
                        stats['n'] = data[ci].glob_stats.glob_n;
                        stats['minimum'] = data[ci].glob_stats.glob_min;
                        stats['maximum'] = data[ci].glob_stats.glob_max;
                        returnData.stats[data[ci].label] = stats;

                        var curveData = []; // array of maps
                        for (var cdi = 0; cdi < data[ci].x.length; cdi++) { // for each datapoint
                            var curveDataElement = {};
                            curveDataElement[data[ci].label + ' bin range'] = data[ci].bin_stats[cdi]['binLabel'];
                            curveDataElement['n'] = data[ci].bin_stats[cdi].bin_n;
                            curveDataElement['bin rel freq'] = data[ci].bin_stats[cdi].bin_rf;
                            curveDataElement['bin lower bound'] = data[ci].bin_stats[cdi].binLowBound;
                            curveDataElement['bin upper bound'] = data[ci].bin_stats[cdi].binUpBound;
                            curveDataElement['bin mean'] = data[ci].bin_stats[cdi].bin_mean;
                            curveDataElement['bin std dev'] = data[ci].bin_stats[cdi].bin_sd;
                            curveData.push(curveDataElement);
                        }
                        returnData.data[data[ci].label] = curveData;
                    }
                    break;
                case matsTypes.PlotTypes.ensembleHistogram:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    for (var ci = 0; ci < data.length; ci++) { // for each curve
                        // if the curve label is a reserved word do not process the curve (its a zero or max curve)
                        var reservedWords = Object.values(matsTypes.ReservedWords);
                        if (reservedWords.indexOf(data[ci].label) >= 0) {
                            continue; // don't process the zero or max curves
                        }
                        var stats = {};
                        stats['label'] = data[ci].label;
                        stats['mean'] = data[ci].glob_stats.d_mean;
                        stats['standard deviation'] = data[ci].glob_stats.sd;
                        stats['n'] = data[ci].glob_stats.n_good;
                        stats['minimum'] = data[ci].glob_stats.minVal;
                        stats['maximum'] = data[ci].glob_stats.maxVal;
                        returnData.stats[data[ci].label] = stats;

                        var curveData = []; // array of maps
                        for (var cdi = 0; cdi < data[ci].x.length; cdi++) { // for each datapoint
                            var curveDataElement = {};
                            curveDataElement[data[ci].label + ' bin'] = data[ci].x[cdi];
                            curveDataElement['n'] = data[ci].bin_stats[cdi].bin_n;
                            curveDataElement['bin rel freq'] = data[ci].bin_stats[cdi].bin_rf;
                            curveData.push(curveDataElement);
                        }
                        returnData.data[data[ci].label] = curveData;
                    }
                    break;
                case matsTypes.PlotTypes.contour:
                case matsTypes.PlotTypes.contourDiff:
                    var returnData = {};
                    returnData.stats = {}; // map of maps
                    returnData.data = {}; // map of arrays of maps
                    var stats = {};
                    stats['label'] = data[0].label;
                    stats['total number of points'] = data[0].glob_stats.n;
                    stats['mean stat'] = data[0].glob_stats.mean;
                    stats['minimum time'] = moment.utc(data[0].glob_stats.minDate * 1000).format('YYYY-MM-DD HH:mm');
                    stats['maximum time'] = moment.utc(data[0].glob_stats.maxDate * 1000).format('YYYY-MM-DD HH:mm');

                    returnData.stats[data[0].label] = stats;

                    var curveData = []; // array of maps
                    isCTC = data[0] !== undefined && data[0].hitTextOutput !== undefined && data[0].hitTextOutput.length > 0;
                    for (var si = 0; si < data[0].xTextOutput.length; si++) {
                        var curveDataElement = {};
                        curveDataElement['xVal'] = data[0].xTextOutput[si];
                        curveDataElement['yVal'] = data[0].yTextOutput[si];
                        curveDataElement['stat'] = data[0].zTextOutput[si];
                        curveDataElement['N'] = data[0].nTextOutput[si];
                        if (isCTC) {
                            curveDataElement['hit'] = data[0].hitTextOutput[si];
                            curveDataElement['fa'] = data[0].faTextOutput[si];
                            curveDataElement['miss'] = data[0].missTextOutput[si];
                            curveDataElement['cn'] = data[0].cnTextOutput[si];
                        } else {
                            curveDataElement['Start Date'] = moment.utc((data[0].minDateTextOutput[si]) * 1000).format('YYYY-MM-DD HH:mm');
                            curveDataElement['End Date'] = moment.utc((data[0].maxDateTextOutput[si]) * 1000).format('YYYY-MM-DD HH:mm');
                        }
                        curveData.push(curveDataElement);
                    }
                    returnData.data[data[0].label] = curveData;
                    break;
                case matsTypes.PlotTypes.scatter2d:
                    var returnData = {}; // returns a map of arrays of maps
                    var firstBestFitIndex = -1;
                    var bestFitIndexes = {};
                    for (var ci = 0; ci < data.length; ci++) {
                        if (ci == firstBestFitIndex) {
                            break; // best fit curves are at the end so do not do further processing
                        }
                        var curveData = data[ci];
                        // look for a best fit curve - only have to look at curves with higher index than this one
                        var bestFitIndex = -1;
                        for (var cbi = ci + 1; cbi < data.length; cbi++) {
                            if (((data[cbi].label).indexOf(curveData.label) !== -1) && ((data[cbi].label).indexOf("-best fit") != -1)) {
                                bestFitIndexes[ci] = cbi;
                                if (firstBestFitIndex == -1) {
                                    firstBestFitIndex = cbi;
                                }
                                break;
                            }
                        }
                        var curveTextData = [];
                        for (var cdi = 0; cdi < curveData.data.length; cdi++) {
                            var element = {};
                            element['xAxis'] = curveData.data[cdi][0];
                            element['yAxis'] = curveData.data[cdi][1];
                            if (bestFitIndexes[ci] === undefined) {
                                element['best fit'] = "none;"
                            } else {
                                element['best fit'] = data[bestFitIndexes[ci]].data[cdi][1];
                            }
                            curveTextData.push(element);
                        }
                        returnData[curveData.label] = curveTextData;
                    }
                    break;
                default:
                    return undefined;
            }
            returnData.dsiRealPageIndex = dsiRealPageIndex;
            returnData.dsiTextDirection = dsiTextDirection;
            return returnData;
        } catch (error) {
            throw new Meteor.Error("Error in _getFlattenedResultData function: " + error.message);
        }
    }
};

// private method for getting pagenated data
// a newPageIndex of -1000 means get all the data (used for export)
// a newPageIndex of -2000 means get just the last page
const _getPagenatedData = function (rky, p, np) {
    if (Meteor.isServer) {
        var key = rky;
        var myPageIndex = p;
        var newPageIndex = np;
        var ret;
        var rawReturn;

        try {
            var result = matsCache.getResult(key);
            rawReturn = result === undefined ? undefined : result.result; // getResult structure is {key:something, result:resultObject}
        } catch (e) {
            console.log("_getPagenatedData: Error - ", e);
            return undefined;
        }
        ret = rawReturn === undefined ? undefined : JSON.parse(JSON.stringify(rawReturn));
        var start;
        var end;
        var direction = 1;
        if (newPageIndex === -1000) {
            // all the data
            start = 0;
            end = Number.MAX_VALUE;
        } else if (newPageIndex === -2000) {
            // just the last page
            start = -2000;
            direction = -1;
        } else if (myPageIndex <= newPageIndex) {
            // proceed forward
            start = (newPageIndex - 1) * 100;
            end = newPageIndex * 100;
        } else {
            // move back
            direction = -1;
            start = newPageIndex * 100;
            end = (newPageIndex + 1) * 100;
        }

        var dsiStart;
        var dsiEnd;
        for (var csi = 0; csi < ret.data.length; csi++) {
            if (ret.data[csi].x == null || ret.data[csi].x.length <= 100) {
                continue; // don't bother pagenating datasets less than or equal to a page - ret is rawReturn
            }
            dsiStart = start;
            dsiEnd = end;
            if (dsiStart > ret.data[csi].x.length || dsiStart === -2000) {
                // show the last page if we either requested it specifically or are trying to navigate past it
                dsiStart = Math.floor(rawReturn.data[csi].x.length / 100) * 100;
                dsiEnd = rawReturn.data[csi].x.length;
                if (dsiEnd === dsiStart) {
                    // make sure the last page isn't empty--if rawReturn.data[csi].data.length/100 produces a whole number,
                    // dsiStart and dsiEnd would be the same. This makes sure that the last full page is indeed the last page, without a phantom empty page afterwards
                    dsiStart = dsiEnd - 100;
                }
            }
            if (dsiStart < 0) {
                // show the first page if we are trying to navigate before it
                dsiStart = 0;
                dsiEnd = 100;
            }
            if (dsiEnd < dsiStart) {
                // make sure that the end is after the start
                dsiEnd = dsiStart + 100;
            }
            if (dsiEnd > ret.data[csi].x.length) {
                // make sure we don't request past the end -- if results are one page, this should convert the
                // start and end from 0 and 100 to 0 and whatever the end is.
                dsiEnd = ret.data[csi].x.length;
            }
            ret.data[csi].x = rawReturn.data[csi].x.slice(dsiStart, dsiEnd);
            ret.data[csi].y = rawReturn.data[csi].y.slice(dsiStart, dsiEnd);
            ret.data[csi].stats = rawReturn.data[csi].stats.slice(dsiStart, dsiEnd);
            ret.data[csi].glob_stats = rawReturn.data[csi].glob_stats;
        }

        if (direction === 1) {
            ret.dsiRealPageIndex = Math.floor(dsiEnd / 100);
        } else {
            ret.dsiRealPageIndex = Math.floor(dsiStart / 100);
        }
        ret.dsiTextDirection = direction;
        return ret;
    }
};

// private define a middleware for refreshing the metadata
const _refreshMetadataMWltData = function (params, req, res, next) {
    if (Meteor.isServer) {
        console.log("Server route asked to refresh metadata");

        try {
            console.log("GUI asked to refresh metadata");
            _checkMetaDataRefresh();
        } catch (e) {
            console.log(e);
            res.end("<body>" +
                "<h1>refreshMetadata Failed!</h1>" +
                "<p>" + e.message + "</p>" +
                "</body>");
        }
        res.end("<body><h1>refreshMetadata Done!</h1></body>");
    }
};

// private save the result from the query into mongo and downsample if that result's size is greater than 1.2Mb
const _saveResultData = function (result) {
    if (Meteor.isServer) {
        var sizeof = require('object-sizeof');
        var hash = require('object-hash');
        var key = hash(result.basis.plotParams);
        var threshold = 1200000;
        var ret = {};
        try {
            var dSize = sizeof(result.data);
            //console.log("result.basis.data size is ", dSize);
            // TimeSeries and DailyModelCycle are the only plot types that require downSampling
            if (dSize > threshold && (result.basis.plotParams.plotTypes.TimeSeries || result.basis.plotParams.plotTypes.DailyModelCycle)) {
                // greater than threshold need to downsample
                // downsample and save it in DownSampleResult
                console.log("DownSampling");
                var downsampler = require("downsample-lttb");
                var totalPoints = 0;
                for (var di = 0; di < result.data.length; di++) {
                    totalPoints += result.data[di].x_epoch.length;
                }
                var allowedNumberOfPoints = (threshold / dSize) * totalPoints;
                var downSampleResult = result === undefined ? undefined : JSON.parse(JSON.stringify(result));
                for (var ci = 0; ci < result.data.length; ci++) {
                    var dsData = {};
                    var xyDataset = result.data[ci].x_epoch.map(function (d, index) {
                        return [result.data[ci].x_epoch[index], result.data[ci].y[index]];
                    });
                    var ratioTotalPoints = xyDataset.length / totalPoints;
                    var myAllowedPoints = Math.round(ratioTotalPoints * allowedNumberOfPoints);
                    // downsample the array
                    var downsampledSeries;
                    if (myAllowedPoints < xyDataset.length && xyDataset.length > 2) {
                        downsampledSeries = downsampler.processData(xyDataset, myAllowedPoints);
                        // replace the y attributes (tooltips etc.) with the y attributes from the nearest x
                        var originalIndex = 0;
                        // skip through the original dataset capturing each downSampled data point
                        var arrayKeys = [];
                        var nonArrayKeys = [];
                        var keys = Object.keys(result.data[ci]);
                        for (var ki = 0; ki < keys.length; ki++) {
                            if (keys[ki] !== 'x_epoch') {
                                if (Array.isArray(result.data[ci][keys[ki]])) {
                                    arrayKeys.push(keys[ki]);
                                    dsData[keys[ki]] = [];
                                } else {
                                    nonArrayKeys.push(keys[ki]);
                                }
                            }
                        }
                        // We only ever downsample series plots - never profiles and series plots only ever have error_y arrays.
                        // This is a little hacky but what is happening is we putting error_y.array on the arrayKeys list so that it gets its
                        // downsampled equivalent values.
                        for (ki = 0; ki < nonArrayKeys.length; ki++) {
                            dsData[nonArrayKeys[ki]] = JSON.parse(JSON.stringify(result.data[ci][nonArrayKeys[ki]]));
                        }
                        // remove the original error_y array data.
                        dsData['error_y'].array = [];
                        for (var dsi = 0; dsi < downsampledSeries.length; dsi++) {
                            while (originalIndex < result.data[ci].x_epoch.length && (result.data[ci].x_epoch[originalIndex] < downsampledSeries[dsi][0])) {
                                originalIndex++;
                            }
                            // capture the stuff related to this downSampled data point (downSampled data points are always a subset of original data points)
                            for (ki = 0; ki < arrayKeys.length; ki++) {
                                dsData[arrayKeys[ki]][dsi] = result.data[ci][arrayKeys[ki]][originalIndex];
                            }
                            dsData['error_y']['array'][dsi] = result.data[ci]['error_y']['array'][originalIndex];
                        }
                        // add downsampled annotation to curve options
                        downSampleResult[ci] = dsData;
                        downSampleResult[ci].annotation += "   **DOWNSAMPLED**";
                    } else {
                        downSampleResult[ci] = result.data[ci];
                    }
                    downSampleResult.data[ci] = downSampleResult[ci];
                }
                DownSampleResults.rawCollection().insert({
                    "createdAt": new Date(),
                    key: key,
                    result: downSampleResult
                }); // createdAt ensures expiration set in mats-collections
                ret = {
                    key: key,
                    result: downSampleResult
                };
            } else {
                ret = {
                    key: key,
                    result: result
                };
            }
            // save original dataset in the matsCache
            if (result.basis.plotParams.plotTypes.TimeSeries || result.basis.plotParams.plotTypes.DailyModelCycle) {
                for (var ci = 0; ci < result.data.length; ci++) {
                    delete (result.data[ci]['x_epoch']); // we only needed this as an index for downsampling
                }
            }
            matsCache.storeResult(key, {
                key: key,
                result: result
            }); // lifespan is handled by lowDb (internally) in matscache
        } catch (error) {
            if (error.toLocaleString().indexOf("larger than the maximum size") != -1) {
                throw new Meteor.Error(": Requesting too much data... try averaging");
            }
        }
        return ret;
    }
};

//Utility method for writing out the meteor.settings file
const _write_settings = function (settings, appName) {

    const fs = require('fs');
    var settingsPath = process.env.METEOR_SETTINGS_DIR;
    if (settingsPath == null) {
        console.log("environment var METEOR_SETTINGS_DIR is undefined: setting it to /usr/app/settings");
        settingsPath = "/usr/app/settings";
    }
    if (!fs.existsSync(settingsPath)) {
        fs.mkdirSync(settingsPath, {
            recursive: true
        });
    }
    var appSettings = {};
    var newSettings = {};
    try {
        const appSettingsData = fs.readFileSync(settingsPath + "/" + appName + "/settings.json");
        appSettings = JSON.parse(appSettingsData);
    } catch (e) {
        appSettings = {
            "private": {},
            "public": {}
        };
    }
    newSettings = settings;
    // Merge settings into appSettings
    newSettings.private = {
        ...appSettings.private,
        ...settings.private
    };
    newSettings.public = {
        ...appSettings.public,
        ...settings.public
    };
    // write the settings file
    const jsonSettings = JSON.stringify(newSettings, null, 2);
    //console.log (jsonSettings);
    fs.writeFileSync(settingsPath + "/" + appName + "/settings.json", jsonSettings, {
        encoding: 'utf8',
        flag: 'w'
    });
}
//return the scorecard for the provided selectors
const _getScorecardData = async function (userName, name, submitted, processedAt) {
    try {
        if (cbScorecardPool == undefined) {
            throw new Meteor.Error("_getScorecardData: No cbScorecardPool defined");
        }
        const statement = `SELECT sc.*
            From
                vxdata._default.SCORECARD sc
            WHERE
                sc.type='SC'
                AND sc.userName='` + userName + `'
                AND sc.name='` + name + `'
                AND sc.processedAt=` + processedAt + `
                AND sc.submitted=` + submitted + `;`
        const result = await cbScorecardPool.queryCB(statement);
        if (typeof (result) === 'string' && result.indexOf('ERROR')) {
            throw new Meteor.Error(result);
        }
        // insert this result into the mongo Scorecard collection - createdAt is used for TTL
        // created at gets updated each display even if it already existed.
        // TTL is 24 hours
        matsCollections.Scorecard.upsert({
            'scorecard.userName': result[0].userName,
            'scorecard.name': result[0].name,
            'scorecard.submitted': result[0].submitted,
            'scorecard.processedAt': result[0].processedAt
        }, {
            $set: {
                createdAt: new Date(),
                scorecard: result[0]
            }
        });
        // no need to return the whole thing, just the identifying fields. The app will find the whole thing in the mongo collection
        return {'scorecard': result[0]};
    } catch (err) {
        console.log("_getScorecardData error : " + err.message);
        return {
            "error": err.message
        }
    }
};

// return the scorecard status information from the couchbase database
const _getScorecardInfo = async function () {
    try {
        if (cbScorecardPool == undefined) {
            throw new Meteor.Error("_getScorecardInfo: No cbScorecardPool defined");
        }

        const statement = `SELECT
            sc.id,
            sc.userName,
            sc.name,
            sc.status,
            sc.processedAt as processedAt,
            sc.submitted,
            sc.dateRange
            From
            vxdata._default.SCORECARD sc
            WHERE
            sc.type='SC';`
        const result = await cbScorecardPool.queryCB(statement);
        scMap = {};
        result.forEach(function (elem) {
            if (!Object.keys(scMap).includes(elem.userName)) {
                scMap[elem.userName] = {};
            }
            userElem = scMap[elem.userName];
            if (!Object.keys(userElem).includes(elem.name)) {
                userElem[elem.name] = {};
            }
            nameElem = userElem[elem.name];
            if (!Object.keys(nameElem).includes(elem.submited)) {
                nameElem[elem.submitted] = {};
            }
            submittedElem = nameElem[elem.submitted];
            submittedElem[elem.processedAt] = {
                'id': elem.id,
                'status': elem.status,
                'submitted': elem.submitted,
            }
        });
        return scMap;
    } catch (err) {
        console.log("_getScorecardInfo error : " + err.message);
        return {
            "error": err.message
        }
    }
};

// PUBLIC METHODS
//administration tools
const addSentAddress = new ValidatedMethod({
    name: 'matsMethods.addSentAddress',
    validate: new SimpleSchema({
        toAddress: {
            type: String
        }
    }).validator(),
    run(toAddress) {
        if (!Meteor.userId()) {
            throw new Meteor.Error(401, "not-logged-in");
        }
        matsCollections.SentAddresses.upsert({
            address: toAddress
        }, {
            address: toAddress,
            userId: Meteor.userId()
        });
        return false;
    }
});


//  administation tool
const applyAuthorization = new ValidatedMethod({
    name: 'matsMethods.applyAuthorization',
    validate: new SimpleSchema({
        settings: {
            type: Object,
            blackbox: true
        }
    }).validator(),
    run(settings) {
        if (Meteor.isServer) {
            var roles;
            var roleName;
            var authorization;

            var userRoleName = settings.userRoleName;
            var userRoleDescription = settings.userRoleDescription;
            var authorizationRole = settings.authorizationRole;
            var newUserEmail = settings.newUserEmail;
            var existingUserEmail = settings.existingUserEmail;

            if (authorizationRole) {
                // existing role - the role roleName - no need to verify as the selection list came from the database
                roleName = authorizationRole;
            } else if (userRoleName && userRoleDescription) {
                // possible new role - see if it happens to already exist
                var role = matsCollections.Roles.findOne({
                    name: userRoleName
                });
                if (role === undefined) {
                    // need to add new role using description
                    matsCollections.Roles.upsert({
                        name: userRoleName
                    }, {
                        $set: {
                            description: userRoleDescription
                        }
                    });
                    roleName = userRoleName;
                } else {
                    // see if the description matches...
                    roleName = role.name;
                    var description = role.description;
                    if (description != userRoleDescription) {
                        // have to update the description
                        matsCollections.Roles.upsert({
                            name: userRoleName
                        }, {
                            $set: {
                                description: userRoleDescription
                            }
                        });
                    }
                }
            }
            // now we have a role roleName - now we need an email
            if (existingUserEmail) {
                // existing user -  no need to verify as the selection list came from the database
                // see if it already has the role
                authorization = matsCollections.Authorization.findOne({
                    email: existingUserEmail
                });
                roles = authorization.roles;
                if (roles.indexOf(roleName) == -1) {
                    // have to add the role
                    if (roleName) {
                        roles.push(roleName);
                    }
                    matsCollections.Authorization.upsert({
                        email: existingUserEmail
                    }, {
                        $set: {
                            roles: roles
                        }
                    });
                }
            } else if (newUserEmail) {
                // possible new authorization - see if it happens to exist
                authorization = matsCollections.Authorization.findOne({
                    email: newUserEmail
                });
                if (authorization !== undefined) {
                    // authorization exists - add role to roles if necessary
                    roles = authorization.roles;
                    if (roles.indexOf(roleName) == -1) {
                        // have to add the role
                        if (roleName) {
                            roles.push(roleName);
                        }
                        matsCollections.Authorization.upsert({
                            email: existingUserEmail
                        }, {
                            $set: {
                                roles: roles
                            }
                        });
                    }
                } else {
                    // need a new authorization
                    roles = [];
                    if (roleName) {
                        roles.push(roleName);
                    }
                    if (newUserEmail) {
                        matsCollections.Authorization.upsert({
                            email: newUserEmail
                        }, {
                            $set: {
                                roles: roles
                            }
                        });
                    }
                }
            }
            return false;
        }
    }
});

// database controls
const applyDatabaseSettings = new ValidatedMethod({
    name: 'matsMethods.applyDatabaseSettings',
    validate: new SimpleSchema({
        settings: {
            type: Object,
            blackbox: true
        }
    }).validator(),

    run(settings) {
        if (Meteor.isServer) {
            if (settings.name) {
                matsCollections.Databases.upsert({
                    name: settings.name
                }, {
                    $set: {
                        name: settings.name,
                        role: settings.role,
                        status: settings.status,
                        host: settings.host,
                        database: settings.database,
                        user: settings.user,
                        password: settings.password
                    }
                });
            }
            return false;
        }
    }
});

//administration tools
const deleteSettings = new ValidatedMethod({
    name: 'matsMethods.deleteSettings',
    validate: new SimpleSchema({
        name: {
            type: String
        }
    }).validator(),
    run(params) {
        if (!Meteor.userId()) {
            throw new Meteor.Error("not-logged-in");
        }
        if (Meteor.isServer) {
            matsCollections.CurveSettings.remove({
                name: params.name
            });
        }
    }
});

// drop a single instance of a scorecard
const dropScorecardInstance = new ValidatedMethod({
    name: 'matsMethods.dropScorecardInstance',
    validate: new SimpleSchema({
        userName: {
            type: String
        },
        name: {
            type: String
        },
        submittedTime: {
            type: String
        },
        processedAt: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            return _dropScorecardInstance(params.userName, params.name, params.submittedTime, params.processedAt);
        }
    }
});

//administration tools
const emailImage = new ValidatedMethod({
    name: 'matsMethods.emailImage',
    validate: new SimpleSchema({
        imageStr: {
            type: String
        },
        toAddress: {
            type: String
        },
        subject: {
            type: String
        }
    }).validator(),
    run(params) {
        var imageStr = params.imageStr;
        var toAddress = params.toAddress;
        var subject = params.subject;
        if (!Meteor.userId()) {
            throw new Meteor.Error(401, "not-logged-in");
        }
        var fromAddress = Meteor.user().services.google.email;
        // these come from google - see
        // http://masashi-k.blogspot.fr/2013/06/sending-mail-with-gmail-using-xoauth2.html
        //http://stackoverflow.com/questions/24098461/nodemailer-gmail-what-exactly-is-a-refresh-token-and-how-do-i-get-one/24123550

        // the gmail account for the credentials is mats.mail.daemon@gmail.com - pwd mats2015!
        //var clientId = "339389735380-382sf11aicmgdgn7e72p4end5gnm9sad.apps.googleusercontent.com";
        //var clientSecret = "7CfNN-tRl5QAL595JTW2TkRl";
        //var refresh_token = "1/PDql7FR01N2gmq5NiTfnrT-OlCYC3U67KJYYDNPeGnA";
        var credentials = matsCollections.Credentials.findOne({
            name: "oauth_google"
        }, {
            clientId: 1,
            clientSecret: 1,
            refresh_token: 1
        });
        var clientId = credentials.clientId;
        var clientSecret = credentials.clientSecret;
        var refresh_token = credentials.refresh_token;

        var smtpTransporter;
        try {
            smtpTransporter = Nodemailer.createTransport("SMTP", {
                service: "Gmail",
                auth: {
                    XOAuth2: {
                        user: "mats.gsd@noaa.gov",
                        clientId: clientId,
                        clientSecret: clientSecret,
                        refreshToken: refresh_token
                    }
                }
            });

        } catch (e) {
            throw new Meteor.Error(401, "Transport error " + e.message());
        }
        try {
            var mailOptions = {
                sender: fromAddress,
                replyTo: fromAddress,
                from: fromAddress,
                to: toAddress,
                subject: subject,
                attachments: [{
                    filename: "graph.png",
                    contents: new Buffer(imageStr.split("base64,")[1], "base64")
                }]
            };

            smtpTransporter.sendMail(mailOptions, function (error, response) {
                if (error) {
                    console.log("smtpTransporter error " + error + " from:" + fromAddress + " to:" + toAddress);
                } else {
                    console.log(response + " from:" + fromAddress + " to:" + toAddress);
                }
                smtpTransporter.close();
            });
        } catch (e) {
            throw new Meteor.Error(401, "Send error " + e.message());
        }
        return false;
    }
});

// administation tool
const getAuthorizations = new ValidatedMethod({
    name: 'matsMethods.getAuthorizations',
    validate: new SimpleSchema({}).validator(),
    run() {
        var roles = [];
        if (Meteor.isServer) {
            var userEmail = Meteor.user().services.google.email.toLowerCase();
            roles = matsCollections.Authorization.findOne({
                email: userEmail
            }).roles;
        }
        return roles;
    }
});

// administration tool

const getRunEnvironment = new ValidatedMethod({
    name: 'matsMethods.getRunEnvironment',
    validate: new SimpleSchema({}).validator(),
    run() {
        return Meteor.settings.public.run_environment;
    }
});

const getDefaultGroupList = new ValidatedMethod({
    name: 'matsMethods.getDefaultGroupList',
    validate: new SimpleSchema({}).validator(),
    run() {
        return matsTypes.DEFAULT_GROUP_LIST;
    }
});

// retrieves the saved query results (or downsampled results)
const getGraphData = new ValidatedMethod({
    name: 'matsMethods.getGraphData',
    validate: new SimpleSchema({
        plotParams: {
            type: Object,
            blackbox: true
        },
        plotType: {
            type: String
        },
        expireKey: {
            type: Boolean
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var plotGraphFunction = matsCollections.PlotGraphFunctions.findOne({
                plotType: params.plotType
            });
            var dataFunction = plotGraphFunction.dataFunction;
            var ret;
            try {
                var hash = require('object-hash');
                var key = hash(params.plotParams);
                if (process.env.NODE_ENV === "development" || params.expireKey) {
                    matsCache.expireKey(key);
                }
                var results = matsCache.getResult(key);
                if (results === undefined) {
                    // results aren't in the cache - need to process data routine
                    const Future = require('fibers/future');
                    var future = new Future();
                    global[dataFunction](params.plotParams, function (results) {
                        ret = _saveResultData(results);
                        future["return"](ret);
                    });
                    return future.wait();
                } else { // results were already in the matsCache (same params and not yet expired)
                    // are results in the downsampled collection?
                    var dsResults = DownSampleResults.findOne({
                        key: key
                    }, {}, {
                        disableOplog: true
                    });
                    if (dsResults !== undefined) {
                        // results are in the mongo cache downsampled collection - returned the downsampled graph data
                        ret = dsResults;
                        // update the expire time in the downsampled collection - this requires a new Date
                        DownSampleResults.rawCollection().update({
                            key: key
                        }, {
                            $set: {
                                "createdAt": new Date()
                            }
                        });
                    } else {
                        ret = results; // {key:someKey, result:resultObject}
                        // refresh expire time. The only way to perform a refresh on matsCache is to re-save the result.
                        matsCache.storeResult(results.key, results);
                    }
                    var sizeof = require('object-sizeof');
                    console.log("result.data size is ", sizeof(results));
                    return ret;
                }
            } catch (dataFunctionError) {
                if (dataFunctionError.toLocaleString().indexOf("INFO:") !== -1) {
                    throw new Meteor.Error(dataFunctionError.message);
                } else {
                    throw new Meteor.Error("Error in getGraphData function:" + dataFunction + " : " + dataFunctionError.message);
                }
            }
        }
    }
});

// retrieves the saved query results (or downsampled results) for a specific key
const getGraphDataByKey = new ValidatedMethod({
    name: 'matsMethods.getGraphDataByKey',
    validate: new SimpleSchema({
        resultKey: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var ret;
            var key = params.resultKey;
            try {
                var dsResults = DownSampleResults.findOne({
                    key: key
                }, {}, {
                    disableOplog: true
                });
                if (dsResults !== undefined) {
                    ret = dsResults;
                } else {
                    ret = matsCache.getResult(key); // {key:someKey, result:resultObject}
                }
                var sizeof = require('object-sizeof');
                console.log("getGraphDataByKey results size is ", sizeof(dsResults));
                return ret;
            } catch (error) {
                throw new Meteor.Error("Error in getGraphDataByKey function:" + key + " : " + error.message);
            }
        }
    }
});

const getLayout = new ValidatedMethod({
    name: 'matsMethods.getLayout',
    validate: new SimpleSchema({
        resultKey: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var ret;
            var key = params.resultKey;
            try {
                ret = LayoutStoreCollection.rawCollection().findOne({
                    key: key
                });
                return ret;
            } catch (error) {
                throw new Meteor.Error("Error in getLayout function:" + key + " : " + error.message);
            }
        }
    }
});

const getScorecardSettings = new ValidatedMethod({
    name: 'matsMethods.getScorecardSettings',
    validate: new SimpleSchema({
        settingsKey: {
            type: String
        }
    }).validator(),
    async run(params) {
        if (Meteor.isServer) {
            let ret;
            let key = params.settingsKey;
            try {
                // global cbScorecardSettingsPool
                const rv = await cbScorecardSettingsPool.getCB(key);
                return { scorecardSettings: rv.content } ;
                // return {scorecardSettings: '{"appName":"Surface","dateRange":"01/14/2023 20:00 - 02/13/2023 20:00","curve0DataSource":"RAP_OPS","curve1DataSource":"RAP_OPS_130","commonCurveParams":{"region":"Eastern RUC domain","statistic":"Bias (Model - Obs)","variable":"10m wind","threshold":"undefined","scale":"undefined","truth":"undefined","forecast-length":"6","forecast-type":"undefined","valid-time":"undefined","level":"undefined"}}'};
            } catch (error) {
                throw new Meteor.Error("Error in getScorecardSettings function:" + key + " : " + error.message);
            }
        }
    }
});


/*
getPlotResult is used by the graph/text_*_output templates which are used to display textual results.
Because the data isn't being rendered graphically this data is always full size, i.e. NOT downsampled.
That is why it only finds it in the Result file cache, never the DownSampleResult collection.

Because the dataset can be so large ... e.g. megabytes the data retrieval is pagenated. The index is
applied to the underlying datasets.The data gets stripped down and flattened to only contain the data neccesary for text presentation.
A new page index of -1000 means get all the data i.e. no pagenation.
 */
const getPlotResult = new ValidatedMethod({
    name: 'matsMethods.getPlotResult',
    validate: new SimpleSchema({
        resultKey: {
            type: String
        },
        pageIndex: {
            type: Number
        },
        newPageIndex: {
            type: Number
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var rKey = params.resultKey;
            var pi = params.pageIndex;
            var npi = params.newPageIndex;
            var ret = {};
            try {
                ret = _getFlattenedResultData(rKey, pi, npi);
            } catch (e) {
                console.log(e);
            }
            return ret;
        }
    }
});

const getReleaseNotes = new ValidatedMethod({
    name: 'matsMethods.getReleaseNotes',
    validate: new SimpleSchema({}).validator(),
    run() {
        //     return Assets.getText('public/MATSReleaseNotes.html');
        // }
        if (Meteor.isServer) {
            var future = require('fibers/future');
            var fse = require('fs-extra');
            var dFuture = new future();
            var fData;
            var file;
            if (process.env.NODE_ENV === "development") {
                file = process.env.PWD + "/../../MATScommon/meteor_packages/mats-common/public/MATSReleaseNotes.html";
            } else {
                file = process.env.PWD + "/programs/server/assets/packages/randyp_mats-common/public/MATSReleaseNotes.html";
            }
            try {
                fse.readFile(file, 'utf8', function (err, data) {
                    if (err) {
                        fData = err.message;
                        dFuture["return"]();
                    } else {
                        fData = data;
                        dFuture["return"]();
                    }
                });
            } catch (e) {
                fData = e.message;
                dFuture["return"]();
            }
            dFuture.wait();
            return fData;
        }
    }
});

const getScorecardData = new ValidatedMethod({
    name: 'matsMethods.getScorecardData',
    validate: new SimpleSchema({
        userName: {
            type: String
        },
        name: {
            type: String
        },
        submitted: {
            type: String
        },
        processedAt: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            return _getScorecardData(params.userName, params.name, params.submitted, params.processedAt);
        }
    }
});

const getScorecardInfo = new ValidatedMethod({
    name: 'matsMethods.getScorecardInfo',
    validate: new SimpleSchema({}).validator(),
    run() {
        if (Meteor.isServer) {
            return _getScorecardInfo();
        }
    }
});

// administration tool
const getUserAddress = new ValidatedMethod({
    name: 'matsMethods.getUserAddress',
    validate: new SimpleSchema({}).validator(),
    run() {
        if (Meteor.isServer) {
            return Meteor.user().services.google.email.toLowerCase();
        }
    }
});

// app utility
const insertColor = new ValidatedMethod({
    name: 'matsMethods.insertColor',
    validate: new SimpleSchema({
        newColor: {
            type: String
        },
        insertAfterIndex: {
            type: Number
        }
    }).validator(),
    run(params) {
        if (params.newColor == "rgb(255,255,255)") {
            return false;
        }
        var colorScheme = matsCollections.ColorScheme.findOne({});
        colorScheme.colors.splice(params.insertAfterIndex, 0, newColor);
        matsCollections.update({}, colorScheme);
        return false;
    }
});


// administration tool
const readFunctionFile = new ValidatedMethod({
    name: 'matsMethods.readFunctionFile',
    validate: new SimpleSchema({}).validator(),
    run() {
        if (Meteor.isServer) {
            var future = require('fibers/future');
            var fse = require('fs-extra');
            var path = "";
            var fData;
            if (type == "data") {
                path = "/web/static/dataFunctions/" + file;
                console.log('exporting data file: ' + path);
            } else if (type == "graph") {
                path = "/web/static/displayFunctions/" + file;
                console.log('exporting graph file: ' + path);
            } else {
                return ("error - wrong type");
            }
            fse.readFile(path, function (err, data) {
                if (err) throw err;
                fData = data.toString();
                future["return"](fData);
            });
            return future.wait();
        }
    }
});

// refreshes the metadata for the app that's running
const refreshMetaData = new ValidatedMethod({
    name: 'matsMethods.refreshMetaData',
    validate: new SimpleSchema({}).validator(),
    run() {
        if (Meteor.isServer) {
            try {
                //console.log("GUI asked to refresh metadata");
                _checkMetaDataRefresh();
            } catch (e) {
                console.log(e);
                throw new Meteor.Error("Server error: ", e.message);
            }
        }
        return metaDataTableUpdates.find({}).fetch();
    }
});

// administation tool
const removeAuthorization = new ValidatedMethod({
    name: 'matsMethods.removeAuthorization',
    validate: new SimpleSchema({
        settings: {
            type: Object,
            blackbox: true
        }
    }).validator(),
    run(settings) {
        if (Meteor.isServer) {
            var email;
            var roleName;
            var userRoleName = settings.userRoleName;
            var authorizationRole = settings.authorizationRole;
            var newUserEmail = settings.newUserEmail;
            var existingUserEmail = settings.existingUserEmail;
            if (authorizationRole) {
                // existing role - the role roleName - no need to verify as the selection list came from the database
                roleName = authorizationRole;
            } else if (userRoleName) {
                roleName = userRoleName;
            }
            if (existingUserEmail) {
                email = existingUserEmail;
            } else {
                email = newUserEmail;
            }

            // if user and role remove the role from the user
            if (email && roleName) {
                matsCollections.Authorization.update({
                    email: email
                }, {
                    $pull: {
                        roles: roleName
                    }
                });
            }
            // if user and no role remove the user
            if (email && !roleName) {
                matsCollections.Authorization.remove({
                    email: email
                });
            }
            // if role and no user remove role and remove role from all users
            if (roleName && !email) {
                // remove the role
                matsCollections.Roles.remove({
                    name: roleName
                });
                // remove the roleName role from all the authorizations
                matsCollections.Authorization.update({
                    roles: roleName
                }, {
                    $pull: {
                        roles: roleName
                    }
                }, {
                    multi: true
                });
            }
            return false;
        }
    }
});

// app utility
const removeColor = new ValidatedMethod({
    name: 'matsMethods.removeColor',
    validate: new SimpleSchema({
        removeColor: {
            type: String
        }
    }).validator(),
    run(removeColor) {
        var colorScheme = matsCollections.ColorScheme.findOne({});
        var removeIndex = colorScheme.colors.indexOf(removeColor);
        colorScheme.colors.splice(removeIndex, 1);
        matsCollections.ColorScheme.update({}, colorScheme);
        return false;
    }
});

// database controls
const removeDatabase = new ValidatedMethod({
    name: 'matsMethods.removeDatabase',
    validate: new SimpleSchema({
        dbName: {
            type: String
        }
    }).validator(),
    run(dbName) {
        if (Meteor.isServer) {
            matsCollections.Databases.remove({
                name: dbName
            });
        }
    }
});

const applySettingsData = new ValidatedMethod({
    name: 'matsMethods.applySettingsData',
    validate: new SimpleSchema({
        settings: {
            type: Object,
            blackbox: true
        }
    }).validator(),
    // this method forces a restart on purpose. We do not want retries
    applyOptions: {
        noRetry: true,
    },
    run(settingsParam) {
        if (Meteor.isServer) {
            // Read the existing settings file
            const settings = settingsParam.settings;
            console.log("applySettingsData - matsCollections.appName.findOne({}) is ", matsCollections.appName.findOne({}));
            const appName = matsCollections.Settings.findOne({}).appName;
            _write_settings(settings, appName);
            // in development - when being run by meteor, this should force a restart of the app.
            //in case I am in a container - exit and force a reload
            console.log('applySettingsData - process.env.NODE_ENV is: ' + process.env.NODE_ENV);
            if (process.env.NODE_ENV != "development") {
                console.log("applySettingsData - exiting after writing new Settings");
                process.exit(0);
            }
        }
    }
});

// makes sure all of the parameters display appropriate selections in relation to one another
// for default settings ...
const resetApp = async function (appRef) {
    if (Meteor.isServer) {
        var fse = require('fs-extra');
        const metaDataTableRecords = appRef.appMdr;
        const appPools = appRef.appPools;
        const type = appRef.appType;
        const scorecard = Meteor.settings.public.scorecard ? Meteor.settings.public.scorecard : false;
        const dbType = appRef.dbType ? appRef.dbType : matsTypes.DbTypes.mysql;
        const appName = Meteor.settings.public.app ? Meteor.settings.public.app : "unnamed";
        const appTitle = Meteor.settings.public.title ? Meteor.settings.public.title : "Unnamed App";
        const appGroup = Meteor.settings.public.group ? Meteor.settings.public.group : "Misc. Apps";
        const thresholdUnits = Meteor.settings.public.threshold_units ? Meteor.settings.public.threshold_units : {};
        var appDefaultGroup = "";
        var appDefaultDB = "";
        var appDefaultModel = "";
        var appColor;
        switch (type) {
            case matsTypes.AppTypes.mats:
                if (dbType === matsTypes.DbTypes.couchbase) {
                    appColor = "#33abbb";
                } else {
                    appColor = Meteor.settings.public.color ? Meteor.settings.public.color : "#3366bb";
                }
                break;
            case matsTypes.AppTypes.metexpress:
                appColor = Meteor.settings.public.color ? Meteor.settings.public.color : "darkorchid";
                appDefaultGroup = Meteor.settings.public.default_group ? Meteor.settings.public.default_group : "NO GROUP";
                appDefaultDB = Meteor.settings.public.default_db ? Meteor.settings.public.default_db : "mv_default";
                appDefaultModel = Meteor.settings.public.default_model ? Meteor.settings.public.default_model : "Default";
                break;
        }
        const appTimeOut = Meteor.settings.public.mysql_wait_timeout ? Meteor.settings.public.mysql_wait_timeout : 300;
        var dep_env = process.env.NODE_ENV;
        var curve_params = Meteor.settings.public.curve_params ? Meteor.settings.public.curve_params : [];
        var apps_to_score;
        if (Meteor.settings.public.scorecard) {
            apps_to_score = Meteor.settings.public.apps_to_score ? Meteor.settings.public.apps_to_score : [];
        }
        var mapboxKey = "undefined";

        // see if there's any messages to display to the users
        const appMessage = Meteor.settings.public.alert_message ? Meteor.settings.public.alert_message : undefined;

        // set meteor settings defaults if they do not exist
        if (isEmpty(Meteor.settings.private) || isEmpty(Meteor.settings.public)) {
            // create some default meteor settings and write them out
            var homeUrl = "";
            if (process.env.ROOT_URL == undefined) {
                homeUrl = "https://localhost/home";
            } else {
                var homeUrlArr = process.env.ROOT_URL.split('/');
                homeUrlArr.pop();
                homeUrl = homeUrlArr.join('/') + "/home";
            }
            const settings = {
                "private": {
                    "databases": [],
                    "PYTHON_PATH": "/usr/bin/python3",
                    "MAPBOX_KEY": mapboxKey
                },
                "public": {
                    "run_environment": dep_env,
                    "curve_params": curve_params,
                    "apps_to_score": apps_to_score,
                    "default_group": appDefaultGroup,
                    "default_db": appDefaultDB,
                    "default_model": appDefaultModel,
                    "proxy_prefix_path": "",
                    "home": homeUrl,
                    "appName": appName,
                    "mysql_wait_timeout": appTimeOut,
                    "group": appGroup,
                    "app_order": 1,
                    "title": appTitle,
                    "color": appColor,
                    "threshold_units": thresholdUnits
                }
            };
            _write_settings(settings, appName); // this is going to cause the app to restart in the meteor development environment!!!
            // exit for production - probably won't ever get here in development mode (running with meteor)
            // This depends on whatever system is running the node process to restart it.
            console.log('resetApp - exiting after creating default settings');
            process.exit(1);
        }

        // mostly for running locally for debugging. We have to be able to choose the app from the app list in deployment.json
        // normally (on a server) it will be an environment variable.
        // to debug an integration or production deployment, set the environment variable deployment_environment to one of
        // development, integration, production, metexpress
        if (Meteor.settings.public && Meteor.settings.public.run_environment) {
            dep_env = Meteor.settings.public.run_environment;
        } else {
            dep_env = process.env.NODE_ENV;
        }
        // get the mapbox key out of the settings file, if it exists
        if (Meteor.settings.private && Meteor.settings.private.MAPBOX_KEY) {
            mapboxKey = Meteor.settings.private.MAPBOX_KEY;
        }
        delete Meteor.settings.public.undefinedRoles;
        for (var pi = 0; pi < appPools.length; pi++) {
            const record = appPools[pi];
            const poolName = record.pool;
            // if the database credentials have been set in the meteor.private.settings file then the global[poolName]
            // will have been defined in the app main.js. Otherwise it will not have been defined.
            // If it is undefined (requiring configuration) we will skip it but add
            // the corresponding role to Meteor.settings.public.undefinedRoles -
            // which will cause the app to route to the configuration page.
            if (global[poolName] == undefined) {
                console.log("resetApp adding " + global[poolName] + "to undefined roles");
                // There was no pool defined for this poolName - probably needs to be configured so stash the role in the public settings
                if (Meteor.settings.public.undefinedRoles == undefined) {
                    Meteor.settings.public.undefinedRoles = [];
                }
                Meteor.settings.public.undefinedRoles.push(record.role);
                continue;
            }
            try {
                if (dbType === matsTypes.DbTypes.couchbase) {
                    //simple couchbase test
                    const time = await cbPool.queryCB("select NOW_MILLIS() as time;");
                    break;
                } else {
                    // default to mysql so that old apps won't break
                    global[poolName].on('connection', function (connection) {
                        connection.query('set group_concat_max_len = 4294967295');
                        connection.query('set session wait_timeout = ' + appTimeOut);
                        //("opening new " + poolName + " connection");
                    });
                }
            } catch (e) {
                console.log(poolName + ":  not initialized-- could not open connection: Error:" + e.message);
                Meteor.settings.public.undefinedRoles = Meteor.settings.public.undefinedRoles == undefined ? [] : Meteor.settings.public.undefinedRoles == undefined;
                Meteor.settings.public.undefinedRoles.push(record.role);
                continue
            }
            // connections all work so make sure that Meteor.settings.public.undefinedRoles is undefined
            delete Meteor.settings.public.undefinedRoles;
        }
        // just in case - should never happen.
        if (Meteor.settings.public.undefinedRoles && Meteor.settings.public.undefinedRoles.length > 1) {
            throw new Meteor.Error("dbpools not initialized " + Meteor.settings.public.undefinedRoles);
        }

        // Try getting version from env
        let {
            version: appVersion,
            commit: commit,
            branch: branch
        } = versionInfo.getVersionsFromEnv();
        if (appVersion === 'Unknown') {
            // Try getting versionInfo from the appProduction database
            console.log("VERSION not set in the environment - using localhost")
            appVersion = "localhost";
            commit = "HEAD";
        }
        const appType = type ? type : matsTypes.AppTypes.mats;

        // remember that we updated the metadata tables just now - create metaDataTableUpdates
        /*
            metaDataTableUpdates:
            {
                name: dataBaseName,
                tables: [tableName1, tableName2 ..],
                lastRefreshed : timestamp
            }
         */
        // only create metadata tables if the resetApp was called with a real metaDataTables object
        if (metaDataTableRecords instanceof matsTypes.MetaDataDBRecord) {
            var metaDataTables = metaDataTableRecords.getRecords();
            for (var mdti = 0; mdti < metaDataTables.length; mdti++) {
                const metaDataRef = metaDataTables[mdti];
                metaDataRef.lastRefreshed = moment().format();
                if (metaDataTableUpdates.find({name: metaDataRef.name}).count() == 0) {
                    metaDataTableUpdates.update({
                        name: metaDataRef.name
                    }, metaDataRef, {
                        upsert: true
                    });
                }
            }
        } else {
            throw new Meteor.Error("Server error: ", "resetApp: bad pool-database entry");
        }
        // invoke the standard common routines
        matsCollections.Roles.remove({});
        matsDataUtils.doRoles();
        matsCollections.Authorization.remove({});
        matsDataUtils.doAuthorization();
        matsCollections.Credentials.remove({});
        matsDataUtils.doCredentials();
        matsCollections.PlotGraphFunctions.remove({});
        matsCollections.ColorScheme.remove({});
        matsDataUtils.doColorScheme();
        matsCollections.Settings.remove({});
        matsDataUtils.doSettings(appTitle, dbType, appVersion, commit, appName, appType, mapboxKey, appDefaultGroup, appDefaultDB, appDefaultModel, thresholdUnits, appMessage, scorecard);
        matsCollections.PlotParams.remove({});
        matsCollections.CurveTextPatterns.remove({});
        // get the curve params for this app out of the settings file
        if (Meteor.settings.public && Meteor.settings.public.curve_params) {
            curve_params = Meteor.settings.public.curve_params;
            matsCollections.CurveParamsInfo.remove({});
            matsCollections.CurveParamsInfo.insert({
                "curve_params": curve_params
            });
            for (var cp = 0; cp < curve_params.length; cp++) {
                if (matsCollections[curve_params[cp]] !== undefined) {
                    matsCollections[curve_params[cp]].remove({});
                }
            }
        } else {
            throw new Meteor.Error("curve_params are not initialized in app settings--cannot build selectors");
        }
        // if this is a scorecard also get the apps to score out of the settings file
        if (Meteor.settings.public && Meteor.settings.public.scorecard) {
            if (Meteor.settings.public.apps_to_score) {
                apps_to_score = Meteor.settings.public.apps_to_score;
                matsCollections.AppsToScore.remove({});
                matsCollections.AppsToScore.insert({
                    "apps_to_score": apps_to_score
                });
            } else {
                throw new Meteor.Error("apps_to_score are not initialized in app settings--cannot build selectors");
            }
        }
        // invoke the app specific routines
        //const asrKeys = Object.keys(appSpecificResetRoutines);
        const asrKeys = appSpecificResetRoutines;
        for (var ai = 0; ai < asrKeys.length; ai++) {
            global.appSpecificResetRoutines[ai]();
        }
        matsCache.clear();
    }
};

const saveLayout = new ValidatedMethod({
    name: 'matsMethods.saveLayout',
    validate: new SimpleSchema({
        resultKey: {
            type: String
        },
        layout: {
            type: Object,
            blackbox: true
        },
        curveOpsUpdate: {
            type: Object,
            blackbox: true
        },
        annotation: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var key = params.resultKey;
            var layout = params.layout;
            var curveOpsUpdate = params.curveOpsUpdate;
            var annotation = params.annotation;
            try {
                LayoutStoreCollection.upsert({
                    key: key
                }, {
                    $set: {
                        "createdAt": new Date(),
                        layout: layout,
                        curveOpsUpdate: curveOpsUpdate,
                        annotation: annotation
                    }
                });
            } catch (error) {
                throw new Meteor.Error("Error in saveLayout function:" + key + " : " + error.message);
            }
        }
    }
});

const saveScorecardSettings = new ValidatedMethod({
    name: 'matsMethods.saveScorecardSettings',
    validate: new SimpleSchema({
        settingsKey: {
            type: String
        },
        scorecardSettings: {
            type: String
        }
    }).validator(),
    run(params) {
        if (Meteor.isServer) {
            var key = params.settingsKey;
            var scorecardSettings = params.scorecardSettings;
            try {
                // TODO - remove after tests
                console.log("saveScorecardSettings(" + key + "):\n" + JSON.stringify(scorecardSettings, null, 2)); 
                // global cbScorecardSettingsPool
                (async function (id, doc) {
                    cbScorecardSettingsPool.upsertCB(id, doc);
                  })(key, scorecardSettings).then(() => {
                    console.log("upserted doc with id", key);
                  });
                  // await cbScorecardSettingsPool.upsertCB(settingsKey, scorecardSettings);
                } catch (err) {
                  console.log(`error writing scorecard to database: ${err.message}`);
                }
            }
        }
});

//administration tools
const saveSettings = new ValidatedMethod({
    name: 'matsMethods.saveSettings',
    validate: new SimpleSchema({
        saveAs: {
            type: String
        },
        p: {
            type: Object,
            blackbox: true
        },
        permission: {
            type: String
        }
    }).validator(),
    run(params) {
        var user = "anonymous";
        matsCollections.CurveSettings.upsert({
            name: params.saveAs
        }, {
            created: moment().format("MM/DD/YYYY HH:mm:ss"),
            name: params.saveAs,
            data: params.p,
            owner: Meteor.userId() == null ? "anonymous" : Meteor.userId(),
            permission: params.permission,
            savedAt: new Date(),
            savedBy: Meteor.user() == null ? "anonymous" : user
        });
    }
});

/* test methods */

const testGetMetaDataTableUpdates = new ValidatedMethod({
    name: 'matsMethods.testGetMetaDataTableUpdates',
    validate: new SimpleSchema({}).validator(),
    run() {
        return metaDataTableUpdates.find({}).fetch();
    }
});

const testGetTables = new ValidatedMethod({
    name: 'matsMethods.testGetTables',
    validate: new SimpleSchema({
        host: {
            type: String
        },
        port: {
            type: String
        },
        user: {
            type: String
        },
        password: {
            type: String
        },
        database: {
            type: String
        }
    }).validator(),
    async run(params) {
        if (Meteor.isServer) {
            if (matsCollections.Settings.findOne().dbType === matsTypes.DbTypes.couchbase) {
                const cbUtilities = new matsCouchbaseUtils.CBUtilities(params.host, params.bucket, params.user, params.password);
                try {
                    const result = await cbUtilities.queryCB("select NOW_MILLIS() as time");
                } catch (err) {
                    throw new Meteor.Error(e.message);
                }
            } else {
                // default to mysql so that old apps won't break
                const Future = require('fibers/future');
                const queryWrap = Future.wrap(function (callback) {
                    const connection = mysql.createConnection({
                        host: params.host,
                        port: params.port,
                        user: params.user,
                        password: params.password,
                        database: params.database
                    });
                    connection.query("show tables;", function (err, result) {
                        if (err || result === undefined) {
                            //return callback(err,null);
                            return callback(err, null);
                        }
                        const tables = result.map(function (a) {
                            return a;
                        });

                        return callback(err, tables);
                    });
                    connection.end(function (err) {
                        if (err) {
                            console.log("testGetTables cannot end connection");
                        }
                    });
                });
                try {
                    return queryWrap().wait();
                } catch (e) {
                    throw new Meteor.Error(e.message);
                }
            }
        }
    }
});

const testSetMetaDataTableUpdatesLastRefreshedBack = new ValidatedMethod({
    name: 'matsMethods.testSetMetaDataTableUpdatesLastRefreshedBack',
    validate: new SimpleSchema({}).validator(),
    run() {
        var mtu = metaDataTableUpdates.find({}).fetch();
        var id = mtu[0]._id;
        metaDataTableUpdates.update({
            _id: id
        }, {
            $set: {
                lastRefreshed: 0
            }
        });
        return metaDataTableUpdates.find({}).fetch();
    }
});
export default matsMethods = {
    addSentAddress: addSentAddress,
    applyAuthorization: applyAuthorization,
    applyDatabaseSettings: applyDatabaseSettings,
    applySettingsData: applySettingsData,
    deleteSettings: deleteSettings,
    dropScorecardInstance: dropScorecardInstance,
    emailImage: emailImage,
    getAuthorizations: getAuthorizations,
    getRunEnvironment: getRunEnvironment,
    getDefaultGroupList: getDefaultGroupList,
    getGraphData: getGraphData,
    getGraphDataByKey: getGraphDataByKey,
    getLayout: getLayout,
    getScorecardSettings: getScorecardSettings,
    getPlotResult: getPlotResult,
    getReleaseNotes: getReleaseNotes,
    getScorecardInfo: getScorecardInfo,
    getScorecardData: getScorecardData,
    getUserAddress: getUserAddress,
    insertColor: insertColor,
    readFunctionFile: readFunctionFile,
    refreshMetaData: refreshMetaData,
    removeAuthorization: removeAuthorization,
    removeColor: removeColor,
    removeDatabase: removeDatabase,
    resetApp: resetApp,
    saveLayout: saveLayout,
    saveScorecardSettings: saveScorecardSettings,
    saveSettings: saveSettings,
    testGetMetaDataTableUpdates: testGetMetaDataTableUpdates,
    testGetTables: testGetTables,
    testSetMetaDataTableUpdatesLastRefreshedBack: testSetMetaDataTableUpdatesLastRefreshedBack
};