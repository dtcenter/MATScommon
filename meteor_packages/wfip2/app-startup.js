var modelOptionsMap ={};
var regionOptionsMap ={};
var siteOptionsMap ={};
var siteMarkerOptionsMap ={};
var descriptorOptionsMap ={};
var upperOptionsMap = {};
var lowerOptionsMap = {};
var forecastLengthOptionsMap = {};

scatter2dParams = function() {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Scatter2dParams.remove({});
    }
// remove for production
    Scatter2dParams.remove({});
    if (Scatter2dParams.find().count() == 0) {
        Scatter2dParams.insert(
            {
                name: 'scatter2d',
                type: InputTypes.radioGroup,
                options: ['xaxis', 'yaxis'],
                selected: 'matching',
                controlButtonCovered: true,
                default: 'xaxis',
                controlButtonVisibility: 'block',
                displayOrder: 1,
                displayPriority: 1,
                displayGroup: 1
            });
    }
};

plotParams = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        PlotParams.remove({});
    }
    if (PlotParams.find().count() == 0) {
        var date = new Date();
        var yr = date.getFullYear();
        var day = date.getDate();
        var month = date.getMonth();
        var dstr = month + '/' + day + '/' + yr;

        PlotParams.insert(
            {
                name: 'dates',
                type: InputTypes.dateRange,
                options: [''],
                startDate: '03/01/2015',
                stopDate: dstr,
                controlButtonCovered: true,
                default: '03/01/2015',
                controlButtonVisibility: 'block',
                displayOrder: 1,
                displayPriority: 1,
                displayGroup: 1
            });
        PlotParams.insert(
            {
                name: 'plotQualifier',
                type: InputTypes.radioGroup,
                options: ['matching', 'unmatched', 'pairwise'],
                selected: 'matching',
                controlButtonCovered: true,
                default: 'matching',
                controlButtonVisibility: 'block',
                displayOrder: 2,
                displayPriority: 100,
                displayGroup: 1
            });

        PlotParams.insert(
            {
                name: 'plotFormat',
                type: InputTypes.radioGroup,
                options: ['show matching diffs','pairwise diffs', 'no diffs'],
                default: 'no diffs',
                controlButtonCovered: false,
                controlButtonVisibility: 'block',
                displayOrder: 3,
                displayPriority: 1,
                displayGroup: 2
            });
    }
    return dstr;
};

