/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsPlotUtils,
  matsParamUtils,
  matsSelectUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
// eslint-disable-next-line import/no-unresolved
import moment from "moment";
// eslint-disable-next-line import/no-unresolved
import rgbHex from "rgb-hex";
// eslint-disable-next-line import/no-unresolved
import hexRgb from "hex-rgb";

/* global Session, jQuery, $, _ */
/* eslint-disable no-console */

Template.curveItem.helpers({
  removeCurve() {
    const confirmRemoveCurve = Session.get("confirmRemoveCurve");
    return confirmRemoveCurve ? confirmRemoveCurve.label : null;
  },
  displayEditXaxis() {
    if (Session.get("plotType") === matsTypes.PlotTypes.scatter2d) {
      return "block";
    }
    return "none";
  },
  displayEditYaxis() {
    if (Session.get("plotType") === matsTypes.PlotTypes.scatter2d) {
      return "block";
    }
    return "none";
  },
  displayEdit() {
    if (Session.get("plotType") === matsTypes.PlotTypes.scatter2d) {
      return "none";
    }
    return "block";
  },
  text() {
    if (this.diffFrom === undefined) {
      let plotType = Session.get("plotType");
      if (plotType === undefined) {
        const pfuncs = matsCollections.PlotGraphFunctions.find({}).fetch();
        for (let i = 0; i < pfuncs.length; i += 1) {
          if (pfuncs[i].checked === true) {
            Session.set("plotType", pfuncs[i].plotType);
          }
        }
        plotType = Session.get("plotType");
      }
      if (this.region) {
        [this.regionName] = this.region.split(" ");
      }
      return matsPlotUtils.getCurveText(plotType, this).then();
    }
    return `${this.label}:  Difference`;
  },
  color() {
    return this.color;
  },
  colorHex() {
    return `#${rgbHex(this.color)}`;
  },
  label() {
    return this.label;
  },
  defaultColor() {
    const curves = Session.get("Curves");
    const { label } = this;
    for (let i = 0; i < curves.length; i += 1) {
      if (curves[i].label === label) {
        return curves[i].color;
      }
    }
    return null;
  },
  defaultColorHex() {
    const curves = Session.get("Curves");
    const { label } = this;
    for (let i = 0; i < curves.length; i += 1) {
      if (curves[i].label === label) {
        return `#${rgbHex(curves[i].color)}`;
      }
    }
    return null;
  },
  curveNumber() {
    const { label } = this;
    const curves = Session.get("Curves");
    const index = curves.findIndex(function (obj) {
      return obj.label === label;
    });
    return index;
  },
  log() {
    console.log(this);
  },
  DBcurve() {
    return this.diffFrom === undefined;
  },
  editingThis() {
    return Session.get("editMode") === this.label;
  },
  editCurve() {
    return Session.get("editMode");
  },
  editTarget() {
    return Session.get("eventTargetCurve");
  },
});

