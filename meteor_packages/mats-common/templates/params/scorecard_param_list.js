/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsCurveUtils,
  matsPlotUtils,
  matsParamUtils,
  matsMethods,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $, _, setError */
/* eslint-disable no-console */

function shadeRGBColor(color, percent) {
  const f = color.split(",");
  const t = percent < 0 ? 0 : 255;
  const p = percent < 0 ? percent * -1 : percent;
  const R = parseInt(f[0].slice(4), 10);
  const G = parseInt(f[1], 10);
  const B = parseInt(f[2], 10);
  return `rgb(${Math.round((t - R) * p) + R},${Math.round((t - G) * p) + G},${
    Math.round((t - B) * p) + B
  })`;
}

Template.scorecardParamList.helpers({
  CurveParamGroups() {
    Session.get("lastUpdate");
    const groupNums = [];
    const params = matsCollections.CurveParamsInfo.findOne({
      curve_params: { $exists: true },
    }).curve_params;
    let param;
    for (let i = 0; i < params.length; i += 1) {
      if (
        matsCollections[params[i]].find({}).fetch() !== undefined &&
        matsCollections[params[i]].find({}).fetch().length !== 0
      ) {
        [param] = matsCollections[params[i]].find({}).fetch();
        groupNums.push(param.displayGroup);
      }
    }
    const res = _.uniq(groupNums).sort();
    return res;
  },
  isEdit() {
    return Session.get("editMode") !== "" && Session.get("editMode") !== undefined;
  },
  log() {
    console.log(this);
  },
  paramWellColor() {
    if (Session.get("paramWellColor") === undefined) {
      Session.set("paramWellColor", "#ffffff");
    }
    if (Session.get("editMode") !== "") {
      const curveBeingEdited = $.grep(Session.get("Curves"), function (c) {
        return c.label === Session.get("editMode");
      });
      if (curveBeingEdited === undefined || curveBeingEdited[0] === undefined) {
        Session.set("paramWellColor", "#ffffff");
        return "#ffffff";
      }
      const { color } = curveBeingEdited[0];
      const lighterShadeOfColor = shadeRGBColor(color, 0.2);
      Session.set("paramWellColor", lighterShadeOfColor);
    }

    return Session.get("paramWellColor");
  },
});

