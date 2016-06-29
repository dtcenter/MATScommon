// use future to wait for the query callback to complete
var queryDB = function (statement, validTimeStr, statisticSelect, label) {
    var dFuture = new Future();
    var d = [];  // d will contain the curve data
    var error = "";
    sumPool.query(statement, function (err, rows) {
            // query callback - build the curve data from the results - or set an error
            if (err != undefined) {
                error = err.message;
                dFuture['return']();
            } else if (rows === undefined || rows.length === 0) {
                error = 'No data to plot: ' + err;
                // done waiting - error condition
                dFuture['return']();
            } else {
                for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                    var avVal = Number(rows[rowIndex].avVal);
                    var stat = rows[rowIndex].stat;
                    var sub_values = rows[rowIndex].sub_values0.toString().split(',').map(Number);
                    var sub_secs = rows[rowIndex].sub_secs0.toString().split(',').map(Number);
                    d.push([stat,avVal,-1,sub_values,sub_secs]); // -1 is a placeholder for the stde_betsy value
                }// end of loop row
            }
            // done waiting - have results
            dFuture['return']();
        }
    );
    // wait for future to finish
    dFuture.wait();
    return d;   // [sub_values,sub_secs] as arrays
};

var get_err = function (sub_val_array, sub_secs_array) {
    var n = sub_val_array.length;
    var n_good =0;
    var sum_d=0;
    var sum2_d =0;
    for(var i=0; i< n; i++ ){
        n_good = n_good +1;
        sum_d = sum_d + sub_val_array[i];
        sum2_d = sum2_d + sub_val_array[i] * sub_val_array[i];
    }
    var d_mean = sum_d/n_good;
    var sd2 = sum2_d/n_good - d_mean *d_mean;
    var sd = Math.sqrt(sd2);
    // find minimum delta_time, if any value missing, set null
    var last_secs = -1e30;
    var min_delta = 1e30;
    var min_secs = 1e30;
    var max_secs = -1e30;

    for(i=0; i< sub_secs_array.length; i++){
        var secs = (sub_secs_array[i]);
        var delta = secs - last_secs;
        if(delta < min_delta) {
            min_delta = delta;
        }
        if(secs < min_secs) {
            min_secs = secs;
        }
        if(secs >max_secs) {
            max_secs = secs;
        }
        last_secs = secs;
    }

    var data_wg =[];
    var n_gaps =0;
    var loopTime =min_secs;

    while (loopTime < max_secs+1) {

        if(sub_secs_array.indexOf(loopTime)<0){
            data_wg.push(null);
            n_gaps = n_gaps+1;
        } else{
            var d_idx = sub_secs_array.indexOf(loopTime);
            data_wg.push(sub_val_array[d_idx]);
        }
        loopTime = loopTime + min_delta;
    }

    var r =[];
    for(var lag=0;lag<=1; lag++) {
        r[lag] = 0;
        var n_in_lag = 0;
        for (var t = 0; t < n - lag; t++) {
            if (data_wg[t] != null && data_wg[t + lag] != null) {
                r[lag] = r[lag] + (data_wg[t] - d_mean) * (data_wg[t + lag] - d_mean);
                n_in_lag++;
            }
        }
        if (n_in_lag > 0 && sd > 0) {
            r[lag] = r[lag] / (n_in_lag * sd * sd);
        } else {
            r[lag] = null;
        }
    }
    // Betsy Weatherhead's correction, based on lag 1
    if(r[1] >= 1) {
        r[1] = .99999;
    }
    var betsy = Math.sqrt((n_good-1)*(1. - r[1]));
    var stde_betsy;
    if(betsy != 0) {
        stde_betsy = sd/betsy;
    } else {
        stde_betsy = null;
    }
    return {d_mean:d_mean,stde_betsy:stde_betsy,n_good:n_good,lag1:r[1]};
};

