/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsMethods,
  matsGraphUtils,
  matsPlotUtils,
  matsParamUtils,
  matsSelectUtils,
} from "meteor/randyp:mats-common";

/*
    A note about how things get to the backend, and then to the graph or display view.
    When the user clicks "Submit Scorecard" on the curve-list page
    there is a spinner displayed and a plotParameter set, and then
    the "plot-curves" button in the plot-form in plot_list.html which is a submit button
    that triggers the event for the class 'submit-params' in plot_list.js.
    the submit-params handler in plot_list.js is BADLY IN NEED OF REFACTORING, it has a complexity
    rating of "Complexity is 131 Bloody hell..." - see MATS github issue #810 -RTP.
    The submit handler transforms all the params into a plotParms document and puts it into the session, then
    uses a switch on 'action' which is the event.currentTarget.name "save|restore|plot" which are
    the names of type="submit" buttons in the form, like name="plot" or name="save".
    In the type="submit" and name-"plot" case of the switch this call...
    matsMethods.getGraphData.call({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
*/

const _changeParameter = async (parameter, newValue) => {
  matsParamUtils.setValueTextForParamName(parameter, newValue);
};

const _setCommonParams = async (commonParamKeys, commonParams) => {
  for (let kidx = 0; kidx < commonParamKeys.length; kidx++) {
    const thisKey = commonParamKeys[kidx];
    const thisValue = commonParams[commonParamKeys[kidx]];
    if (thisValue !== "undefined") {
      if (document.getElementById(`${thisKey}-item`)) {
        matsParamUtils.setValueTextForParamName(thisKey, thisValue);
      } else if (thisKey === "region" && document.getElementById("vgtyp-item")) {
        // landuse regions go in the vgtyp selector
        matsParamUtils.setValueTextForParamName("vgtyp", thisValue);
      }
    }
  }
};

const _addCurve = async () => {
  matsParamUtils.addImportedCurve();
};

const _plotGraph = async () => {
  $("#plotMatched").trigger("click");
};

const addCurvesAndPlot = async (parsedSettings, commonParamKeys, commonParams) => {
  await _changeParameter("data-source", parsedSettings.curve0DataSource);
  await _setCommonParams(commonParamKeys, commonParams);
  await _addCurve();
  await _changeParameter("data-source", parsedSettings.curve1DataSource);
  await _addCurve();
  await _changeParameter("dates", parsedSettings.dateRange);
  await _plotGraph();
};

Template.plotList.helpers({
  Title() {
    return matsCollections.Settings.findOne({}, { fields: { Title: 1 } }).Title;
  },
  PlotParamGroups() {
    const groupNums = [];
    const params = matsCollections.PlotParams.find(
      {},
      { fields: { displayGroup: 1 } }
    ).fetch();
    for (let i = 0; i < params.length; i++) {
      groupNums.push(params[i].displayGroup);
    }
    const res = _.uniq(groupNums).sort();
    return res;
  },
  curves() {
    return Session.get("Curves");
  },
  privateDisabled() {
    if (!Meteor.user()) {
      return "disabled";
    }
    return "";
  },
  privateRestoreNames() {
    const names = [];
    const l = matsCollections.CurveSettings.find(
      {},
      { fields: { name: 1, owner: 1, permission: 1 } }
    ).fetch();
    for (let i = 0; i < l.length; i++) {
      if (l[i].owner === Meteor.userId() && l[i].permission === "private") {
        names.push(l[i].name);
      }
    }
    return names;
  },
  publicRestoreNames() {
    const names = [];
    const savedSettings = matsCollections.CurveSettings.find(
      {},
      { fields: { name: 1, owner: 1, permission: 1 } }
    ).fetch();
    for (let i = 0; i < savedSettings.length; i++) {
      if (savedSettings[i].permission === "public") {
        names.push(savedSettings[i].name);
      }
    }
    return names;
  },
  isOwner() {
    return this.owner === Meteor.userId();
  },
});