curveParams = function () {
    //console.log(JSON.stringify(modelOptiosMap));
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        CurveParams.remove({});
    }

    // remove for production
    CurveParams.remove({});
    if (CurveParams.find().count() == 0) {
        var date = new Date();
        var yr = date.getFullYear();
        var day = date.getDate();
        var month = date.getMonth();
        var dstr = month + '/' + day + '/' + yr;
        var optionsMap = {};
        CurveParams.insert(
            {
                name: 'label',
                type: InputTypes.textInput,
                optionsMap:optionsMap,
                options:Object.keys(optionsMap),   // convenience
                controlButtonCovered: true,
                default: '',
                unique: true,
                controlButtonVisibility: 'block',
                displayOrder: 1,
                displayPriority: 1,
                displayGroup: 1
            }
        );
        CurveParams.insert(
            {
                name: 'data source',
                type: InputTypes.select,
                optionsMap:modelOptionsMap,
                options:Object.keys(modelOptionsMap),   // convenience
                optionsQuery:"select model from regions_per_model_mats",
                dependentNames: ["sites","forecast length"],
                controlButtonCovered: true,
                default: 'hrrr_esrl',
                unique: false,
                controlButtonVisibility: 'block',
                displayOrder: 2,
                displayPriority: 1,
                displayGroup: 2
            });



        CurveParams.insert(
            {
                name: 'region',
                type: InputTypes.select,
                optionsMap:regionOptionsMap,
                options:Object.keys(regionOptionsMap),   // convenience
                controlButtonCovered: true,
                unique: false,
                default: regionOptionsMap[Object.keys(regionOptionsMap)[0]],
                controlButtonVisibility: 'block',
                displayOrder: 3,
                displayPriority: 1,
                displayGroup: 2
            });

        CurveParams.insert(
            {
                name: 'sites',
                type: InputTypes.select,
                optionsMap:siteOptionsMap,
                options:siteOptionsMap[Object.keys(siteOptionsMap)[0]],
                peerName: 'sitesMap',    // name of the select parameter that is going to be set by selecting from this map
                superiorName: 'data source',
                controlButtonCovered: true,
                unique: false,
                default: siteOptionsMap[Object.keys(siteOptionsMap)[0]][0],
                controlButtonVisibility: 'block',
                displayOrder: 4,
                displayPriority: 1,
                displayGroup: 3,
                multiple: true
            });

        CurveParams.insert(
            {
                name: 'sitesMap',
                type: InputTypes.selectMap,
                optionsMap:siteMarkerOptionsMap,
                options:Object.keys(siteMarkerOptionsMap),   // convenience
                peerName: 'sites',    // name of the select parameter that is going to be set by selecting from this map
                controlButtonCovered: true,
                unique: false,
                default: siteMarkerOptionsMap[Object.keys(siteMarkerOptionsMap)[0]],
                controlButtonVisibility: 'block',
                displayOrder: 5,
                displayPriority: 1,
                displayGroup: 3,
                multiple: true,
                defaultMapView: {point:[45.904233, -120.814632], zoomLevel:8, minZoomLevel:4, maxZoomLevel:13}
            });



        optionsMap = {wind_speed:['ws'], wind_direction:['wd']};
        CurveParams.insert(
            {
                name: 'variable',
                type: InputTypes.select,
                optionsMap: optionsMap,
                options:Object.keys(optionsMap),   // convenience
                controlButtonCovered: true,
                unique: false,
                default: 'wind_speed',
                controlButtonVisibility: 'block',
                displayOrder: 6,
                displayPriority: 1,
                displayGroup: 4
            });

        optionsMap = {};
        CurveParams.insert(
            {
                name: 'forecast length',
                type: InputTypes.select,
                optionsMap:forecastLengthOptionsMap,
                options:Object.keys(forecastLengthOptionsMap[Object.keys(forecastLengthOptionsMap)[0]]),   // convenience
                superiorName: 'model',
                selected: '',
                controlButtonCovered: true,
                unique: false,
                default: Object.keys(forecastLengthOptionsMap[Object.keys(forecastLengthOptionsMap)[0]])[0],
                controlButtonVisibility: 'block',
                displayOrder: 7,
                displayPriority: 1,
                displayGroup: 4
            });

        CurveParams.insert(
            {
                name: 'top',
                type: InputTypes.numberSpinner,
                optionsMap:optionsMap,
                options:Object.keys(optionsMap),   // convenience
                min: '0',
                max: '5000',
                step: '20',
                controlButtonCovered: true,
                unique: false,
                default: '5000',
                controlButtonVisibility: 'block',
                displayOrder: 8,
                displayPriority: 1,
                displayGroup: 5
            });
        CurveParams.insert(
            {
                name: 'bottom',
                type: InputTypes.numberSpinner,
                optionsMap:optionsMap,
                options:Object.keys(optionsMap),   // convenience
                min: '0',
                max: '5000',
                step: '20',
                controlButtonCovered: true,
                unique: false,
                default: '0',
                controlButtonVisibility: 'block',
                displayOrder: 9,
                displayPriority: 1,
                displayGroup: 5
            });

        CurveParams.insert(
            {
               // name: 'descriptors',
                name: 'discriminator',
                type: InputTypes.select,
                optionsMap:descriptorOptionsMap,
                options:Object.keys(descriptorOptionsMap),   // convenience
                dependentNames: ['upper','lower'],
                controlButtonCovered: true,
                unique: false,
                default: Object.keys(descriptorOptionsMap)[0],
                controlButtonVisibility: 'block',
                displayOrder: 10,
                displayPriority: 1,
                displayGroup: 6
            });


        CurveParams.insert(
            {
                name: 'upper',
                type: InputTypes.numberSpinner,
                optionsMap:upperOptionsMap,
                options:Object.keys(upperOptionsMap),   // convenience
                superiorName: 'descriptors',
                min: upperOptionsMap[Object.keys(upperOptionsMap)[0]].min,
                max: upperOptionsMap[Object.keys(upperOptionsMap)[0]].max,
                step: upperOptionsMap[Object.keys(upperOptionsMap)[0]].step,
                controlButtonCovered: true,
                unique: false,
                default: upperOptionsMap[Object.keys(upperOptionsMap)[0]].max,
                controlButtonVisibility: 'block',
                displayOrder: 11,
                displayPriority: 1,
                displayGroup: 7
            });

        CurveParams.insert(
            {
                name: 'lower',
                type: InputTypes.numberSpinner,
                optionsMap:lowerOptionsMap,
                options:Object.keys(lowerOptionsMap),   // convenience
                superiorName: 'descriptors',
                min: lowerOptionsMap[Object.keys(lowerOptionsMap)[0]].min,
                max: lowerOptionsMap[Object.keys(lowerOptionsMap)[0]].max,
                step: lowerOptionsMap[Object.keys(lowerOptionsMap)[0]].step,
                controlButtonCovered: true,
                unique: false,
                default: lowerOptionsMap[Object.keys(lowerOptionsMap)[0]].min,
                controlButtonVisibility: 'block',
                displayOrder: 12,
                displayPriority: 1,
                displayGroup: 7
            });

        CurveParams.insert(
            {
                name: 'curve-dates',
                type: InputTypes.dateRange,
                optionsMap:optionsMap,
                options:Object.keys(optionsMap),   // convenience
                startDate: '03/01/2015',
                stopDate: dstr,
                controlButtonCovered: true,
                unique: false,
                default: '03/01/2015',
                controlButtonVisibility: 'block',
                displayOrder: 13,
                displayPriority: 1,
                displayGroup: 8
            });
    }
};

