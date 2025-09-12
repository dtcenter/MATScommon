/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { Meteor } from "meteor/meteor";
import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsMethods,
  matsGraphUtils,
  matsPlotUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $, _, setError, setInfo */
/* eslint-disable no-console */

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
    matsMethods.getGraphData.callAsync({plotParams: p, plotType: pt, expireKey: expireKey}, function (error, ret) .....
    is what invokes the data method in the backend, and the success handler of that call
    is what sets up the graph page.
*/

const setApplication = async (app) => {
  // application usually refers to either database or variable in MATS
  if (document.getElementById("database-item")) {
    matsParamUtils.setValueTextForParamName("database", app);
  } else if (
    document.getElementById("variable-item") &&
    document.getElementById("threshold-item")
  ) {
    matsParamUtils.setValueTextForParamName("variable", app);
  }
};

const changeParameter = async (parameter, newValue) => {
  matsParamUtils.setValueTextForParamName(parameter, newValue);
};

const setCommonParams = async (commonParamKeys, commonParams) => {
  for (let kidx = 0; kidx < commonParamKeys.length; kidx += 1) {
    const thisKey = commonParamKeys[kidx];
    const thisValue = commonParams[commonParamKeys[kidx]];
    if (thisValue !== "undefined") {
      if (document.getElementById(`${thisKey}-item`)) {
        matsParamUtils.setValueTextForParamName(thisKey, thisValue);
      } else if (thisKey === "region" && document.getElementById("vgtyp-item")) {
        // landuse regions go in the vgtyp selector
        matsParamUtils.setValueTextForParamName("vgtyp", thisValue);
      } else if (thisKey === "level" && document.getElementById("top-item")) {
        // some apps don't actually have a level selector
        matsParamUtils.setValueTextForParamName("top", thisValue);
        matsParamUtils.setValueTextForParamName("bottom", thisValue);
      }
    }
  }
};

const addCurve = async () => {
  matsParamUtils.addImportedCurve();
};

const plotGraph = async () => {
  $("#plotMatched").trigger("click");
};

const addCurvesAndPlot = async (parsedSettings, commonParamKeys, commonParams) => {
  await setApplication(parsedSettings.appName);
  await changeParameter("data-source", parsedSettings.curve0DataSource);
  await setCommonParams(commonParamKeys, commonParams);
  await addCurve();
  await changeParameter("data-source", parsedSettings.curve1DataSource);
  await setCommonParams(commonParamKeys, commonParams);
  await addCurve();
  await changeParameter("dates", parsedSettings.dateRange);
  await plotGraph();
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
    for (let i = 0; i < params.length; i += 1) {
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
    for (let i = 0; i < l.length; i += 1) {
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
    for (let i = 0; i < savedSettings.length; i += 1) {
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
      matsMethods.deleteSettings
        .callAsync({ name: deleteThis })
        .then()
        .catch(function (error) {
          setError(new Error(error.message));
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
  "click .submit-params"(event) {
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
    for (let ptei = 0; ptei < plotTypeElems.length; ptei += 1) {
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
          for (let i = 0; i < options.length; i += 1) {
            if (
              document.getElementById(`${name}-${type}-${options[i]}`).checked === true
            ) {
              p[name] = options[i];
              break;
            }
          }
        } else if (type === matsTypes.InputTypes.checkBoxGroup) {
          p[name] = [];
          for (let i = 0; i < options.length; i += 1) {
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
      document.getElementById("qcParamGroup-item") &&
      document.getElementById("qcParamGroup-item").style.display === "block"
    ) {
      p.completeness = document.getElementById("completeness").value;
    } else if (
      document.getElementById("qcParamGroup-gaps-item") &&
      document.getElementById("qcParamGroup-gaps-item").style.display === "block"
    ) {
      p.completeness = document.getElementById("completeness-gaps").value;
    } else {
      p.completeness = 0;
    }
    if (
      document.getElementById("qcParamGroup-item") &&
      document.getElementById("qcParamGroup-item").style.display === "block"
    ) {
      p.outliers = document.getElementById("outliers").value;
    } else if (
      document.getElementById("qcParamGroup-lite-item") &&
      document.getElementById("qcParamGroup-lite-item").style.display === "block"
    ) {
      p.outliers = document.getElementById("outliers-lite").value;
    } else {
      p.outliers = "all";
    }
    p.noGapsCheck = document.getElementById("noGapsCheck")
      ? document.getElementById("noGapsCheck").checked
      : false;
    Session.set("PlotParams", p);

    let saveAs = "";
    let permission = "";
    let paramData;
    let restoreFrom;
    let pt;
    let pgf;
    let graphFunction;
    let expireKey;
    let x;
    let y;
    let m;
    let d;
    let h;
    let min;
    let sec;
    let submitTime;
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
        if (
          document.getElementById("save_as").value !== "" &&
          document.getElementById("save_as").value !== undefined
        ) {
          saveAs = document.getElementById("save_as").value;
        } else {
          saveAs = document.getElementById("save_to").value;
        }
        permission =
          document.getElementById("save-public").checked === true
            ? "public"
            : "private";
        // console.log("saving settings to " + saveAs);
        Session.set("plotName", saveAs);
        // get the settings to save out of the session
        p = Session.get("PlotParams");
        paramData = matsParamUtils.getElementValues();
        p.paramData = paramData;
        matsMethods.saveSettings
          .callAsync({ saveAs, p, permission })
          .then()
          .catch(function (error) {
            setError(
              new Error(`matsMethods.saveSettings from plot_list.js ${error.message}`)
            );
          });

        document.getElementById("save_as").value = "";
        document.getElementById("save_to").value = "";
        $("#saveModal").modal("hide");
        Session.set("spinner_img", "spinner.gif");
        document.getElementById("spinner").style.display = "none";
        return false;
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
        restoreFrom = document.getElementById("restore_from_private").value;
        if (restoreFrom === "" || restoreFrom === undefined) {
          restoreFrom = document.getElementById("restore_from_public").value;
        }
        // console.log("restore settings from " + restoreFrom);
        Session.set("plotName", restoreFrom);

        p = matsCollections.CurveSettings.findOne({ name: restoreFrom });
        // now set all the curves.... This will refresh the curves list
        matsPlotUtils.restoreSettings(p);
        return false;
      case "plot":
        pt = matsPlotUtils.getPlotType();
        console.log("resizing graph type is ", pt);
        matsGraphUtils.resizeGraph(pt);
        pgf = matsCollections.PlotGraphFunctions.findOne({ plotType: pt });
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

        graphFunction = pgf.graphFunction;
        console.log("prior to getGraphData call time:", new Date());
        // the following line converts a null expireKey to false.
        expireKey = Session.get("expireKey") === true;
        matsMethods.getGraphData
          .callAsync({ plotParams: p, plotType: pt, expireKey })
          .then(function (ret) {
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
            return null;
          })
          .catch(function (error) {
            setError(error);
            matsCurveUtils.resetGraphResult();
            // Session.set ('PlotResultsUpDated', new Date());
            Session.set("spinner_img", "spinner.gif");
            matsCurveUtils.hideSpinner();
            Session.set("expireKey", false);
            return false;
          });
        break;
      case "displayScorecardStatusPage":
        pt = matsPlotUtils.getPlotType();
        console.log("displayScorecardStatusPage plot type is ", pt);
        pgf = matsCollections.PlotGraphFunctions.findOne({ plotType: pt });
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
        graphFunction = pgf.graphFunction;
        console.log("prior to getGraphData call time:", new Date());
        // the following line converts a null expireKey to false.
        expireKey = Session.get("expireKey") === true;
        // add user and name to the plotparams
        if (Meteor.user() === null) {
          p.userName = "anonymous";
        } else {
          p.userName = Meteor.user().emails[0].address;
        }
        x = new Date();
        y = x.getUTCFullYear().toString();
        m = (x.getUTCMonth() + 1).toString();
        d = x.getUTCDate().toString();
        h = x.getUTCHours().toString();
        min = x.getUTCMinutes().toString();
        sec = x.getUTCSeconds().toString();
        if (d.length === 1) {
          d = `0${d}`;
        }
        if (m.length === 1) {
          m = `0${m}`;
        }
        if (h.length === 1) {
          h = `0${h}`;
        }
        if (min.length === 1) {
          min = `0${min}`;
        }
        if (sec.length === 1) {
          sec = `0${sec}`;
        }
        submitTime = y + m + d + h + min + sec;
        // stash the submit epoch in the params
        p.submitEpoch = Math.floor(x.getTime() / 1000);
        p[
          "scorecard-name"
        ] = `${p.userName}--submitted:${submitTime}--${p.curves.length}block`;
        matsMethods.getGraphData
          .callAsync({ plotParams: p, plotType: pt, expireKey })
          .then(function (ret) {
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
            return null;
          })
          .catch(function (error) {
            Session.set("spinner_img", "spinner.gif");
            matsCurveUtils.hideSpinner();
            Session.set("expireKey", false);
            setError(error);
          });
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
    matsMethods.getScorecardSettings
      .callAsync({ settingsKey: Session.get("scorecardTimeseriesKey") })
      .then(function (ret) {
        const settingsJSON = ret.scorecardSettings;
        const parsedSettings = JSON.parse(settingsJSON);
        const commonParams = parsedSettings.commonCurveParams;
        const commonParamKeys = Object.keys(commonParams);

        // add the curves from the scorecard settings and then plot
        addCurvesAndPlot(parsedSettings, commonParamKeys, commonParams).then();
        return null;
      })
      .catch(function (error) {
        if (error.message.includes("DocumentNotFoundError")) {
          setInfo(
            "INFO: No scorecard parameters found for this ID. " +
              "Your URL may have expired. " +
              "They only last for eight hours after a scorecard cell is clicked."
          );
        } else {
          setError(error);
        }
      });
  } else {
    // need to display correct selectors on page load if default plot type is not timeseries
    const plotType = matsPlotUtils.getPlotType();
    Session.set("plotType", plotType); // need to make sure plotType is in the Session this early
    switch (plotType) {
      case matsTypes.PlotTypes.profile:
        matsCurveUtils.showProfileFace();
        break;
      case matsTypes.PlotTypes.dieoff:
        matsCurveUtils.showDieoffFace();
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
      case matsTypes.PlotTypes.gridscaleProb:
        matsCurveUtils.showGridScaleProbFace();
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
      case matsTypes.PlotTypes.timeSeries:
      default:
        matsCurveUtils.showTimeseriesFace();
        break;
    }

    // make sure everything is at default
    matsParamUtils.setAllParamsToDefault();
  }
});
