Template.curveList.helpers({
    curves: function () {
        return Session.get('Curves');
    },
    displayCurves: function() {
        if (Session.get('Curves') === undefined || Session.get('Curves').length === 0) {
            return "none";
        } else {
            return "block";
        }
    },
    log: function() {
        console.log(this);
    },
    diffsdisabled: function() {
        if (Session.get('diffStatus') === undefined) {
            return "";
        }
        if (Session.get('diffStatus') == PlotFormats.none){
            return "";
        }
        return "disabled";
    },
    averagesdisabled: function() {
        var curves = Session.get('Curves');
        if (curves === undefined || curves.length == 0) {
            return "";
        }
        var average = curves[0].average;
        for (var i = 0; i<curves.length; i++) {
            if (average != curves[i].average) {
                return "disabled";
            }
        }
    },
    disabledPlotsHidden: function() {
        var curves = Session.get('Curves');
        if (curves === undefined || curves.length == 0) {
            return "none";
        }
        var average = curves[0].average;
        for (var i = 0; i<curves.length; i++) {
            if (average != curves[i].average) {
                return "block";
            }
        }
        return "none"
    }

});


Template.curveList.events({
    'click .remove-all': function() {
        Session.set('Curves',[]);
        clearAllUsed();
        return false;
    },
    'click .plot-curves-unmatched': function(event) {
        document.getElementById("spinner").style.display="block";
        event.preventDefault();
        // trigger the submit on the plot_list plot_list.js - click .submit-params
        Session.set('plotParameter',PlotActions.unmatched);
        document.getElementById("plot-curves").click();
        return false;
    },
    'click .plot-curves-matched': function(event) {
        document.getElementById("spinner").style.display="block";
        event.preventDefault();
        // trigger the submit on the plot_list plot_list.js - click .submit-params
        Session.set('plotParameter',PlotActions.matched);
        document.getElementById("plot-curves").click();
        return false;
    },
    'click .save-settings': function(event) {
        event.preventDefault();
        document.getElementById("save-settings").click();
        return false;
    },
    'click .submit-params': function (event, template) {
        event.preventDefault();
        var action = event.currentTarget.name;
        var p = {};
        var curves = Session.get('Curves');
        if (curves == 0 && action !== "restore") {
            //alert ("No Curves To plot");
            setError("There are no curves to plot!");
            return false;
        }
        p.curves = [];
        curves.forEach(function(curve){p.curves.push(curve)});
        PlotParams.find({}).fetch().forEach(function(plotParam){
            var name = plotParam.name;
            var type = plotParam.type;
            var options = plotParam.options;

            if (type == InputTypes.dateRange) {
                var from = document.getElementById(name + '-' + type + "-from").value;
                var to = document.getElementById(name + '-' + type + "-to").value;
                p['fromDate'] = from;
                p['toDate'] = to;
            } else if (type == InputTypes.radioGroup) {
                for (var i=0; i<options.length; i++) {
                    if (document.getElementById(name+"-" + type + "-" + options[i]).checked == true) {
                        p[name] = options[i];
                        break;
                    }
                }
            } else if (type == InputTypes.checkBoxGroup) {
                p[name] = [];
                for (var i = 0; i < options.length; i++) {
                    if (document.getElementById(name + "-" + type + "-" + options[i]).checked) {
                        p[name].push(options[i]);
                    }
                }
            }
            else if (type == InputTypes.numberSpinner) {
                p[name] = document.getElementById(name + '-' + type).value;
            } else if (type == InputTypes.select) {
                p[name] = document.getElementById(name + '-' + type).value;
            } else if (type == InputTypes.textInput) {
                p[name] = document.getElementById(name + '-' + type).value;
            }
        });
        Session.set("PlotParams", p);

        switch (action) {
            case "save":
                if (!!Meteor.user()) {
                    setError("You must be logged in to use the 'save' feature");
                    return false;
                }
                if ((document.getElementById('save_as').value === "" ||
                    document.getElementById('save_as').value === undefined) &&
                    (document.getElementById('save_to').value === "" ||
                    document.getElementById('save_to').value === undefined)) {
                    $("#saveModal").modal('show');
                    return false;
                }
                var saveAs = "";
                if (document.getElementById('save_as').value !== "" &&
                    document.getElementById('save_as').value !== undefined) {
                    saveAs = document.getElementById('save_as').value;
                } else {
                    saveAs = document.getElementById('save_to').value;
                }
                console.log("saving settings to " + saveAs);
                // get the settings to save out of the session
                p = Session.get("PlotParams");
                Meteor.call('saveSettings',saveAs, p, function(error){
                    if (error) {
                        setError(error);
                    }
                });
                //CurveSettings.update({name:saveAs},{name: saveAs, data:p},{upsert:true});

                document.getElementById('save_as').value = "";
                document.getElementById('save_to').value = "";
                $("#saveModal").modal('hide');
                return false;
                break;
            case "restore":
                if (!!Meteor.user()) {
                    setError("You must be logged in to use the 'restore' feature");
                }
                if ((document.getElementById('restore_from').value === "" ||
                    document.getElementById('restore_from').value === undefined)){
                    $("#restoreModal").modal('show');
                    return false;
                }
                var restoreFrom = document.getElementById('restore_from').value;
                console.log("restore settings from " + restoreFrom);
                p = CurveSettings.findOne({name:restoreFrom});
                // now set all the curves....
                Session.set('Curves',p.data.curves);
                ////fix the color selectors
                //for (var ci=0; ci < p.data.curves.length; ci++) {
                //    var label = p.data.curves[ci].label;
                //    var color = p.data.curves[ci].color;
                //    var cl = '.' + label + '-colorpick';
                //    console.log("color set cl: " + cl + " color:" + color);
                //    $(cl).colorpicker('setValue',color);
                //}
                // reset all the curve params....
                var view = document.getElementById('paramList');
                Blaze.remove(Blaze.getView(view));
                Blaze.render(Template.paramList,document.getElementById('paramView'));

                // now set the PlotParams
                PlotParams.find({}).fetch().forEach(function(plotParam){
                    var name = plotParam.name;
                    var type = plotParam.type;
                    var options = plotParam.options;

                    if (type == InputTypes.dateRange) {
                        document.getElementById(name + '-' + type + "-from").value = p.data.fromDate;
                        document.getElementById(name + '-' + type + "-to").value = p.data.toDate;

                    } else if (type == InputTypes.radioGroup) {
                        for (var i = 0; i < options.length; i++) {
                            if (options[i] === p.data[name]) {
                                document.getElementById(name + "-" + type + "-" + options[i]).checked = true;
                                break;
                            }
                        }
                    } else if (type == InputTypes.checkBoxGroup) {
                        for (var i = 0; i < options.length; i++) {
                            if (_.contains(p.data[name],options[i])) {
                                document.getElementById(name + "-" + type + "-" + options[i]).checked = true;
                                break;
                            }
                        }
                    } else if (type === InputTypes.numberSpinner || type === InputTypes.select || type === InputTypes.textInput) {
                        document.getElementById(name + '-' + type).value = p.data[name];
                    }
                });
                // reset the plotParams
                Session.set("PlotParams", p);

                document.getElementById('restore_from').value = "";
                $("#restoreModal").modal('hide');
                return false;
                break;
            case "plot":
            default:
                var plotType = getPlotType();
                var plotGraphFunction = PlotGraphFunctions.findOne({plotType: plotType});
                if (plotGraphFunction === undefined) {
                    setError("do not have a plotGraphFunction for this plotType: " + plotType);
                    return false;
                }
                var graphFunction = plotGraphFunction.graphFunction;


                Meteor.call('getGraphData', p, plotType, function (error, result) {
                    //    //console.log ('result is : ' + JSON.stringify(result, null, '\t'));
                    if (error !== undefined) {
                        setError(error.toLocaleString());
                        return false;
                    }
                    if (result.error !== undefined && result.error !== "") {
                        setError(result.error);
                        return false;
                    }
                    document.getElementById('graph-container').style.display = 'block';
                    document.getElementById('plotType').style.display = 'none';
                    document.getElementById('paramList').style.display = 'none';
                    document.getElementById('plotList').style.display = 'none';
                    document.getElementById('curveList').style.display = 'none';
                    PlotResult = jQuery.extend(true,{}, result);
                    Session.set('graphFunction', graphFunction);
                    window[graphFunction](result, Session.get('Curves'));
                });
                break;

        }
        return false;
    }

});