/* The format of a curveTextPattern is an array of arrays, each sub array has
 [labelString, localVariableName, delimiterString]  any of which can be null.
 Each sub array will be joined (the localVariableName is always dereferenced first)
 and then the sub arrays will be joined maintaining order.

 The curveTextPattern is found by its name which must match the corresponding PlotGraphFunctions.PlotType value.
 See curve_item.js and graph.js.
 */
curveTextPatterns = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        CurveTextPatterns.remove({});
    }
    if (CurveTextPatterns.find().count() == 0) {
        CurveTextPatterns.insert({
            plotType: PlotTypes.timeSeries,
            textPattern: [
                ['', 'label', ': '],
                ['', 'data source', ':'],
                [' region:', 'regionName', ', '],
                [' sites:', 'sites', ', '],
                ['', 'variable', ', '],
                [' top:', 'top', 'm, '],
                [' bottom:', 'bottom', 'm, '],
                [' upper:', 'upper', ', '],
                [' lower:', 'lower', ', '],
                ['fcst_len:', 'forecast length', 'h ']
            ]
        });
        CurveTextPatterns.insert({
            plotType: PlotTypes.profile,
            textPattern: [
                ['', 'label', ': '],
                ['', 'data source', ':'],
                ['', 'regionName', ', '],
                ['', 'sites', ', '],
                ['', 'variable', ' '],
                [' top:', 'top', 'm, '],
                [' bottom:', 'bottom', 'm, '],
                [' upper:', 'upper', ', '],
                [' lower:', 'lower', ', '],
                ['fcst_len:', 'forecast length', 'h '],
                ['','curve-dates-dateRange-from','to'],
                ['','curve-dates-dateRange-to','']
            ]
        });
        CurveTextPatterns.insert({
            plotType: PlotTypes.scatter2d,
            textPattern: [
                ['', 'label', ': '],
                ['', 'xaxis-data source', ':'],
                ['', 'xaxis-region', ', '],
                ['', 'xaxis-sites', ', '],
                ['', 'xaxis-variable', ' '],
                ['fcst_len:', 'xaxis-forecast length', 'h '],
                ['', 'yaxis-data source', ':'],
                ['', 'yaxis-region', ', '],
                ['', 'yaxis-sites', ', '],
                ['', 'yaxis-variable', ' '],
                ['fcst_len:', 'yaxis-forecast length', 'h '],
                ['','curve-dates-dateRange-from','to'],
                ['','curve-dates-dateRange-to','']
            ]
        });
    }
};

savedCurveParams = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        SavedCurveParams.remove({});
    }
    if (SavedCurveParams.find().count() == 0) {
        SavedCurveParams.insert({clName: 'changeList', changeList:[]});
    }
};

settings = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        if (Settings.findOne({}) && Settings.findOne({}).resetFromCode) {
            var resetFromCode = Settings.findOne({}).resetFromCode;
        } else {
            resetFromCode = false;
        }
        Settings.remove({});
    }
    if (Settings.find().count() == 0) {
        Settings.insert({
            LabelPrefix: "C-",
            Title: "WFIP2",
            LineWidth: 3.5,
            NullFillString: "---",
           // resetFromCode: resetFromCode
            resetFromCode: true
        });
    }
};

colorScheme = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        ColorScheme.remove({});
    }
    if (ColorScheme.find().count() == 0) {
        ColorScheme.insert({
            colors: [
                "rgb(255,102,102)",
                "rgb(102,102,255)",
                "rgb(255,153,102)",
                "rgb(153,153,153)",
                "rgb(210,130,130)",

                "rgb(245,92,92)",
                "rgb(92,92,245)",
                "rgb(245,143,92)",
                "rgb(143,143,143)",
                "rgb(200,120,120)",

                "rgb(235,92,92)",
                "rgb(82,92,245)",
                "rgb(235,143,92)",
                "rgb(133,143,143)",
                "rgb(190,120,120)",

                "rgb(225,82,92)",
                "rgb(72,82,245)",
                "rgb(225,133,92)",
                "rgb(123,133,143)",
                "rgb(180,120,120)"
            ]
        });
    }
};