Template.plotList.events({
  "click .cancel-restore"() {
    document.getElementById("restore_from_public").value = "";
    document.getElementById("restore_from_private").value = "";
  },
  "click .cancel-save"() {
    document.getElementById("save_as").value = "";
    document.getElementById("save_to").value = "";
  },
  "click .delete-selected"() {
    const deleteThis = document.getElementById("save_to").value;
    if (deleteThis !== undefined && deleteThis !== "") {
      matsMethods.deleteSettings.call({ name: deleteThis }, function (error) {
        if (error) {
          setError(new Error(error.message));
        }
      });
    }
  },

  // catch a click on a diff plotFormat radio button.
  "click .data-input"() {
    const formats = Object.keys(matsTypes.PlotFormats);
    if ($.inArray(this.toString(), formats) !== -1) {
      matsCurveUtils.checkDiffs();
    }
  },
  "click .restore-from-private"() {
    document.getElementById("restore_from_public").value = "";
  },
  "click .restore-from-public"() {
    document.getElementById("restore_from_private").value = "";
  },
  "click .submit-params"(event, template) {
    const plotAction = Session.get("plotParameter");
    Session.set("spinner_img", "spinner.gif");
    document.getElementById("spinner").style.display = "block";
    event.preventDefault();
    const action =
      plotAction !== undefined &&
      plotAction.toUpperCase() === matsTypes.PlotTypes.scorecard.toUpperCase()
        ? "displayScorecardStatusPage"
        : event.currentTarget.name;
    let p = {};
    // get the plot-type elements checked state
    const plotTypeElems = document.getElementById("plotTypes-selector");
    p.plotTypes = {};
    for (ptei = 0; ptei < plotTypeElems.length; ptei++) {
      const ptElem = plotTypeElems[ptei];
      p.plotTypes[ptElem.value] = ptElem.value === plotTypeElems.value;
    }
    const curves = Session.get("Curves");
    if (curves === 0 && action !== "restore") {
      // alert ("No Curves To plot");
      setError(new Error("There are no curves to plot!"));
      Session.set("spinner_img", "spinner.gif");
      document.getElementById("spinner").style.display = "none";
      return false;
    }
    p.curves = [];
    p.plotAction = plotAction;
    curves.forEach(function (curve) {
      p.curves.push(curve);
    });
    matsCollections.PlotParams.find({})
      .fetch()
      .forEach(function (plotParam) {
        const { name } = plotParam;
        const { type } = plotParam;
        const { options } = plotParam;

        if (type === matsTypes.InputTypes.radioGroup) {
          for (var i = 0; i < options.length; i++) {
            if (
              document.getElementById(`${name}-${type}-${options[i]}`).checked === true
            ) {
              p[name] = options[i];
              break;
            }
          }
        } else if (type === matsTypes.InputTypes.checkBoxGroup) {
          p[name] = [];
          for (var i = 0; i < options.length; i++) {
            if (document.getElementById(`${name}-${type}-${options[i]}`).checked) {
              p[name].push(options[i]);
            }
          }
        } else if (type === matsTypes.InputTypes.dateRange) {
          p[name] = matsParamUtils.getValueForParamName(name);
        } else if (type === matsTypes.InputTypes.numberSpinner) {
          p[name] = document.getElementById(`${name}-${type}`).value;
        } else if (type === matsTypes.InputTypes.select) {
          p[name] = document.getElementById(`${name}-${type}`).value;
        } else if (type === matsTypes.InputTypes.textInput) {
          p[name] = document.getElementById(`${name}-${type}`).value;
        } else if (type === matsTypes.InputTypes.color) {
          p[name] = document.getElementById(`${name}-${type}`).value;
        }
      });
    if (
      document.getElementById("QCParamGroup-item") &&
      document.getElementById("QCParamGroup-item").style.display === "block"
    ) {
      p.completeness = document.getElementById("completeness").value;
    } else if (
      document.getElementById("QCParamGroup-gaps-item") &&
      document.getElementById("QCParamGroup-gaps-item").style.display === "block"
    ) {
      p.completeness = document.getElementById("completeness-gaps").value;
    } else {
      p.completeness = 0;
    }
    if (
      document.getElementById("QCParamGroup-item") &&
      document.getElementById("QCParamGroup-item").style.display === "block"
    ) {
      p.outliers = document.getElementById("outliers").value;
    } else if (
      document.getElementById("QCParamGroup-lite-item") &&
      document.getElementById("QCParamGroup-lite-item").style.display === "block"
    ) {
      p.outliers = document.getElementById("outliers-lite").value;
    } else {
      p.outliers = "all";
    }
    p.noGapsCheck = document.getElementById("noGapsCheck")
      ? document.getElementById("noGapsCheck").checked
      : false;
    Session.set("PlotParams", p);

    switch (action) {
      case "save":
        if (
          (document.getElementById("save_as").value === "" ||
            document.getElementById("save_as").value === undefined) &&
          (document.getElementById("save_to").value === "" ||
            document.getElementById("save_to").value === undefined)
        ) {
          $("#saveModal").modal("show");
          Session.set("spinner_img", "spinner.gif");
          document.getElementById("spinner").style.display = "none";
          return false;
        }
        var saveAs = "";
        if (
          document.getElementById("save_as").value !== "" &&
          document.getElementById("save_as").value !== undefined
        ) {
          saveAs = document.getElementById("save_as").value;
        } else {
          saveAs = document.getElementById("save_to").value;
        }
        var permission =
          document.getElementById("save-public").checked === true
            ? "public"
            : "private";
        // console.log("saving settings to " + saveAs);
        Session.set("plotName", saveAs);
        // get the settings to save out of the session
        p = Session.get("PlotParams");
        var paramData = matsParamUtils.getElementValues();
        p.paramData = paramData;
        matsMethods.saveSettings.call({ saveAs, p, permission }, function (error) {
          if (error) {
            setError(
              new Error(`matsMethods.saveSettings from plot_list.js ${error.message}`)
            );
          }
        });

        document.getElementById("save_as").value = "";
        document.getElementById("save_to").value = "";
        $("#saveModal").modal("hide");
        Session.set("spinner_img", "spinner.gif");
        document.getElementById("spinner").style.display = "none";
        return false;
        break;
      case "restore":
        matsCurveUtils.clearAllUsed();
        if (
          (document.getElementById("restore_from_private").value === "" ||
            document.getElementById("restore_from_private").value === undefined) &&
          (document.getElementById("restore_from_public").value === "" ||
            document.getElementById("restore_from_public").value === undefined)
        ) {
          $("#restoreModal").modal("show");
          Session.set("spinner_img", "spinner.gif");
          document.getElementById("spinner").style.display = "none";
          return false;
        }
        var restoreFrom = document.getElementById("restore_from_private").value;
        if (restoreFrom === "" || restoreFrom === undefined) {
          restoreFrom = document.getElementById("restore_from_public").value;
        }
        // console.log("restore settings from " + restoreFrom);
        Session.set("plotName", restoreFrom);

        p = matsCollections.CurveSettings.findOne({ name: restoreFrom });
        // now set all the curves.... This will refresh the curves list
        Session.set("Curves", p.data.curves);
        // reset the plotType - have to do this first because the event will remove all the possibly existing curves
        // get the plot-type elements checked state
        var plotTypeSaved = false;
        const plotTypeElems = document.getElementById("plotTypes-selector");
        for (var ptei = 0; ptei < plotTypeElems.length; ptei++) {
          const ptElem = plotTypeElems[ptei];
          if (p.data.plotTypes && p.data.plotTypes[ptElem.value] === true) {
            plotTypeSaved = true;
            ptElem.checked = true;
            // We have to set up the display without using click events because that would cause
            // the restored curves to be removed
            switch (ptElem.value) {
              case matsTypes.PlotTypes.timeSeries:
                matsCurveUtils.showTimeseriesFace();
                break;
              case matsTypes.PlotTypes.profile:
                matsCurveUtils.showProfileFace();
                break;
              case matsTypes.PlotTypes.dieoff:
                matsCurveUtils.showDieOffFace();
                break;
              case matsTypes.PlotTypes.threshold:
                matsCurveUtils.showThresholdFace();
                break;
              case matsTypes.PlotTypes.validtime:
                matsCurveUtils.showValidTimeFace();
                break;
              case matsTypes.PlotTypes.gridscale:
                matsCurveUtils.showGridScaleFace();
                break;
              case matsTypes.PlotTypes.dailyModelCycle:
                matsCurveUtils.showDailyModelCycleFace();
                break;
              case matsTypes.PlotTypes.yearToYear:
                matsCurveUtils.showYearToYearFace();
                break;
              case matsTypes.PlotTypes.reliability:
                matsCurveUtils.showReliabilityFace();
                break;
              case matsTypes.PlotTypes.roc:
                matsCurveUtils.showROCFace();
                break;
              case matsTypes.PlotTypes.performanceDiagram:
                matsCurveUtils.showPerformanceDiagramFace();
                break;
              case matsTypes.PlotTypes.map:
                matsCurveUtils.showMapFace();
                break;
              case matsTypes.PlotTypes.histogram:
                matsCurveUtils.showHistogramFace();
                break;
              case matsTypes.PlotTypes.ensembleHistogram:
                matsCurveUtils.showEnsembleHistogramFace();
                break;
              case matsTypes.PlotTypes.contour:
              case matsTypes.PlotTypes.contourDiff:
                matsCurveUtils.showContourFace();
                break;
              case matsTypes.PlotTypes.simpleScatter:
                matsCurveUtils.showSimpleScatterFace();
                break;
              case matsTypes.PlotTypes.scatter2d:
                matsCurveUtils.showScatterFace();
                break;
            }
          } else {
            ptElem.checked = false;
          }
        }
        if (plotTypeSaved !== true) {
          // set the default - in the case none was set in an old saved settings
          document.getElementById("plotTypes-selector").value =
            matsCollections.PlotGraphFunctions.findOne({ checked: true }).plotType;
        }

        // now set the PlotParams
        var params = matsCollections.PlotParams.find({}).fetch();
        params.forEach(function (plotParam) {
          const val =
            p.data.paramData.plotParams[plotParam.name] === null ||
            p.data.paramData.plotParams[plotParam.name] === undefined
              ? matsTypes.InputTypes.unused
              : p.data.paramData.plotParams[plotParam.name];
          matsParamUtils.setInputForParamName(plotParam.name, val);
        });

        var paramNames = matsCollections.CurveParamsInfo.find({
          curve_params: { $exists: true },
        }).fetch()[0].curve_params;
        params = [];
        var superiors = [];
        var dependents = [];
        // get all of the curve param collections in one place
        for (let pidx = 0; pidx < paramNames.length; pidx++) {
          const param = matsCollections[paramNames[pidx]].find({}).fetch()[0];
          // superiors
          if (param.dependentNames !== undefined) {
            superiors.push(param);
            // dependents
          } else if (param.superiorNames !== undefined) {
            dependents.push(param);
            // everything else
          } else {
            params.push(param);
          }
        }

        // reset the form parameters for the superiors first
        superiors.forEach(function (plotParam) {
          if (plotParam.type === matsTypes.InputTypes.dateRange) {
            if (p.data.paramData.curveParams[plotParam.name] === undefined) {
              return; // just like continue
            }
            const dateArr = p.data.paramData.curveParams[plotParam.name].split(" - ");
            const from = dateArr[0];
            const to = dateArr[1];
            const idref = `#${plotParam.name}-${plotParam.type}`;
            $(idref)
              .data("daterangepicker")
              .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
            $(idref)
              .data("daterangepicker")
              .setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
            matsParamUtils.setValueTextForParamName(
              plotParam.name,
              p.data.paramData.curveParams[plotParam.name]
            );
          } else {
            const val =
              p.data.paramData.curveParams[plotParam.name] === null ||
              p.data.paramData.curveParams[plotParam.name] === undefined
                ? matsTypes.InputTypes.unused
                : p.data.paramData.curveParams[plotParam.name];
            matsParamUtils.setInputForParamName(plotParam.name, val);
          }
        });

        // now reset the form parameters for the dependents
        params = _.union(dependents, params);
        params.forEach(function (plotParam) {
          if (plotParam.type === matsTypes.InputTypes.dateRange) {
            if (p.data.paramData.curveParams[plotParam.name] === undefined) {
              return; // just like continue
            }
            const dateArr = p.data.paramData.curveParams[plotParam.name].split(" - ");
            const from = dateArr[0];
            const to = dateArr[1];
            const idref = `#${plotParam.name}-${plotParam.type}`;
            $(idref)
              .data("daterangepicker")
              .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
            $(idref)
              .data("daterangepicker")
              .setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
            matsParamUtils.setValueTextForParamName(
              plotParam.name,
              p.data.paramData.curveParams[plotParam.name]
            );
          } else {
            const val =
              p.data.paramData.curveParams[plotParam.name] === null ||
              p.data.paramData.curveParams[plotParam.name] === undefined
                ? matsTypes.InputTypes.unused
                : p.data.paramData.curveParams[plotParam.name];
            matsParamUtils.setInputForParamName(plotParam.name, val);
          }
        });

        // reset the scatter parameters
        params = matsCollections.Scatter2dParams.find({}).fetch();
        params.forEach(function (plotParam) {
          const val =
            p.data.paramData.scatterParams[plotParam.name] === null ||
            p.data.paramData.scatterParams[plotParam.name] === undefined
              ? matsTypes.InputTypes.unused
              : p.data.paramData.scatterParams[plotParam.name];
          matsParamUtils.setInputForParamName(plotParam.name, val);
        });

        // reset the dates
        if (p.data.dates !== undefined) {
          const dateArr = p.data.dates.split(" - ");
          const from = dateArr[0];
          const to = dateArr[1];
          $(`#dates-${matsTypes.InputTypes.dateRange}`)
            .data("daterangepicker")
            .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
          $(`#dates-${matsTypes.InputTypes.dateRange}`)
            .data("daterangepicker")
            .setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
          matsParamUtils.setValueTextForParamName("dates", p.data.dates);
        }

        // reset the plotFormat

        // reset the plotParams
        Session.set("PlotParams", p);
        // set the used defaults so that subsequent adds get a core default
        matsCurveUtils.setUsedColorsAndLabels();
        document.getElementById("restore_from_public").value = "";
        document.getElementById("restore_from_private").value = "";
        $("#restoreModal").modal("hide");
        Session.set("spinner_img", "spinner.gif");
        document.getElementById("spinner").style.display = "none";
        matsParamUtils.collapseParams();
        return false;
        break;
      case "plot":
        var pt = matsPlotUtils.getPlotType();
        console.log("resizing graph type is ", pt);
        matsGraphUtils.resizeGraph(pt);
        var pgf = matsCollections.PlotGraphFunctions.findOne({ plotType: pt });
        if (pgf === undefined) {
          setError(
            new Error(
              `plot_list.js - plot -do not have a plotGraphFunction for this plotType: ${pt}`
            )
          );
          Session.set("spinner_img", "spinner.gif");
          document.getElementById("spinner").style.display = "none";
          return false;
        }
        Session.set("graphViewMode", matsTypes.PlotView.graph);
        Session.set("mvResultKey", null); // disable the mv links on the graph page

        var { graphFunction } = pgf;
        console.log("prior to getGraphData call time:", new Date());
        // the following line converts a null expireKey to false.
        var expireKey = Session.get("expireKey") === true;
        matsMethods.getGraphData.call(
          { plotParams: p, plotType: pt, expireKey },
          function (error, ret) {
            if (error !== undefined) {
              // setError(new Error("matsMethods.getGraphData from plot_list.js : error: " + error ));
              setError(error);
              matsCurveUtils.resetGraphResult();
              // Session.set ('PlotResultsUpDated', new Date());
              Session.set("spinner_img", "spinner.gif");
              matsCurveUtils.hideSpinner();
              Session.set("expireKey", false);
              return false;
            }
            Session.set("expireKey", false);
            matsCurveUtils.setGraphResult(ret.result);
            const plotType = Session.get("plotType");
            if (plotType === matsTypes.PlotTypes.contourDiff) {
              const oldCurves = Session.get("Curves");
              Session.set("oldCurves", oldCurves);
              Session.set("Curves", ret.result.basis.plotParams.curves);
            }
            Session.set("plotResultKey", ret.key);
            Session.set("graphFunction", graphFunction);
            Session.set("graphPlotType", JSON.parse(JSON.stringify(plotType)));
            Session.set("PlotResultsUpDated", new Date());
            console.log(
              "after successful getGraphData call time:",
              new Date(),
              ":Session key: ",
              ret.key,
              " graphFunction:",
              graphFunction
            );
          }
        );
        break;
      case "displayScorecardStatusPage":
        var pt = matsPlotUtils.getPlotType();
        console.log("displayScorecardStatusPage plot type is ", pt);
        var pgf = matsCollections.PlotGraphFunctions.findOne({ plotType: pt });
        if (pgf === undefined) {
          setError(
            new Error(
              `plot_list.js - plot -do not have a plotGraphFunction for this plotType: ${pt}`
            )
          );
          Session.set("spinner_img", "spinner.gif");
          document.getElementById("spinner").style.display = "none";
          return false;
        }
        var { graphFunction } = pgf;
        console.log("prior to getGraphData call time:", new Date());
        // the following line converts a null expireKey to false.
        var expireKey = Session.get("expireKey") === true;
        // add user and name to the plotparams
        if (Meteor.user() === null) {
          p.userName = "anonymous";
        } else {
          p.userName = Meteor.user().emails[0].address;
        }
        const x = new Date();
        const y = x.getUTCFullYear().toString();
        let m = (x.getUTCMonth() + 1).toString();
        let d = x.getUTCDate().toString();
        let h = x.getUTCHours().toString();
        let min = x.getUTCMinutes().toString();
        let sec = x.getUTCSeconds().toString();
        d.length === 1 && (d = `0${d}`);
        m.length === 1 && (m = `0${m}`);
        h.length === 1 && (h = `0${h}`);
        min.length === 1 && (min = `0${min}`);
        sec.length === 1 && (sec = `0${sec}`);
        const submitTime = y + m + d + h + min + sec;
        // stash the submit epoch in the params
        p.submitEpoch = Math.floor(x.getTime() / 1000);
        p[
          "scorecard-name"
        ] = `${p.userName}--submitted:${submitTime}--${p.curves.length}block`;
        matsMethods.getGraphData.call(
          { plotParams: p, plotType: pt, expireKey },
          function (error, ret) {
            if (error !== undefined) {
              // setError(new Error("matsMethods.getGraphData from plot_list.js : error: " + error ));
              setError(error);
              Session.set("spinner_img", "spinner.gif");
              matsCurveUtils.hideSpinner();
              Session.set("expireKey", false);
              return false;
            }
            Session.set("ret", ret);
            Session.set("expireKey", false);
            Session.set("graphFunction", graphFunction);
            console.log(
              "after successful getGraphData call time:",
              new Date(),
              ":Session key: ",
              ret.key,
              " graphFunction:",
              graphFunction
            );
            matsGraphUtils.setScorecardDisplayView(pt);
          }
        );
        break;
      default:
        break;
    }
    return false;
  },
});

