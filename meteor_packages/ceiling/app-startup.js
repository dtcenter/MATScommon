var modelOptionsMap ={};
var regionOptionsMap ={};
var forecastLengthOptionsMap = {};
var regionModelOptionsMap = {};

var date = new Date();
var dateOneMonthPrior = new Date();
dateOneMonthPrior.setMonth(dateOneMonthPrior.getMonth() - 1);
var yr = date.getFullYear();
var day = date.getDate();
var month = date.getMonth();
var hour = date.getHours();
var minute = date.getMinutes();
var dstrToday = month + '/' + day + '/' + yr + " " + hour + ":" + minute;
yr = dateOneMonthPrior.getFullYear();
day = dateOneMonthPrior.getDate();
month = dateOneMonthPrior.getMonth();
hour = dateOneMonthPrior.getHours();
minute = dateOneMonthPrior.getMinutes();
var dstrOneMonthPrior = month + '/' + day + '/' + yr + " " + hour + ":" + minute;
var dstr = dstrOneMonthPrior + " - " + dstrToday;

plotParams = function () {
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        PlotParams.remove({});
    }
    if (PlotParams.find().count() == 0) {
        PlotParams.insert(
            {
                name: 'dates',
                type: InputTypes.dateRange,
                options: [''],
                startDate: dstrOneMonthPrior,
                stopDate: dstrToday,
                controlButtonCovered: true,
                default: dstr,
                controlButtonVisibility: 'block',
                displayOrder: 1,
                displayPriority: 1,
                displayGroup: 1
            });
        var plotFormats = {};
        plotFormats[PlotFormats.matching] = 'show matching diffs';
        plotFormats[PlotFormats.pairwise] = 'pairwise diffs';
        plotFormats[PlotFormats.none] = 'no diffs';
        PlotParams.insert(
            {
                name: 'plotFormat',
                type: InputTypes.radioGroup,
                optionsMap: plotFormats,
                options: Object.keys(plotFormats),
                default: plotFormats[PlotFormats.none],
                controlButtonCovered: false,
                controlButtonVisibility: 'block',
                displayOrder: 3,
                displayPriority: 1,
                displayGroup: 2
            });
    }
};