plotGraph = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        PlotGraphFunctions.remove({});
    }
//remove for production
PlotGraphFunctions.remove({});
    if (PlotGraphFunctions.find().count() == 0) {
        PlotGraphFunctions.insert({
            plotType: PlotTypes.timeSeries,
            graphFunction: "graphSeriesZoom",
            dataFunction: "dataSeriesZoom",
            checked:true
        });
        PlotGraphFunctions.insert({
            plotType: PlotTypes.profile,
            graphFunction: "graphProfileZoom",
            dataFunction: "dselect valid_utc as avtime ,z ,ws,sites_siteid  from hrrr_esrl_nwp, nwp_recs   where nwps_nwpid=4 and nwp_recs_nwprecid=nwprecid and valid_utc >=1463810400 and valid_utc<=1466402400 and fcst_end_utc=0ataProfileZoom",
            checked: false
        });
        PlotGraphFunctions.insert({
            plotType: PlotTypes.scatter2d,
            graphFunction: "graph2dScatter",
            dataFunction: "data2dScatter",
            checked: false
        });
    }
};

credentials = function () {
// the gmail account for the credentials is mats.mail.daemon@gmail.com - pwd mats2015!
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Credentials.remove({});
    }
    if (Credentials.find().count() == 0) {
        Credentials.insert({
            name: "oauth_google",
            clientId: "499180266722-aai2tddo8s9edv4km1pst88vebpf9hec.apps.googleusercontent.com",
            clientSecret: "xdU0sc7SbdOOEzSyID_PTIRE",
            refresh_token: "1/3bhWyvCMMfwwDdd4F3ftlJs3-vksgg7G8POtiOBwYnhIgOrJDtdun6zK6XiATCKT"
        });
    }
};

authorization = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Authorization.remove({});
    }
    if (Authorization.find().count() == 0) {
        Authorization.insert({email: "randy.pierce@noaa.gov", roles: ["administrator"]});
        Authorization.insert({email: "xue.wei@noaa.gov", roles: ["administrator"]});
        Authorization.insert({email: "jeffrey.a.hamilton@noaa.gov", roles: ["administrator"]});
    }
    Authorization.upsert({email: "mats.gsd@noaa.gov"},{$set: {roles: ["administrator"]}});
};

roles = function () {
    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Roles.remove({});
    }
    if (Roles.find().count() == 0) {
        Roles.insert({name: "administrator", description: "administrator privileges"});
    }
};

var containsPoint = function(pointArray,point) {
    var lat = point[0];
    var lon = point[1];
    for (var i =0; i < pointArray.length; i++) {
        var pLat = pointArray[i][0];
        var pLon = pointArray[i][1];
        if (lat === pLat && lon === pLon) {
            return true
        }
    }
    return false;
};
    