Template.scorecardParamList.events({
  "click .edit-cancel"() {
    Session.set("editMode", "");
    Session.set("paramWellColor", "#ffffff");
    const labelId = `label-${matsTypes.InputTypes.textInput}`;
    const label = document.getElementById(labelId);
    label.disabled = false;
    // reset parameters to match edited curve.....
    matsParamUtils.setInputForParamName("label", matsCurveUtils.getNextCurveLabel());
    matsParamUtils.collapseParams();
  },
  "click .reset"(event) {
    event.preventDefault();
    Session.set("paramWellColor", "#ffffff");
    matsMethods.refreshMetaData
      // eslint-disable-next-line no-unused-vars
      .callAsync({})
      .then(function () {
        matsParamUtils.setAllParamsToDefault();
      })
      .catch(function (error) {
        setError(new Error(error.message));
      });
  },
  // restore settings
  "click .restore-settings"(event) {
    Session.set("paramWellColor", "#ffffff");
    event.preventDefault();
    document.getElementById("restore-settings").click();
    return false;
  },
  // add curve
  // save changes
  "submit form"(event) {
    event.preventDefault();
    if (!matsParamUtils.getValueForParamName("label")) {
      setError("Label cannot be blank");
      return false;
    }
    const curves = Session.get("Curves");
    const p = {};
    const elems = event.target.valueOf().elements;
    const curveNames = matsCollections.CurveParamsInfo.findOne({}).curve_params;
    const dateParamNames = [];
    let param;
    // remove any hidden params (not unused ones  -= 1 unused is a valid state)
    // iterate backwards so that we can splice to remove
    for (let cindex = curveNames.length - 1; cindex >= 0; cindex -= 1) {
      const cname = curveNames[cindex];
      param = matsCollections[cname].findOne({});
      if (param.type === matsTypes.InputTypes.dateRange) {
        dateParamNames.push(cname);
      }
      const ctlElem = document.getElementById(`${cname}-item`);
      const isHidden =
        (matsParamUtils.getInputElementForParamName(cname) &&
          matsParamUtils.getInputElementForParamName(cname).style &&
          matsParamUtils.getInputElementForParamName(cname).style.display === "none") ||
        (ctlElem && ctlElem.style && ctlElem.style.display === "none");
      if (isHidden && cname !== "plot-type" && cname !== "phase") {
        // MET apps have a hidden plot-type selector that needs to be included in the curve
        // phase needs to be preserved in the raobamdar app
        curveNames.splice(cindex, 1);
      }
    }

    // remove any hidden date params or unused ones
    // iterate backwards so that we can splice to remove
    // dates are a little different - there is no element named paramName-paramtype because of the way daterange widgets are attached
    // Instead we have to look for a document element with an id element-paramName
    for (let dindex = dateParamNames.length - 1; dindex >= 0; dindex -= 1) {
      const dElem = document.getElementById(`${dateParamNames[dindex]}-item`);
      if (dElem && dElem.style && dElem.style.display === "none") {
        dateParamNames.splice(dindex, 1);
      }
    }
    const paramElems = _.filter(elems, function (elem) {
      return _.contains(curveNames, elem.name);
    });
    // add in any date params (they aren't technically elements)
    paramElems.concat(dateParamNames);
    const l = paramElems.length;
    if (Session.get("editMode")) {
      const changingCurveLabel = Session.get("editMode");
      Session.set("editMode", "");
      Session.set("paramWellColor", "#ffffff");
      const labelId = `label-${matsTypes.InputTypes.textInput}`;
      const label = document.getElementById(labelId);
      label.disabled = false;

      for (let i = 0; i < l; i += 1) {
        if (paramElems[i].name === "label") {
          p[paramElems[i].name] = changingCurveLabel; // don't change the label when editing a curve
        } else if (paramElems[i] instanceof Element === false) {
          // isn't really an element - must be a date field - these are only strings
          p[paramElems[i]] = matsParamUtils.getValueForParamName(paramElems[i]);
        } else if (paramElems[i].type === "select-multiple") {
          // define a p value if it doesn't exist (necessary for adding truth values)
          p[paramElems[i].name] =
            p[paramElems[i].name] === undefined ? "" : p[paramElems[i].name];
          // sometimes multi-selects will have "unused" as a value. This is fine, the data routines are set up to handle it.
          if (
            matsParamUtils.getValueForParamName(paramElems[i].name) ===
            matsTypes.InputTypes.unused
          ) {
            p[paramElems[i].name] = matsTypes.InputTypes.unused;
          } else {
            p[paramElems[i].name] = $(paramElems[i].selectedOptions)
              .map(function () {
                return this.value;
              })
              .get();
          }
        } else if (paramElems[i].type === "radio") {
          if (paramElems[i].checked) {
            p[paramElems[i].name] = paramElems[i].value;
          }
        } else if (paramElems[i].type === "checkbox") {
          if (paramElems[i].checked) {
            p[paramElems[i].name].push(paramElems[i].value);
          }
        } else if (paramElems[i].type === "button") {
          p[paramElems[i].id] = paramElems[i].value;
        } else {
          p[paramElems[i].name] = paramElems[i].value;
        }
      }
      let index = -1;
      for (let i = 0; i < curves.length; i += 1) {
        if (curves[i].label === p.label) {
          index = i;
          p.color = curves[i].color;
        }
      }
      if (index !== -1) {
        curves[index] = p;
      }
    } else {
      for (let i = 0; i < l; i += 1) {
        if (paramElems[i] instanceof Element === false) {
          // isn't really an element - must be a date field - these are only strings
          p[paramElems[i]] = matsParamUtils.getValueForParamName(paramElems[i]);
        } else if (paramElems[i].type === "select-multiple") {
          // sometimes multi-selects will have "unused" as a value. This is fine, the data routines are set up to handle it.
          if (
            matsParamUtils.getValueForParamName(paramElems[i].name) ===
            matsTypes.InputTypes.unused
          ) {
            p[paramElems[i].name] = matsTypes.InputTypes.unused;
          } else {
            p[paramElems[i].name] = $(paramElems[i].selectedOptions)
              .map(function () {
                return this.value;
              })
              .get();
          }
        } else if (paramElems[i].type === "radio") {
          if (paramElems[i].checked) {
            p[paramElems[i].name] = paramElems[i].value;
          }
        } else if (paramElems[i].type === "checkbox") {
          if (paramElems[i].checked) {
            if (p[paramElems[i].name] === undefined) {
              p[paramElems[i].name] = [];
            }
            p[paramElems[i].name].push(paramElems[i].value);
          }
        } else if (paramElems[i].type === "button") {
          p[paramElems[i].id] = paramElems[i].value;
        } else {
          p[paramElems[i].name] = matsParamUtils.getValueForParamName(
            paramElems[i].name
          );
        }
        if (paramElems[i].name && paramElems[i].name === "label") {
          if (_.indexOf(matsCurveUtils.getUsedLabels(), paramElems[i].value) !== -1) {
            setError(
              new Error(
                `labels need to be unique - change ${paramElems[i].value} to something else`
              )
            );
            return false;
          }
        }
      }

      p.color = matsCurveUtils.getNextCurveColor();
      curves.push(p);
      const elem = document.getElementById("curveList");
      elem.style.display = "block";
    }

    Session.set("Curves", curves);
    matsCurveUtils.setUsedColorsAndLabels(); // we have used a color and label so we have to set the next one
    matsCurveUtils.checkDiffs();
    matsParamUtils.collapseParams();
    matsParamUtils.setInputForParamName("label", matsCurveUtils.getNextCurveLabel());
    return false;
  },
});

Template.paramList.onRendered(function () {
  Session.set("displayPriority", 1);
  Session.set("editMode", "");

  // hide sites and sitesMap selectors for anything that isn't a map plot or wfip2
  let elem;
  const ptype = matsPlotUtils.getPlotType();
  elem = document.getElementById("sites-item");
  let sitesParamHidden;
  if (elem && elem.style) {
    if (matsCollections.sites !== undefined) {
      sitesParamHidden = matsCollections.sites.findOne({
        name: "sites",
      }).hiddenForPlotTypes;
      if (sitesParamHidden) {
        if (sitesParamHidden.indexOf(ptype) === -1) {
          elem.style.display = "block";
        } else {
          elem.style.display = "none";
        }
      }
    }
  }
  elem = document.getElementById("sitesMap-item");
  if (elem && elem.style) {
    if (matsCollections.sitesMap !== undefined) {
      sitesParamHidden = matsCollections.sitesMap.findOne({
        name: "sitesMap",
      }).hiddenForPlotTypes;
      if (sitesParamHidden) {
        if (sitesParamHidden.indexOf(ptype) === -1) {
          elem.style.display = "block";
        } else {
          elem.style.display = "none";
        }
      }
    }
  }
});