Template.plotList.onRendered(function () {
  if (Session.get("scorecardTimeseriesKey")) {
    // we are plotting a timeseries, make sure MATS is set to that plot type
    Session.set("plotType", matsTypes.PlotTypes.timeSeries);
    document.getElementById("plotTypes-selector").value =
      matsTypes.PlotTypes.timeSeries;
    matsCurveUtils.showTimeseriesFace();

    // make sure everything is at default
    matsParamUtils.setAllParamsToDefault();

    // get the params from the scorecard settings
    matsMethods.getScorecardSettings.call(
      { settingsKey: Session.get("scorecardTimeseriesKey") },
      function (error, ret) {
        if (error !== undefined) {
          if (error.message.includes("DocumentNotFoundError")) {
            setInfo(
              "INFO: No scorecard parameters found for this ID. " +
                "Your URL may have expired. " +
                "They only last for eight hours after a scorecard cell is clicked."
            );
          } else {
            setError(error);
          }
          return false;
        }
        const settingsJSON = ret.scorecardSettings;
        const parsedSettings = JSON.parse(settingsJSON);
        const commonParams = parsedSettings.commonCurveParams;
        const commonParamKeys = Object.keys(commonParams);

        // add the curves from the scorecard settings and then plot
        addCurvesAndPlot(parsedSettings, commonParamKeys, commonParams).then();
      }
    );
  } else {
    // need to display correct selectors on page load if default plot type is not timeseries
    const plotType = matsPlotUtils.getPlotType();
    Session.set("plotType", plotType); // need to make sure plotType is in the Session this early
    switch (plotType) {
      case matsTypes.PlotTypes.profile:
        matsCurveUtils.showProfileFace();
        break;
      case matsTypes.PlotTypes.dieoff:
        matsCurveUtils.showDieOffFace();
        break;
      case matsTypes.PlotTypes.threshold:
        matsCurveUtils.showThresholdFace();
        break;
      case matsTypes.PlotTypes.validtime:
        matsCurveUtils.showValidTimeFace();
        break;
      case matsTypes.PlotTypes.gridscale:
        matsCurveUtils.showGridScaleFace();
        break;
      case matsTypes.PlotTypes.dailyModelCycle:
        matsCurveUtils.showDailyModelCycleFace();
        break;
      case matsTypes.PlotTypes.yearToYear:
        matsCurveUtils.showYearToYearFace();
        break;
      case matsTypes.PlotTypes.reliability:
        matsCurveUtils.showReliabilityFace();
        break;
      case matsTypes.PlotTypes.roc:
        matsCurveUtils.showROCFace();
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        matsCurveUtils.showPerformanceDiagramFace();
        break;
      case matsTypes.PlotTypes.map:
        matsCurveUtils.showMapFace();
        break;
      case matsTypes.PlotTypes.histogram:
        matsCurveUtils.showHistogramFace();
        break;
      case matsTypes.PlotTypes.ensembleHistogram:
        matsCurveUtils.showEnsembleHistogramFace();
        break;
      case matsTypes.PlotTypes.contour:
      case matsTypes.PlotTypes.contourDiff:
        matsCurveUtils.showContourFace();
        break;
      case matsTypes.PlotTypes.simpleScatter:
        matsCurveUtils.showSimpleScatterFace();
        break;
      case matsTypes.PlotTypes.scatter2d:
        matsCurveUtils.showScatterFace();
        break;
      case matsTypes.PlotTypes.timeSeries:
      default:
        matsCurveUtils.showTimeseriesFace();
        break;
    }

    // make sure everything is at default
    matsParamUtils.setAllParamsToDefault();
  }
});
