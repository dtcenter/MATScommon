
// use future to wait for the query callback to complete
var queryDB = function (statement, validTimeStr,xmin,xmax,interval,averageStr) {
    var dFuture = new Future();
    var d = [];  // d will contain the curve data
    var error = "";
    var N0 = [];
    var N_times = [];

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
            ymin = Number(rows[0].avtime);
            ymax = Number(rows[0].avtime);
            var curveTime=[] ;
            var curveStat =[];
            var N0_max=0;

            for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                var avSeconds = Number(rows[rowIndex].avtime);
                var stat = rows[rowIndex].stat;
                var N0_loop = rows[rowIndex].N0;
                var N_times_loop = rows[rowIndex].N_times;

                if(N0_loop> N0) N0_max=N0_loop;
                if(N_times_loop> N_times) N_times_max=N_times_loop;

                curveTime.push(avSeconds * 1000);
                curveStat.push(stat);
                N0.push(N0_loop);
                N_times.push(N_times_loop);
            }

            if (averageStr != "None") {
                xmin = Number(rows[0].avtime)*1000;
            }
            var loopTime =xmin;

            while (loopTime < xmax+1) {

                if(curveTime.indexOf(loopTime)<0){
                    d.push([loopTime, null]);
                } else{
                    var d_idx = curveTime.indexOf(loopTime);
                    var this_N0 = N0[d_idx];
                    var this_N_times = N_times[d_idx];
                    if (this_N0< 0.1*N0_max || this_N_times < 0.75* N_times_max){
                        d.push([loopTime, null]);

                    }else{
                        d.push([loopTime, curveStat[d_idx]]);
                    }
                }
                loopTime = loopTime + interval;
            }
            // done waiting - have results
            dFuture['return']();
        }
    });
    // wait for future to finish
    dFuture.wait();
    return {data:d,error:error,ymin:ymin,ymax:ymax,N0:N0,N_times:N_times, averageStr:averageStr, interval:interval};
};