Meteor.startup(function () {
    Future = Npm.require('fibers/future');

    if (Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Databases.remove({});
    }
// remove for production
Databases.remove({});

    if (Databases.find().count() == 0) {
        Databases.insert({
            name:"wfip2Setting",
            role: "wfip2_data",
            status: "active",
            //host        : 'wfip2-db.gsd.esrl.noaa.gov',
            //user        : 'dev',
            //password    : 'Pass4userdev*',

           host        : 'wfip2-dmzdb.gsd.esrl.noaa.gov',
           user        : 'readonly',
           password    : 'Readonlyp@$$405',
           database    : 'WFIP2',
           connectionLimit : 10
        });
    }

    var wfip2Settings = Databases.findOne({role:"wfip2_data",status:"active"},{host:1,user:1,password:1,database:1,connectionLimit:1});
    wfip2Pool = mysql.createPool(wfip2Settings);
    wfip2Pool.on('connection', function (connection) {
        connection.query('set group_concat_max_len = 4294967295')
    });
    try {

        var statement = "select model,regions,model_value from regions_per_model_mats";
        var qFuture = new Future();

        wfip2Pool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {
                Models.remove({});
                for (var i = 0; i < rows.length; i++) {
                    var model = rows[i].model.trim();
                  //  var regions = rows[i].regions;
                    var model_values = rows[i].model_value.split(',');
                    var table_name = model_values[0];
                    var instruments_instrid = model_values[1];
                  //  var regionMapping = "Areg";
                 //   if (model=="NAM" || model=="isoRR1h" || model=="isoRRrapx" || model=="isoBak13"){
                  //      regionMapping = "reg";
                  //  }
                    var valueList = [];
                    valueList.push(table_name+','+instruments_instrid);
                    modelOptionsMap[model] = valueList;
                  //  var tablevalueList = [];
                   // tablevalueList.push(table_name);
                    Models.insert({name: model, table_name: table_name,instruments_instrid:instruments_instrid});
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        console.log(err.message);
    }

    try {
        var statement = "SELECT siteid, name,description,lat,lon,elev FROM sites;";
        var qFuture = new Future();
        wfip2Pool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                console.log('No data in database ' + wfip2Settings.database + "! query:" + statement);
            } else {
                siteMarkerOptionsMap = [];
                siteOptionsMap.model = [];
                siteOptionsMap.sodar = [];
                siteOptionsMap.profiler_915 = [];

                var points = [];
                for (var i = 0; i < rows.length; i++) {
                    var name = rows[i].name;
                    var description = rows[i].description;
                    var lat = rows[i].lat;
                    var lon = rows[i].lon;
                    if (lon > 180) {
                        lon = lon - 360;
                    }
                    var point = [lat, lon ];
                    // move slightly north if another marker occupies this location
                    if (containsPoint(points,point)) {
                        lat = lat + 0.002;
                        point = [lat, lon];
                    }
                    points.push(point);
                    var elev = rows[i].elev;
                    if (description.includes("SODAR")) {
                        var obj = {point:point,elevation:elev, options:{title:description, color:"red", size:20, network:"SODAR", peerOption:name, highLightColor:'pink'}};
                        siteMarkerOptionsMap.push(obj);
                        siteOptionsMap.model.push(name);
                        siteOptionsMap.sodar.push(name);
                    } else {
                        var obj = {point:point,elevation:elev, options:{title:description, color:"blue", size:20, network:"PROFILE", peerOption:name, highLightColor:'cyan'}};
                        siteMarkerOptionsMap.push(obj);
                        siteOptionsMap.model.push(name);
                        siteOptionsMap.profiler_915.push(name);
                    }
                }
                var modelNames = Models.find({},{fields:{'name':1, '_id': 0}}).fetch();
                for (var i=0; i < modelNames.length; i++) {
                    var mName = modelNames[i].name;
                    var mNameUpper = mName.toUpperCase();
                    if (((mNameUpper).indexOf('SODAR') === -1) && ((mNameUpper).indexOf('PROFILE') === -1)) {
                        siteOptionsMap[mName] = siteOptionsMap['model'];
                    }
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        Console.log(err.message);
    }

    try {
        //var statement = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE  TABLE_NAME = 'hrrr_wfip_discriminator';";
        var statement = "select * from discriminator_range;";
        var qFuture = new Future();
        wfip2Pool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                //console.log('No data in database ' + uaSettings.database + "! query:" + statement);
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {
                //RangePerDescriptor.remove({});
                for (var i = 0; i < rows.length; i++) {
                    var descriptor = rows[i].name;
                    var min_value = rows[i].min_value;
                    var max_value = rows[i].max_value;
                    descriptorOptionsMap[descriptor] = descriptor;
                    var step = "any";
                    upperOptionsMap[descriptor] = {min:min_value,max:max_value,step:step,default:max_value};
                    lowerOptionsMap[descriptor] = {min:min_value,max:max_value,step:step,default:min_value};
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        Console.log(err.message);
    }

    try {
        var statement = "SELECT model, fcst_lens FROM fcst_lens_per_model;";
        var qFuture = new Future();
        wfip2Pool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {
                for (var i = 0; i < rows.length; i++) {
                     var model = rows[i].model;
                     var forecastLengths = rows[i].fcst_lens;
                    forecastLengthOptionsMap[model] = forecastLengths.split(',');
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        Console.log(err.message);
    }

    try {
        var statement = "select regionMapTable,description from region_descriptions_mats;";
        var qFuture = new Future();
       wfip2Pool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {
                RegionDescriptions.remove({});
                for (var i = 0; i < rows.length; i++) {
                    var regionMapTable = (rows[i].regionMapTable);
                    var description = rows[i].description;
                    var valueList = [];
                    valueList.push(regionMapTable);
                    regionOptionsMap[description] = valueList;
                    RegionDescriptions.insert({regionMapTable: regionMapTable,  description: description});
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        console.log(err.message);
    }

    roles();
    authorization();
    credentials();
    plotGraph();
    colorScheme();
    settings();
    curveParams();
    savedCurveParams();
    plotParams();
    scatter2dParams();
    curveTextPatterns();
});


