
Template.textSeriesOutput.helpers({
    plotName: function() {
        return Session.get('plotName');
    },
    curves: function () {
        return Session.get('Curves');
    },
    curveLabel: function (curve) {
      return curve.label;
    },
    curveText: function () {
        var text = this.label + ": " +
            this.model + ":" +
            this.region.split(' ')[0] + ", "  +
            this.bottom + "-" +
            this.top + "mb " +
            this.variable + " " +
            this.statistic + " " +
            this['forecast length'] +"h";
        return text;
    },
    dataRows: function() {
        var dataSet = Session.get('dataset');
        if (dataSet === undefined) {
            return [];
        }
        var dataRows = _.range(dataSet[0].data.length - 1);
        return dataRows;
    },
    points: function(rowIndex) {
        var dataSet = Session.get('dataset');
        if (dataSet === undefined) {
            return "";
        }
        var curveNums = dataSet.length - 1;   // leave out the zero curve which has been added on to the end of the dataset
        var line = "<td>" + moment.utc(dataSet[0].data[rowIndex][0]).format('YYYY-MM-DD:HH') + "</td>";
        var settings = Settings.findOne({},{fields:{NullFillString:1}});
        if (settings === undefined) {
            return false;
        }
        var fillStr = settings.NullFillString;
        for (var curveIndex = 0; curveIndex < curveNums; curveIndex++) {
            var pdata = dataSet[curveIndex].data[rowIndex][1] !== null?(dataSet[curveIndex].data[rowIndex][1]).toPrecision(4):fillStr;
            line += "<td>" + pdata + "</td>";
        }
        return line;
    },
    stats: function(curve) {
        var curves = Session.get('Curves');
        var dataSet = Session.get('dataset');
        if (curves === undefined || curves.length == 0) {
            return;
        }
        if (dataSet === undefined || dataSet.length == 1) {
            return;
        }
        var cindex;
        for (cindex = 0; cindex < curves.length; cindex++) {
            if (curves[cindex].label == curve.label) {
                break;
            }
        }
        var data = [];
        for (var di = 0; di < dataSet[cindex].data.length; di++){
            if (dataSet[cindex].data[di][1] !== null) data.push(dataSet[cindex].data[di][1]);
        }

        var mean = median(data).toPrecision(4);
        var min =  Math.min.apply(Math, data).toPrecision(4);
        var max =  Math.max.apply(Math, data).toPrecision(4);
        var sd = Math.sqrt(variance(data)).toPrecision(4);
        var se = Math.sqrt(variance(data)/(data.length-1)).toPrecision(4);

        return "<td>" + curve.label + "</td>" + "<td>" + mean + "</td>" + "<td>" + min + "</td>" + "<td>" + max + "</td>" + "<td>" + sd + "</td>" + "<td>" + se + "</td>";
    }
});

Template.textSeriesOutput.events({
    'click .export': function() {
        var settings = Settings.findOne({},{fields:{NullFillString:1}});
        if (settings === undefined) {
            return false;
        }
        var fillStr = settings.NullFillString;
        var data = [];
        var curves = Session.get('Curves');
        if (curves === undefined || curves.length == 0) {
            return data;
        }
        var clabels = 'time';
        for (var c=0; c < curves.length;c++) {
            clabels += "," + curves[c].label;
        }
        data.push(clabels);

        var dataSet = Session.get('dataset');
        var curveNums = dataSet.length - 1;
        var dataRows = _.range(dataSet[0].data.length - 1);
        for (var rowIndex = 0; rowIndex < dataRows.length; rowIndex ++) {
            var line = moment.utc(dataSet[0].data[rowIndex][0]).format('YYYY-MM-DD:HH');
            for (var curveIndex = 0; curveIndex < curveNums; curveIndex++) {
                var pdata = dataSet[curveIndex].data[rowIndex][1] !== null?(dataSet[curveIndex].data[rowIndex][1]).toPrecision(4):fillStr;
                line += "," + pdata;
            }
            data.push(line);
        }
        var csvString = data.join("%0A");
        var a         = document.createElement('a');
        a.href        = 'data:attachment/csv,' + csvString;
        a.target      = '_blank';
        a.download    = 'data.csv';
        document.body.appendChild(a);
        a.click();
    }
});