dataProfileZoom = function(plotParams, plotFunction) {
    var dateConvert = function (dStr) {
        if (dStr === undefined || dStr === " ") {
            var now = new Date();
            var date = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
            var yr = date.getFullYear();
            var day = date.getDate();
            var month = date.getMonth();
            var dstr = yr + "-" + month + '-' + day;
            return dstr;
        }
        var dateArray = dStr.split('/');
        var month = dateArray[0];
        var day = dateArray[1];
        var yr = dateArray[2];
        var dstr = yr + "-" + month + '-' + day;
        return dstr;
    };

    //console.log(plotParams);
    var fromDateStr = plotParams.fromDate;
    var fromDate = dateConvert(fromDateStr);
    var toDateStr = plotParams.toDate;
    var toDate = dateConvert(toDateStr);
    var matching = plotParams.plotAction === PlotActions.matched;
    var error = "";
    var curves = plotParams.curves;
    var curvesLength = curves.length;
    var dataset = [];
    var variableStatSet = Object.create(null);
    for (var curveIndex = 0; curveIndex < curvesLength; curveIndex++) {
        var curve = curves[curveIndex];
        var diffFrom = curve.diffFrom; // [minuend, subtrahend]
        var label = curve['label'];

        //var model = curve['model'];
        //var region = curve['region'].replace(/^.*mapped to: /, "").replace(')', ''); // have to use the mapped value....

        var model = CurveParams.findOne({name: 'model'}).optionsMap[curve['model']][0];
        var region = CurveParams.findOne({name: 'region'}).optionsMap[curve['region']][0];

        var curveDatesDateRangeFrom = dateConvert(curve['curve-dates-dateRange-from']);
        var curveDatesDateRangeTo = dateConvert(curve['curve-dates-dateRange-to']);
        var top = curve['top'];
        var bottom = curve['bottom'];
        var color = curve['color'];
        var variableStr = curve['variable'];
        var variableOptionsMap = CurveParams.findOne({name: 'variable'}, {optionsMap: 1})['optionsMap'];
        var variable = variableOptionsMap[variableStr];
        var statisticSelect = curve['statistic'];
        var statisticOptionsMap = CurveParams.findOne({name: 'statistic'}, {optionsMap: 1})['optionsMap'];
        var statistic;
        if (variableStr == 'winds') {
            statistic = statisticOptionsMap[statisticSelect][1];
        } else {
            statistic = statisticOptionsMap[statisticSelect][0];
        }
        statistic = statistic + "," + statisticOptionsMap[statisticSelect][2];
        statistic = statistic.replace(/\{\{variable0\}\}/g, variable[0]);
        statistic = statistic.replace(/\{\{variable1\}\}/g, variable[1]);
        var validTimeStr = curve['valid time'];
        var validTimeOptionsMap = CurveParams.findOne({name: 'valid time'}, {optionsMap: 1})['optionsMap'];
        var validTime = validTimeOptionsMap[validTimeStr][0];
        var forecastLength = curve['forecast length'];
        // variableStat is used to determine which axis a curve should use.
        // This variableStatSet object is used like a set and if a curve has the same
        // variable and statistic (variableStat) it will use the same axis,
        // The axis number is assigned to the variableStatSet value, which is the variableStat.
        var variableStat = variableStr + ":" + statisticSelect;
        curves[curveIndex].variableStat = variableStat; // stash the variableStat to use it later for axis options
        var d = [];
        if (diffFrom == null) {
            // this is a database driven curve, not a difference curve
            var statement = "select  -m0.mb10*10 as avVal, " +
                "count(distinct unix_timestamp(m0.date)+3600*m0.hour) as N_times, " +
                "min(unix_timestamp(m0.date)+3600*m0.hour) as min_secs, " +
                "max(unix_timestamp(m0.date)+3600*m0.hour) as max_secs, " +
                "{{statistic}} " +
                "from {{model}} as m0 " +
                "where 1=1 " +
                "{{validTime}} " +
                "and m0.fcst_len = {{forecastLength}} " +
                "and m0.mb10 >= {{top}}/10. " +
                "and m0.mb10 <= {{bottom}}/10. " +
                "and m0.date >= '{{fromDate}}' " +
                "and m0.date <= '{{toDate}}' " +
                "group by avVal " +
                "order by avVal" +
                ";";

            // build the query
            statement = statement.replace('{{model}}', model + '_Areg' + region);
            statement = statement.replace('{{top}}', top);
            statement = statement.replace('{{bottom}}', bottom);
            statement = statement.replace('{{fromDate}}', curveDatesDateRangeFrom);
            statement = statement.replace('{{toDate}}', curveDatesDateRangeTo);
            statement = statement.replace('{{statistic}}', statistic); // statistic replacement has to happen first
            statement = statement.replace('{{validTime}}', validTime);
            statement = statement.replace('{{forecastLength}}', forecastLength);
            console.log("query=" + statement);
            d = queryDB(statement, validTimeStr, statisticSelect, label);
        } else {
            // this is a difference curve
            var minuendIndex = diffFrom[0];
            var subtrahendIndex = diffFrom[1];
            var minuendData = dataset[minuendIndex].data;
            var subtrahendData = dataset[subtrahendIndex].data;

            // do the differencing
            //[stat,avVal,sub_values,sub_secs] -- avVal is pressure level
            var l = minuendData.length < subtrahendData.length?minuendData.length:subtrahendData.length;
            for (var i = 0; i < l; i++) { // each pressure level
                d[i] = [];
                d[i][3] = [];
                d[i][4] = [];
                // pressure level
                d[i][1] = subtrahendData[i][1];
                // values diff
                d[i][0] = minuendData[i][0] - subtrahendData[i][0];
                // do the subValues
                var minuendDataSubValues =   minuendData[i][3];
                var minuendDataSubSeconds =   minuendData[i][4];
                var subtrahendDataSubValues =   subtrahendData[i][3];
                var subtrahendDataSubSeconds =   subtrahendData[i][4];
                // find the intersection of the subSeconds
                var secondsIntersection = _.intersection(minuendDataSubSeconds,subtrahendDataSubSeconds);
                for (var siIndex=0; siIndex<secondsIntersection.length-1;siIndex++) {
                    d[i][4].push(secondsIntersection[siIndex]);
                    d[i][3].push(minuendDataSubValues[siIndex] - subtrahendDataSubValues[siIndex]);
                }
            }
        }


        var pointSymbol = "circle";
        switch (curveIndex % 5) {
            case 0:
                pointSymbol = "circle";
                break;
            case 1:
                pointSymbol = "square";
                break;
            case 2:
                pointSymbol = "diamond";
                break;
            case 3:
                pointSymbol = "triangle";
                break;
            case 4:
                pointSymbol = "cross";
                break;
        }
        var yAxisIndex = 1;
        if (variableStat in variableStatSet) {
            yAxisIndex = variableStatSet[variableStat].index;
            variableStatSet[variableStat].label = variableStatSet[variableStat].label + " | " + label;
        } else {
            variableStatSet[variableStat] = {index: curveIndex + 1, label: label};
        }

        var options = {
            yaxis: variableStatSet[variableStat].index,
            label: label,
            color: color,
            data: d,
            points: {
                symbol: pointSymbol,
                fillColor: color,
                show: true,
                errorbars: "x",
                xerr: {
                    show: true,
                    asymmetric: false,
                    upperCap: "-",
                    lowerCap: "-",
                    color: color,
                    radius: null
                }
            },
            lines: {
                show: true,
                fill: false
            }
        };
        dataset.push(options);
    }

    // match the data by subseconds
    // build an array of sub_second arrays
    // data is [stat,avVal,sub_values,sub_secs]
    if (matching) {
        var subSecs = [];
        for (curveIndex = 0; curveIndex < curvesLength; curveIndex++) { // every curve
            var data = dataset[curveIndex].data;
            for (var di = 0; di < data.length; di++) { // every pressure level
                var sub_secs = data[di][4];
                subSecs.push(sub_secs);
            }
        }

        var subSecIntersection = _.intersection.apply(this,subSecs);
        //console.log ("_.intersection subSecIntersection " +  subSecIntersection);
        //
        //var res = subSecs.shift().filter(function(v) {
        //    return subSecs.every(function(a) {
        //        return a.indexOf(v) !== -1;
        //    });
        //});
        //console.log ("manual subSecIntersection " +  res);


    }

    // calculate stats for each dataset matching to subsec_intersection if matching is specified
    for (curveIndex = 0; curveIndex < curvesLength; curveIndex++) { // every curve
        data = dataset[curveIndex].data;
        for (di = 0; di < data.length; di++) { // every pressure level
            sub_secs = data[di][4];
            var subValues = data[di][3];
            var errorResult = {};
            if (matching) {
                var newSubValues = [];
                for (var subSecIntersectionIndex = 0; subSecIntersectionIndex < subSecIntersection.length; subSecIntersectionIndex++) {
                    var secsIndex = sub_secs.indexOf(subSecIntersection[subSecIntersectionIndex]);
                    var newVal = subValues[secsIndex];
                    if (newVal === undefined || newVal == 0) {
                        console.log("bad newVal: " + newVal);
                        console.log ("found undefined at level: " + di + " curveIndex:" + curveIndex + " and secsIndex:" + subSecIntersection[subSecIntersectionIndex] + " subSecIntersectionIndex:" + subSecIntersectionIndex );
                    } else {
                        newSubValues.push(newVal);
                    }
                }
                data[di][3] = newSubValues;
                data[di][4] = subSecIntersection;
            }
            errorResult = get_err(data[di][3], data[di][4]);
            // already have [stat,pl,subval,subsec]
            // want - [stat,pl,subval,{subsec,std_betsy,d_mean,n_good,lag1},tooltiptext
            //data[di] = [errorResult.d_mean, errorResult.stde_betsy, errorResult.n_good, errorResult.lag1];
            data[di][2] = errorResult.stde_betsy;
            data[di][5] = {
                d_mean: errorResult.d_mean,
                stde_betsy: errorResult.stde_betsy,
                n_good: errorResult.n_good,
                lag1: errorResult.lag1
            };
            data[di][6] = label +
                "<br>" + -data[di][1] + "mb" +
                "<br> " + statisticSelect + ":" + data[di][0].toPrecision(4) +
                "<br>  stde:" + errorResult.stde_betsy.toPrecision(4) +
                "<br>  mean:" + errorResult.d_mean.toPrecision(4) +
                "<br>  n:" + errorResult.n_good +
                "<br>  lag1:" + errorResult.lag1.toPrecision(4);
        }
    }


    // generate y-axis
    var yaxes = [];
    var yaxis = [];
    for (var dsi=0; dsi<dataset.length; dsi++) {
        var position = dsi===0?"left":"right";
        var yaxesOptions = {
            position: position,
            color: 'grey',
            axisLabel: 'Pressure (hPa)',
            axisLabelColour: "black",
            axisLabelUseCanvas: true,
            axisLabelFontSizePixels: 16,
            axisLabelFontFamily: 'Verdana, Arial',
            axisLabelPadding: 3,
            alignTicksWithAxis: 1,
            ticks:[[-1000,1000],[-900,900],[-800,800],[-700,700],[-600,600],[-500,500],[-400,400],[-300,300],[-200,200],[-100,100],[0,0]]
        };
        var yaxisOptions = {
            zoomRange: [0.1,10]
        };
        yaxes.push(yaxesOptions);
        yaxis.push(yaxisOptions);
    }

    var pOptions = {
        axisLabels: {
            show: true
        },
        xaxes:[{
            axisLabel: variableStatSet[variableStat].label + " : " + variableStat,
            color: 'grey'
        }],
        xaxis: {
            zoomRange: [0.1,10]
        },
        yaxes:yaxes,
        yaxis:yaxis,

        legend: {
            show: false,
            container:"#legendContainer",
            noColumns: 0
        },
        series: {
            lines: {
                show: true,
                lineWidth:Settings.findOne({},{fields:{lineWidth:1}}).lineWidth
            },
            points: {
                show: true
            },
            shadowSize: 0
        },
        zoom: {
            interactive: true
        },
        pan: {
            interactive: false
        },
        selection: {
            mode: "xy"
        },
        grid: {
            hoverable: true,
            borderWidth: 3,
            mouseActiveRadius: 50,
            backgroundColor: "white",
            axisMargin: 20
        },
        tooltip: true,
        tooltipOpts: {
            // the ct value is the third [2] element of the data series for profiles. This is the tooltip content.
            content: "<span style='font-size:150%'><strong>%ct</strong></span>"
        }
    };

    // add black 0 line curve
    dataset.push(dataZero = {color:'black',points:{show:false},data:[[0,-1000,"zero"],[0,-100,"zero"]]});
    var result = {
        error: error,
        data: dataset,
        options: pOptions
    };
    plotFunction(result);
};