dataSeriesZoom = function(plotParams, plotFunction) {
    var dateConvert = function (dStr) {
        if (dStr === undefined || dStr === " ") {
            var now = new Date();
            var date = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
            var date_in_secs = date.getTime();
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
        var date = new Date(yr, month, day);
        var date_in_secs = date.getTime();
        return dstr;

    };

    var secsConvert = function (dStr) {
        if (dStr === undefined || dStr === " ") {
            var now = new Date();
            var date = new Date(now.getUTCFullYear(), now.getUTCMonth()-1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
            var date_in_secs = date.getTime();
            var yr = date.getFullYear();
            var day = date.getDate();
            var month = date.getMonth();
        }
        else {
            var dateArray = dStr.split('/');
            var month = dateArray[0];
            var day = dateArray[1];
            var yr = dateArray[2];

            var my_date = new Date(yr, month-1, day,0);
            // to UTC time, not local time
            var date_in_secs = my_date.getTime();
       }
        // to UTC time, not local time
        return date_in_secs/1000 -3600*6;

    };

    console.log(JSON.stringify(plotParams));
    var fromDateStr = plotParams.fromDate;
    var fromDate = dateConvert(fromDateStr);
    var toDateStr = plotParams.toDate;
    var toDate = dateConvert(toDateStr);
    var fromSecs = secsConvert(fromDateStr);
    var toSecs = secsConvert(toDateStr);
    var weitemp = fromDate.split("-");
    var qxmin = Date.UTC(weitemp[0],weitemp[1]-1,weitemp[2]);
    weitemp = toDate.split("-");
    var qxmax = Date.UTC(weitemp[0],weitemp[1]-1,weitemp[2]);
    var mxmax = qxmax;// used to draw zero line
    var mxmin = qxmin; // used to draw zero line
    var matching = plotParams.plotQualifier === 'matching';
    var pairwise = plotParams.plotQualifier === 'pairwise';
    var error = "";
    var curves = plotParams.curves;
    var curvesLength = curves.length;
    var dataset = [];
    //var variableStatSet = Object.create(null);
    for (var curveIndex = 0; curveIndex < curvesLength; curveIndex++) {
        var curve = curves[curveIndex];
        console.log("curve="+ curve);
        var diffFrom = curve.diffFrom;
        var model = CurveParams.findOne({name:'model'}).optionsMap[curve['model']][0];
        //var region = CurveParams.findOne({name:'region'}).optionsMap[curve['region']][0];
        var region = curve['region'];
        var threshhold = CurveParams.findOne({name:'threshhold'}).optionsMap[curve['threshhold']][0];
        console.log("threshhold="+ threshhold);
        console.log("model="+model);
        console.log("region="+region);
        var label = curve['label'];
        var top = curve['top'];
        var bottom = curve['bottom'];
        var color = curve['color'];
      //  var variableStr = curve['variable'];
       // console.log("variableStr="+variableStr);
       // var variableOptionsMap = CurveParams.findOne({name: 'variable'}, {optionsMap: 1})['optionsMap'];
       // var variable = variableOptionsMap[variableStr];
        var statisticSelect = curve['statistic'];
        // formula depends on stats (rms vs bias), also variables like temperature and dew points need convert from f to c
        console.log("statisticSelect="+statisticSelect);
        var statisticOptionsMap = CurveParams.findOne({name: 'statistic'}, {optionsMap: 1})['optionsMap'];
        console.log("statisticOptionsMap="+statisticOptionsMap);
        var statistic;
        statistic = statisticOptionsMap[statisticSelect][0];
        console.log("statistic="+statistic);
       /* if (variableStr == 'temperature' || variableStr == 'dewpoint' ) {
            statistic = statisticOptionsMap[statisticSelect][0];
        } else if (variableStr == 'wind'  ) {
                statistic = statisticOptionsMap[statisticSelect][2];
        } else {
            statistic = statisticOptionsMap[statisticSelect][1];
        }
        console.log("variableStr2="+variableStr);
        statistic = statistic.replace(/\{\{variable0\}\}/g, variable[0]);
        statistic = statistic.replace(/\{\{variable1\}\}/g, variable[1]);*/
        //var validTimeStr = curve['valid hrs'];
        var validTimeStr = curve['valid time'];
        console.log("validTimeStr="+ validTimeStr);
        var validTimeOptionsMap = CurveParams.findOne({name: 'valid time'}, {optionsMap: 1})['optionsMap'];
        var validTime = validTimeOptionsMap[validTimeStr][0];
        var averageStr = curve['average'];
        var averageOptionsMap = CurveParams.findOne({name: 'average'}, {optionsMap: 1})['optionsMap'];
        var average = averageOptionsMap[averageStr][0];
        var forecastLength = curve['forecast length'];
        // variableStat is used to determine which axis a curve should use.
        // This variableStatSet object is used like a set and if a curve has the same
        // variable and statistic (variableStat) it will use the same axis,
        // The axis number is assigned to the variableStatSet value, which is the variableStat.
       // var variableStat = variableStr + ":" + statisticSelect;
        //curves[curveIndex].variableStat = variableStat; // stash the variableStat to use it later for axis options
        var xmax;
        var ymax;
        var xmin;
        var ymin;
        var interval;
        if (averageStr == "None") {
            if (model.search('FIM')>=0){
                interval = 12 * 3600*1000;
            }
            else if (model.search('GFS')>=0){
                interval = 6 * 3600*1000;
            }
            else if (model.search('RR')>=0){
                interval = 1 * 3600*1000;
            }
        } else{
            var daycount = averageStr.replace("D","");
            interval = daycount*24*3600*1000;
        }
        var d = [];
        if (diffFrom == null) {
                // this is a database driven curve, not a difference curve

            console.log("{{forecastLength}} before query="+ forecastLength);





            statement = "select {{average}} as avtime " +
               " ,min(m0.time) as min_secs"+
               ",max(m0.time) as max_secs"+
                ", {{statistic}} " +
                    "from {{model}}_{{threshhold}}_{{forecastLength}}_{{region}} as m0"+
            " where 1=1" +
                "{{validTime}} " +
            " and m0.yy+m0.ny+m0.yn+m0.nn > 0"+
                " and m0.time >= {{fromSecs}} and m0.time <  {{toSecs}} "+
            " group by avtime" +
            " order by avtime;"

            statement = statement.replace('{{average}}', average);
            statement = statement.replace('{{model}}', model);
            statement = statement.replace('{{threshhold}}', threshhold);
            statement = statement.replace('{{forecastLength}}', forecastLength);
            statement = statement.replace('{{region}}', region);
            statement = statement.replace('{{fromSecs}}', fromSecs);
            statement = statement.replace('{{toSecs}}', toSecs);
            statement = statement.replace('{{statistic}}', statistic);
            statement = statement.replace('{{validTime}}', validTime);

            console.log("query=" + statement);
            var queryResult = queryDB(statement,validTimeStr,qxmin,qxmax,interval,averageStr);
            d = queryResult.data;
            if (d[0] === undefined) {
                error = "No data returned";
            } else {}
            xmin = d[0][0];
            xmax = d[d.length - 1][0];
            mxmax = mxmax > xmax ? xmax : mxmax;
            mxmin = mxmin < xmin ? mxmin : xmin;
            error = queryResult.error;

        } else {
            // this is a difference curve - we are differencing diffFrom[0] - diffFrom[1] based on the
            // time values of whichever has the largest interval
            // find the largest interval between diffFrom[0] curve and diffFrom[1] curve
            var maxInterval = dataset[diffFrom[0]].interval;
            var largeIntervalCurveData = dataset[diffFrom[0]].data;
            if (dataset[diffFrom[0]].interval < dataset[diffFrom[1]].interval) {
                maxInterval = dataset[diffFrom[1]].interval;
                largeIntervalCurveData = dataset[diffFrom[1]].data;
            }
            var minuendData = dataset[diffFrom[0]].data;
            var subtrahendData = dataset[diffFrom[1]].data;
            var subtrahendIndex = 0;
            var minuendIndex = 0;
            for (var largeIntervalCurveIndex = 0; largeIntervalCurveIndex < largeIntervalCurveData.length; largeIntervalCurveIndex++) {
                var subtrahendTime = subtrahendData[subtrahendIndex][0];
                var minuendTime = minuendData[minuendIndex][0];
                var largeIntervalTime = largeIntervalCurveData[largeIntervalCurveIndex][0];
                while (largeIntervalTime > minuendTime) {
                    minuendTime = minuendData[++minuendIndex][0];
                }
                while (largeIntervalTime > subtrahendTime)  {
                    subtrahendTime = subtrahendData[++subtrahendIndex][0];
                }
                var diffValue = null;
                if (minuendData[minuendIndex] !== undefined && subtrahendData[subtrahendIndex] !== undefined) {  // might be a fill value (null)
                    if (minuendData[minuendIndex][1] !== null && subtrahendData[subtrahendIndex][1] !== null) {
                        diffValue = minuendData[minuendIndex][1] - subtrahendData[subtrahendIndex][1];
                        d.push([largeIntervalTime, diffValue]);
                    }
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

        /*if (variableStat in variableStatSet) {
            yAxisIndex = variableStatSet[variableStat].index;
            variableStatSet[variableStat].label =  variableStatSet[variableStat].label + " | " + label;
        } else {
            variableStatSet[variableStat] = {index:curveIndex + 1, label:label};
        }*/

        var options = {
           // yaxis: variableStatSet[variableStat].index,
            label: label,
            color: color,
            data: d,
            points: {symbol: pointSymbol, fillColor: color, show: true},
            lines: {show: true, fill: false},
            interval: interval,
            xmin: xmin,
            xmax: xmax

        };
        dataset.push(options);
        var numCurves = dataset.length;
    }

    // if matching is true we need to iterate through the entire dataset by the x axis and null all entries that do
    // not have data in each curve.
    if (matching) {
        var matchInterval=0;
        for (var ci = 0; ci < numCurves; ci++) {
            var this_interval = dataset[ci].interval;
            if (this_interval > matchInterval) matchInterval = this_interval;
        }

        for (var ci = 0; ci < numCurves; ci++) {
            var new_curve_d=[];
            var curveTime = dataset[ci].data.map(function(value,index) { return value[0]; });
            for (var xtime =dataset[ci].xmin; xtime<dataset[ci].xmax; xtime=xtime+matchInterval){
                var myIndex = curveTime.indexOf(xtime);
                if(myIndex>=0) {
                    new_curve_d.push([xtime, dataset[ci].data[myIndex][1]]);
                }
            }
            dataset[ci].data= new_curve_d;
        }
    }
    // generate y-axis
    var yaxes = [];
    var yaxis = [];
    for (var dsi=0; dsi<dataset.length; dsi++) {
        var variableStat = curves[dsi].variableStat;
        var position = dsi===0?"left":"right";
        var yaxesOptions = {
                position: position,
                color: 'grey',
                //axisLabel: variableStatSet[variableStat].label + " : " + variableStat,
                axisLabelColour: "black",
                axisLabelUseCanvas: true,
                axisLabelFontSizePixels: 16,
                axisLabelFontFamily: 'Verdana, Arial',
                axisLabelPadding: 3,
                alignTicksWithAxis: 1,
                tickDecimals: 3
            };
        var yaxisOptions = {
            zoomRange: [0.1,10]
        };
        yaxes.push(yaxesOptions);
        yaxis.push(yaxisOptions);
    }
    var options = {
        axisLabels: {
            show: true
        },
        xaxes:[{
            axisLabel: 'time',
            color: 'grey'
        }],
        xaxis: {
            zoomRange: [0.1,3600000000],
            mode:'time'
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
            backgroundColor:"white",
            axisMargin: 20
        },
        tooltip: true,
        tooltipOpts: {
            content: "<span style='font-size:150%'><strong>%s<br>%x:<br>value %y</strong></span>",
            xDateFormat: "%Y-%m-%d:%H",
            onHover: function(flotItem, $tooltipEl) {
            }
        }
    };

    // add black 0 line curve
    // need to find the minimum and maximum x value for making the zero curve
    dataset.push(dataZero = {color:'black',points:{show:false},data:[[mxmin,0,"zero"],[mxmax,0,"zero"]]});
    var result = {
        error: error,
        data: dataset,
        options: options
    };
    plotFunction(result);
};