curveParams = function () {
    if (process.env.NODE_ENV === "development" ||Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        CurveParams.remove({});
    }
    if (CurveParams.find().count() == 0) {
        CurveParams.insert(
            {
                name: 'label',
                type: InputTypes.textInput,
                optionsMap:{},
                options:[],   // convenience
                controlButtonCovered: true,
                default: '',
                unique: true,
                controlButtonVisibility: 'block',
                displayOrder: 1,
                displayPriority: 1,
                displayGroup: 1,
                help: 'label.html'
            }
        );




        CurveParams.insert(
            {
                name: 'model',
                type: InputTypes.select,
                optionsMap:modelOptionsMap,
                options:Object.keys(modelOptionsMap),   // convenience
                optionsQuery:"select model from regions_per_model",
                dependentNames: ["region", "forecast-length"],
                controlButtonCovered: true,
                default: 'HRRR',
                unique: false,
                controlButtonVisibility: 'block',
                displayOrder: 2,
                displayPriority: 1,
                displayGroup: 1
            });



        CurveParams.insert(
            {
                name: 'region',
                type: InputTypes.select,
                optionsMap:regionModelOptionsMap,
                options:regionModelOptionsMap[Object.keys(regionModelOptionsMap)[0]],   // convenience
                superiorName: 'model',
                controlButtonCovered: true,
                unique: false,
                default: regionModelOptionsMap[Object.keys(regionModelOptionsMap)[0]][0],
                controlButtonVisibility: 'block',
                displayOrder: 3,
                displayPriority: 1,
                displayGroup: 1
            });

        var optionsMap = {

            'TSS (True Skill Score)':['(sum(m0.yy)+0.00)/sum(m0.yy+m0.ny) +(sum(m0.nn)+0.00)/sum(m0.nn+m0.yn) - 1. as stat,' +
            'count(m0.nn)/1000 as N0, avg(m0.yy+m0.ny+0.000)/1000 as Nlow0, avg(m0.yy+m0.ny+m0.yn+m0.nn+0.000)/1000 as N_times'],


            'Bias (Model - RAOB)': ['(sum(m0.yy+m0.yn)+0.00)/sum(m0.yy+m0.ny) as stat,'+'count(m0.nn)/1000 as N0,avg(m0.yy+m0.ny+m0.yn+m0.nn+0.000)/1000 as N_times'],

            'Nlow(metars<thresh,avg per hr)': ['avg(m0.yy+m0.ny+0.000)/1000 as stat,'+'count(m0.nn)/1000 as N0,avg(m0.yy+m0.ny+m0.yn+m0.nn+0.000)/1000 as N_times'],

            'Ntot(total metars,avg per hr)': ['avg(m0.yy+m0.ny+m0.yn+m0.nn+0.000)/1000 as stat,'+'count(m0.nn)/1000 as N0'],

            'Ratio(Nlow/Ntot)': ['sum(m0.yy+m0.ny+0.000)/sum(m0.yy+m0.ny+m0.yn+m0.nn+0.000) as stat,'+'count(m0.nn)/1000 as N0'],
            'PODy (POD of ceil< thresh)':['(sum(m0.yy)+0.00)/sum(m0.yy+m0.ny) as stat,count(m0.nn)/1000 as N0'],
            'PODn (POD of ceil< thresh)':['(sum(m0.yy)+0.00)/sum(m0.yy+m0.yn) as stat,count(m0.nn)/1000 as N0'],
            'FAR(False Alarm Ratio)':['(sum(m0.yn)+0.00)/sum(m0.yn+m0.yy)  as stat,count(m0.nn)/1000 as N0'],
            'N_in_avg(to nearest 100)':['sum(m0.yy+m0.ny+m0.yn+m0.nn+0.000)/100000  as stat,count(m0.nn)/1000 as N0'],
            'ETS (Equitable Treat Score)':[' (sum(m0.yy)-(sum(m0.yy+m0.ny)*sum(m0.yy+m0.yn)/sum(m0.yy+m0.ny+m0.yn+m0.nn))+0.00)/(sum(m0.yy+m0.ny+m0.yn) -(sum(m0.yy+m0.ny)*sum(m0.yy+m0.yn)/sum(m0.yy+m0.ny+m0.yn+m0.nn))) as stat,'+
            'count(m0.nn)/1000 as N0'],
            'CSI(Critical Success Index)':['(sum(m0.yy)+0.00)/sum(m0.yy+m0.ny+m0.yn)  as stat,count(m0.nn)/1000 as N0'],
            'HSS(Heidke Skill Score)':['2*(sum(m0.nn+0.00)*sum(m0.yy) - sum(m0.yn)*sum(m0.ny)) /((sum(m0.nn+0.00)+sum(m0.ny))*(sum(m0.ny)+sum(m0.yy)) +(sum(m0.nn+0.00)+sum(m0.yn))*(sum(m0.yn)+sum(m0.yy))) as stat,'+
                'count(m0.nn)/1000 as N0'],

        };

        CurveParams.insert(
            {// bias and model average are a different formula for wind (element 0 differs from element 1)
                // but stays the same (element 0 and element 1 are the same) otherwise.
                // When plotting profiles we append element 2 to whichever element was chosen (for wind variable). For
                // time series we never append element 2. Element 3 is used to give us error values for error bars.
                name: 'statistic',
                type: InputTypes.select,
                optionsMap:optionsMap,
                options:Object.keys(optionsMap),   // convenience
                controlButtonCovered: true,
                unique: false,
                default: Object.keys(optionsMap)[0],
                controlButtonVisibility: 'block',
                displayOrder: 4,
                displayPriority: 1,
                displayGroup: 2
            });



        optionsMap = {
            '60000 (any clound)': ['6000'],
            '500 (ceiling<500 feet)': ['50'],
            '3000 (ceiling <3000 feet)': ['300'],
            '1000 (ceiling <1000 feet)': ['100']
        };
        CurveParams.insert(
            {
                name: 'threshHold',
                type: InputTypes.select,
                optionsMap: optionsMap,
                options:Object.keys(optionsMap),   // convenience
                controlButtonCovered: true,
                unique: false,
                default: Object.keys(optionsMap)[0],
                controlButtonVisibility: 'block',
                displayOrder: 5,
                displayPriority: 1,
                displayGroup: 2
            });
        optionsMap = {
            'None': ['ceil(3600*floor(m0.time/3600))'],
                '1D': ['ceil(' + 60 * 60 * 24 + '*floor(((m0.time))/' + 60 * 60 * 24 + ')+' + 60 * 60 * 24 + '/2)'],
                '3D': ['ceil(' + 60 * 60 * 24 * 3 + '*floor(((m0.time))/' + 60 * 60 * 24 * 3 + ')+' + 60 * 60 * 24 * 3 + '/2)'],
                '7D': ['ceil(' + 60 * 60 * 24 * 7 + '*floor(((m0.time))/' + 60 * 60 * 24 * 7 + ')+' + 60 * 60 * 24 * 7 + '/2)'],
                '30D': ['ceil(' + 60 * 60 * 24 * 30 + '*floor(((m0.time))/' + 60 * 60 * 24 * 30 + ')+' + 60 * 60 * 24 * 30 + '/2)'],
                '60D': ['ceil(' + 60 * 60 * 24 * 60 + '*floor(((m0.time))/' + 60 * 60 * 24 * 60 + ')+' + 60 * 60 * 24 * 60 + '/2)'],
                '90D': ['ceil(' + 60 * 60 * 24 * 90 + '*floor(((m0.time))/' + 60 * 60 * 24 * 90 + ')+' + 60 * 60 * 24 * 90 + '/2)'],
                '180D': ['ceil(' + 60 * 60 * 24 * 180 + '*floor(((m0.time))/' + 60 * 60 * 24 * 180 + ')+' + 60 * 60 * 24 * 180 + '/2)']
        };
        CurveParams.insert(
            {
                name: 'average',
                type: InputTypes.select,
                optionsMap: optionsMap,
                options:Object.keys(optionsMap),   // convenience
                controlButtonCovered: true,
                unique: false,
                selected: 'None',
                default: 'None',
                controlButtonVisibility: 'block',
                displayOrder: 6,
                displayPriority: 1,
                displayGroup: 3
            });

        CurveParams.insert(
            {
                name: 'forecast-length',
                type: InputTypes.select,
                optionsMap:forecastLengthOptionsMap,
                options:forecastLengthOptionsMap[Object.keys(forecastLengthOptionsMap)[0]],   // convenience
                superiorName: 'model',
                selected: '',
                controlButtonCovered: true,
                unique: false,
                default: forecastLengthOptionsMap[Object.keys(forecastLengthOptionsMap)[0]][0],
                controlButtonVisibility: 'block',
                displayOrder: 7,
                displayPriority: 1,
                displayGroup: 3
            });



       // optionsMap = {'All':[""],0:[' and floor((m0.time)%(24*3600)/3600) in (0)'],6:[6],12:[12],18:[18]};
      //  optionsMap = {'All':[""],0:[0],6:[6],12:[12],18:[18]};
        CurveParams.insert(
            {
                name: 'valid-time',
                type: InputTypes.select,
              //  optionsMap:optionsMap,
             //   options:Object.keys(optionsMap),   // convenience
                options:['All',0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23],
                selected: 'All',
                controlButtonCovered: true,
                unique: false,
                //default: Object.keys(optionsMap)[0],
                default: 'All',
                controlButtonVisibility: 'block',
                displayOrder: 8,
                displayPriority: 1,
                displayGroup: 3,
                multiple: true
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
    if (process.env.NODE_ENV === "development" ||Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        CurveTextPatterns.remove({});
    }
    if (CurveTextPatterns.find().count() == 0) {
        CurveTextPatterns.insert({
            plotType: PlotTypes.timeSeries,
            textPattern: [
                ['', 'label', ': '],
                ['', 'model', ':'],
                ['', 'regionName', ', '],
                ['', 'variable', ' '],
                ['', 'statistic', ' '],
                ['fcst_len:', 'forecast-length', 'h '],
                [' valid-time:', 'valid-time', ' '],
                ['avg:', 'average', ' ']
            ]
        });
        CurveTextPatterns.insert({
            plotType: PlotTypes.profile,
            textPattern: [
                ['', 'label', ': '],
                ['', 'model', ':'],
                ['', 'regionName', ', '],
                ['', 'variable', ' '],
                ['', 'statistic', ' '],
                ['fcst_len:', 'forecast-length', 'h '],
                [' valid-time:', 'valid-time', ' '],
                ['avg:', 'average', ' '],
                ['','curve-dates','']
            ]
        });
    }
};

savedCurveParams = function () {
    if (process.env.NODE_ENV === "development" ||Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        SavedCurveParams.remove({});
    }
    if (SavedCurveParams.find().count() == 0) {
        SavedCurveParams.insert({clName: 'changeList', changeList:[]});
    }
};

settings = function () {
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Settings.remove({});
    }
    if (Settings.find().count() == 0) {
        Settings.insert({
            LabelPrefix: "C-",
            Title: "Ceiling",
            LineWidth: 3.5,
            NullFillString: "---",
            resetFromCode: true
        });
    }
};




colorScheme = function () {
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
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
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        PlotGraphFunctions.remove({});
    }
    if (PlotGraphFunctions.find().count() == 0) {
        PlotGraphFunctions.insert({
            plotType: PlotTypes.timeSeries,
            graphFunction: "graphSeriesZoom",
            dataFunction: "dataSeriesZoom",
            checked:true
        });
    }
};

credentials = function () {
// the gmail account for the credentials is mats.mail.daemon@gmail.com - pwd mats2015!
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
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
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
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
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Roles.remove({});
    }
    if (Roles.find().count() == 0) {
        Roles.insert({name: "administrator", description: "administrator privileges"});
    }
};