const setParamsToAxis = function (newAxis, currentParams) {
  // reset scatter plot apply stuff
  matsCurveUtils.resetScatterApply();
  // set param values to this curve
  // reset the form parameters for the superiors first
  let currentParamName;
  const paramNames = matsCollections.CurveParamsInfo.findOne({
    curve_params: { $exists: true },
  }).curve_params;
  let params = [];
  const superiors = [];
  const dependents = [];
  // get all of the curve param collections in one place
  for (let pidx = 0; pidx < paramNames.length; pidx += 1) {
    const param = matsCollections[paramNames[pidx]].findOne({});
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
  for (let s = 0; s < superiors.length; s += 1) {
    const plotParam = superiors[s];
    // do any date parameters - there are no axis date params in a scatter plot
    if (plotParam.type === matsTypes.InputTypes.dateRange) {
      if (currentParams[plotParam.name] !== undefined) {
        const dateArr = currentParams[plotParam.name].split(" - ");
        const from = dateArr[0];
        const to = dateArr[1];
        const idref = `#${plotParam.name}-${plotParam.type}`;
        $(idref)
          .data("daterangepicker")
          .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
        $(idref).data("daterangepicker").setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
        matsParamUtils.setValueTextForParamName(
          plotParam.name,
          currentParams[plotParam.name]
        );
      }
    } else {
      currentParamName =
        currentParams[`${newAxis}-${plotParam.name}`] === undefined
          ? plotParam.name
          : `${newAxis}-${plotParam.name}`;
      const val =
        currentParams[currentParamName] === null ||
        currentParams[currentParamName] === undefined
          ? matsTypes.InputTypes.unused
          : currentParams[currentParamName];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
  }
  // now reset the form parameters for the dependents
  const combParams = _.union(params, dependents);
  for (let p = 0; p < combParams.length; p += 1) {
    const plotParam = combParams[p];
    // do any plot date parameters
    currentParamName =
      currentParams[`${newAxis}-${plotParam.name}`] === undefined
        ? plotParam.name
        : `${newAxis}-${plotParam.name}`;
    if (plotParam.type === matsTypes.InputTypes.dateRange) {
      if (currentParams[currentParamName] !== undefined) {
        const dateArr = currentParams[currentParamName].split(" - ");
        const from = dateArr[0];
        const to = dateArr[1];
        const idref = `#${plotParam.name}-${plotParam.type}`;
        $(idref)
          .data("daterangepicker")
          .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
        $(idref).data("daterangepicker").setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
        matsParamUtils.setValueTextForParamName(
          plotParam.name,
          currentParams[currentParamName]
        );
      }
    } else {
      const val =
        currentParams[currentParamName] === null ||
        currentParams[currentParamName] === undefined
          ? matsTypes.InputTypes.unused
          : currentParams[currentParamName];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
  }
  // reset the scatter parameters
  params = matsCollections.Scatter2dParams.find({}).fetch();
  for (let p = 0; p < params.length; p += 1) {
    const plotParam = params[p];
    currentParamName =
      currentParams[`${newAxis}-${plotParam.name}`] === undefined
        ? plotParam.name
        : `${newAxis}-${plotParam.name}`;
    const val =
      currentParams[currentParamName] === null ||
      currentParams[currentParamName] === undefined
        ? matsTypes.InputTypes.unused
        : currentParams[currentParamName];
    matsParamUtils.setInputForParamName(plotParam.name, val);
  }
  matsParamUtils.collapseParams();
  return false;
};

const correlateEditPanelToCurveItems = function (
  params,
  currentParams,
  doCheckHideOther
) {
  for (let p = 0; p < params.length; p += 1) {
    const plotParam = params[p];
    // do any plot date parameters
    if (plotParam.type === matsTypes.InputTypes.dateRange) {
      if (currentParams[plotParam.name] !== undefined) {
        const dateArr = currentParams[plotParam.name].split(" - ");
        const from = dateArr[0];
        const to = dateArr[1];
        const idref = `#${plotParam.name}-${plotParam.type}`;
        $(idref)
          .data("daterangepicker")
          .setStartDate(moment.utc(from, "MM-DD-YYYY HH:mm"));
        $(idref).data("daterangepicker").setEndDate(moment.utc(to, "MM-DD-YYYY HH:mm"));
        matsParamUtils.setValueTextForParamName(
          plotParam.name,
          currentParams[plotParam.name]
        );
      }
    } else {
      const val =
        currentParams[plotParam.name] === null ||
        currentParams[plotParam.name] === undefined
          ? matsTypes.InputTypes.unused
          : currentParams[plotParam.name];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
    if (currentParams[plotParam.name] !== undefined && doCheckHideOther) {
      matsSelectUtils.checkHideOther(plotParam, false);
    }
  }
};

let curveListEditNode; // used to pass the edit button to the modal continue
Template.curveItem.events({
  "click .save-changes"() {
    $(".displayBtn").css({ border: "" }); // clear any borders from any display buttons
    document.getElementById("save").click();
    Session.set("paramWellColor", "#f5f5f5");
  },
  "click .cancel"() {
    $(".displayBtn").css({ border: "" }); // clear any borders from any display buttons
    document.getElementById("cancel").click();
    Session.set("paramWellColor", "#f5f5f5");
  },
  "click .remove-curve"() {
    const removeCurve = Session.get("confirmRemoveCurve");
    if (removeCurve && removeCurve.confirm) {
      const { label } = removeCurve;
      const { color } = removeCurve;
      const Curves = _.reject(Session.get("Curves"), function (item) {
        return item.label === label;
      });
      Session.set("Curves", Curves);
      matsCurveUtils.clearUsedLabel(label);
      matsCurveUtils.clearUsedColor(color);
      matsCurveUtils.checkDiffs();
      Session.set("confirmRemoveCurve", "");
      Session.set("lastUpdate", Date.now());
      if (Curves.length === 0) {
        window.location.reload(true);
      }
      return false;
    }
    Session.set("confirmRemoveCurve", { label: this.label, color: this.color });
    $("#removeCurveModal").modal("show");
    return null;
  },
  "click .confirm-remove-curve"() {
    const confirmCurve = Session.get("confirmRemoveCurve");
    Session.set("confirmRemoveCurve", {
      label: confirmCurve.label,
      color: confirmCurve.color,
      confirm: true,
    });
    $("#curve-list-remove").trigger("click");
  },
  "click .edit-curve-xaxis"() {
    Session.set("axis", "xaxis");
    Session.set("editMode", this.label);
    const currentParams = jQuery.extend({}, this);
    setParamsToAxis("xaxis", currentParams);
  },
  "click .edit-curve-yaxis"() {
    Session.set("axis", "yaxis");
    Session.set("editMode", this.label);
    const currentParams = jQuery.extend({}, this);
    setParamsToAxis("yaxis", currentParams);
  },
  "click .edit-curve"(event) {
    const srcEditButton = event.currentTarget;
    const { name } = srcEditButton;
    const editingCurve = Session.get("editMode");
    curveListEditNode = $(
      event.currentTarget.parentNode.parentNode.parentNode.parentNode
    ).find("#curve-list-edit");
    const eventTargetCurve = $(event.currentTarget.parentNode.parentNode.parentNode)
      .find(".display-item-label")
      .text()
      .trim();
    Session.set("eventTargetCurve", eventTargetCurve);
    Session.set("intendedActiveDisplayButton", name);
    Session.set("activeDisplayButton", name);
    if (
      editingCurve !== undefined &&
      editingCurve !== "" &&
      editingCurve !== eventTargetCurve
    ) {
      // editing a different curve // have to do the modal for confirmation
      $("#confirm-lost-edits").modal();
      return;
    }
    Session.set("editMode", this.label);
    // reset scatter plot apply stuff
    matsCurveUtils.resetScatterApply();
    // capture the current parameters from the curveItem
    const currentParams = jQuery.extend({}, this);
    // set param values to this curve
    // reset the form parameters for the superiors first
    const paramNames = matsCollections.CurveParamsInfo.findOne({
      curve_params: { $exists: true },
    }).curve_params;
    let params = [];
    const superiors = [];
    const hidden = [];
    // get all of the curve param collections in one place
    for (let pidx = 0; pidx < paramNames.length; pidx += 1) {
      const param = matsCollections[paramNames[pidx]].findOne({});
      // superiors
      if (param.dependentNames !== undefined) {
        superiors.push(param);
      }
      // hidden
      if (param.hideOtherFor !== undefined || param.disableOtherFor !== undefined) {
        hidden.push(param);
      }
      // everything else
      if (superiors.indexOf(param) === -1 && hidden.indexOf(param) === -1) {
        params.push(param);
      }
    }
    for (let p = 0; p < superiors.length; p += 1) {
      const plotParam = superiors[p];
      // do any curve date parameters
      if (plotParam.type === matsTypes.InputTypes.dateRange) {
        if (currentParams[plotParam.name] !== undefined) {
          const dateArr = currentParams[plotParam.name].split(" - ");
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
            currentParams[plotParam.name]
          );
        }
      } else {
        const val =
          currentParams[plotParam.name] === null ||
          currentParams[plotParam.name] === undefined
            ? matsTypes.InputTypes.unused
            : currentParams[plotParam.name];
        matsParamUtils.setInputForParamName(plotParam.name, val);
        // refresh its dependents
        matsSelectUtils.refreshDependents(null, plotParam);
      }
    }
    // now reset the form parameters for anything with hide/disable controls
    correlateEditPanelToCurveItems(hidden, currentParams, true);

    // now reset the form parameters for everything else
    correlateEditPanelToCurveItems(params, currentParams, false);

    // reset the scatter parameters
    params = matsCollections.Scatter2dParams.find({}).fetch();
    for (let p = 0; p < params.length; p += 1) {
      const plotParam = params[p];
      const val =
        currentParams[plotParam.name] === null ||
        currentParams[plotParam.name] === undefined
          ? matsTypes.InputTypes.unused
          : currentParams[plotParam.name];
      matsParamUtils.setInputForParamName(plotParam.name, val);
    }
    matsParamUtils.collapseParams();
  },
  "click .displayBtn"(event) {
    const srcDisplayButton = event.currentTarget;
    const { name } = srcDisplayButton;
    const inputElem = matsParamUtils.getInputElementForParamName(name);
    const controlElem = matsParamUtils.getControlElementForParamName(name);
    const editingCurve = Session.get("editMode");
    if (name.startsWith("xaxis")) {
      curveListEditNode = $(
        event.currentTarget.parentNode.parentNode.parentNode.parentNode
      ).find("#curve-list-edit-xaxis");
    } else if (name.startsWith("yaxis")) {
      curveListEditNode = $(
        event.currentTarget.parentNode.parentNode.parentNode.parentNode
      ).find("#curve-list-edit-yaxis");
    } else if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      // for a scatter param that is not axis specific we still have to choos an axis - just choose x
      curveListEditNode = $(
        event.currentTarget.parentNode.parentNode.parentNode.parentNode
      ).find("#curve-list-edit-xaxis");
    } else {
      curveListEditNode = $(
        event.currentTarget.parentNode.parentNode.parentNode.parentNode
      ).find("#curve-list-edit");
    }
    const eventTargetCurve = $(event.currentTarget.parentNode.parentNode.parentNode)
      .find(".display-item-label")
      .text()
      .trim();
    Session.set("eventTargetCurve", eventTargetCurve);
    Session.set("intendedActiveDisplayButton", name);
    Session.set("activeDisplayButton", name);
    if (
      editingCurve !== undefined &&
      editingCurve !== "" &&
      editingCurve !== eventTargetCurve
    ) {
      // editing a different curve // have to do the modal for confirmation
      $("#confirm-lost-edits").modal();
      return;
    }
    if (inputElem) {
      inputElem.focus();
    }
    curveListEditNode.click();
    if (controlElem) {
      controlElem.click();
    }
    Session.set("elementChanged", Date.now());
  },
  "click .continue-lose-edits"() {
    const intendedName = Session.get("intendedActiveDisplayButton");
    Session.set("activeDisplayButton", intendedName);
    document.getElementById("cancel").click();
    Session.set("paramWellColor", "#f5f5f5");
    const controlElem = matsParamUtils.getControlElementForParamName(intendedName);
    const inputElem = matsParamUtils.getInputElementForParamName(intendedName);
    if (inputElem) {
      inputElem.focus();
    }
    curveListEditNode.click();
    if (controlElem) {
      controlElem.click();
    }
    Session.set("elementChanged", Date.now());
  },
  "click .cancel-lose-edits"() {
    // don't change the active button
    const name = Session.get("activeDisplayButton");
    const controlElem = matsParamUtils.getControlElementForParamName(name);
    const inputElem = matsParamUtils.getInputElementForParamName(name);
    if (inputElem) {
      inputElem.focus();
    }
    if (controlElem) {
      controlElem.click();
    }
    Session.set("elementChanged", Date.now());
  },
  "change .color-picker"() {
    const curves = Session.get("Curves");
    $("input[id$=color-picker]")
      .get()
      .forEach(function (elem) {
        if (elem.value !== undefined && elem.value !== "") {
          const label = elem.id.split("-")[0];
          for (let i = 0; i < curves.length; i += 1) {
            if (curves[i].label === label) {
              curves[i].color = hexRgb(elem.value, { format: "css" });
            }
          }
        }
      });
    Session.set("Curves", curves);
  },
});