Meteor.startup(function () {
    Future = Npm.require('fibers/future');
    if (process.env.NODE_ENV === "development" || Settings.findOne({}) === undefined || Settings.findOne({}).resetFromCode === undefined || Settings.findOne({}).resetFromCode == true) {
        Databases.remove({});
    }
    if (Databases.find().count() == 0) {
        Databases.insert({
            name:"sumSetting",
            role: "sum_data",
            status: "active",
            host        : 'wolphin.fsl.noaa.gov',
            user        : 'writer',
            password    : 'amt1234',
            database    : 'ceiling_sums',
            connectionLimit : 10
        });
        Databases.insert({
            name:"modelSetting",
            role: "model_data",
            status: "active",
            host        : 'wolphin.fsl.noaa.gov',
            user        : 'writer',
            password    : 'amt1234',
            database    : 'ceiling',
            connectionLimit : 10
        });
    }
    

    var sumSettings = Databases.findOne({role:"sum_data",status:"active"},{host:1,user:1,password:1,database:1,connectionLimit:1});
    var modelSettings = Databases.findOne({role:"model_data",status:"active"},{host:1,user:1,password:1,database:1,connectionLimit:1});

   // var myModels = [];
    sumPool = mysql.createPool(sumSettings);
    modelPool = mysql.createPool(modelSettings);

    modelPool.on('connection', function (connection) {
        connection.query('set group_concat_max_len = 4294967295')
    });

    try {
        //var statement = "select table_name from information_schema.tables where table_schema='" + modelSettings.database + "'";
        var statement = "select model,model_value,regions_name from regions_per_model";
        var qFuture = new Future();
        modelPool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {

                for (var i = 0; i < rows.length; i++) {
                    var model = rows[i].model.trim();
                    var regions_name = rows[i].regions_name;
                    var model_value = rows[i].model_value.trim();
                    var valueList = [];
                    valueList.push(model_value);
                    modelOptionsMap[model] = valueList;
                    var regionsArr = regions_name.split(',');
                    regionModelOptionsMap[model] = regionsArr;

                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        console.log(err.message);
    }



    try {
        var statement = "SELECT model, fcst_lens FROM fcst_lens_per_model;";
        var qFuture = new Future();
        modelPool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
            if (err != undefined) {
                console.log(err.message);
            }
            if (rows === undefined || rows.length === 0) {
                //console.log('No data in database ' + uaSettings.database + "! query:" + statement);
                console.log('No data in database ' + modelSettings.database + "! query:" + statement);
            } else {

                for (var i = 0; i < rows.length; i++) {
                    var model = rows[i].model;
                    var forecastLengths = rows[i].fcst_lens;
                    var forecastLengthArr = forecastLengths.split(',');
                    forecastLengthOptionsMap[model] = forecastLengthArr;
                }
            }
            qFuture['return']();
        }));
        qFuture.wait();
    } catch (err) {
        console.log(err.message);
    }



    try {
     var statement = "select id,description,short_name from region_descriptions;";
     var qFuture = new Future();
     modelPool.query(statement, Meteor.bindEnvironment(function (err, rows, fields) {
     if (err != undefined) {
     console.log(err.message);
     }
     if (rows === undefined || rows.length === 0) {
     console.log('No data in database ' + modelSettings.database + "! query:" + statement);
     } else {
         RegionDescriptions.remove({});
        for  (var i = 0; i < rows.length; i++) {
        var regionNumber = rows[i].id;
        var description = rows[i].description;
        var shortName = rows[i].short_name;

        var valueList = [];
        valueList.push(shortName);


        regionOptionsMap[description] = valueList;

        RegionDescriptions.insert({ regionNumber: regionNumber,shortName: shortName, description: description});
     }
     }
     qFuture['return']();
     }));
     qFuture.wait();
     } catch (err) {
     Console.log(err.message);
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
    curveTextPatterns();
});


