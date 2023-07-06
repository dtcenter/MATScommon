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

function shadeRGBColor(color, percent) {
  const f = color.split(",");
  const t = percent < 0 ? 0 : 255;
  const p = percent < 0 ? percent * -1 : percent;
  const R = parseInt(f[0].slice(4));
  const G = parseInt(f[1]);
  const B = parseInt(f[2]);
  return `rgb(${Math.round((t - R) * p) + R},${Math.round((t - G) * p) + G},${
    Math.round((t - B) * p) + B
  })`;
}

Template.paramList.helpers({
  CurveParamGroups() {
    const lastUpdate = Session.get("lastUpdate");
    const groupNums = [];
    const params = matsCollections.CurveParamsInfo.find({
      curve_params: { $exists: true },
    }).fetch()[0].curve_params;
    let param;
    for (let i = 0; i < params.length; i++) {
      param = matsCollections[params[i]].find({}).fetch()[0];
      if (param !== undefined) {
        groupNums.push(param.displayGroup);
      }
    }
    const res = _.uniq(groupNums).sort();
    return res;
  },
  isEdit() {
    return Session.get("editMode") !== "";
  },
  log() {
    console.log(this);
  },
  paramWellColor() {
    if (Session.get("paramWellColor") === undefined) {
      Session.set("paramWellColor", "rgb(245,245,245)");
    }
    if (Session.get("editMode") !== "") {
      const curveBeingEdited = $.grep(Session.get("Curves"), function (c) {
        return c.label === Session.get("editMode");
      });
      if (curveBeingEdited === undefined || curveBeingEdited[0] === undefined) {
        Session.set("paramWellColor", "rgb(245,245,245)");
        return "rgb(245,245,245)";
      }
      const { color } = curveBeingEdited[0];
      const lighterShadeOfColor = shadeRGBColor(color, 0.2);
      Session.set("paramWellColor", lighterShadeOfColor);
    }

    return Session.get("paramWellColor");
  },
});

Template.paramList.events({
  "click .edit-cancel"() {
    Session.set("editMode", "");
    Session.set("paramWellColor", "rgb(245,245,245)");
    const labelId = `label-${matsTypes.InputTypes.textInput}`;
    const label = document.getElementById(labelId);
    label.disabled = false;
    // reset parameters to match edited curve.....
    matsParamUtils.setInputForParamName("label", matsCurveUtils.getNextCurveLabel());
    matsParamUtils.collapseParams();
  },
  "click .reset"(event, template) {
    event.preventDefault();
    Session.set("paramWellColor", "rgb(245,245,245)");
    matsMethods.refreshMetaData.call({}, function (error, result) {
      if (error !== undefined) {
        setError(new Error(error.message));
      }
      matsParamUtils.setAllParamsToDefault();
    });
  },
  "click .expand"() {
    matsParamUtils.expandParams();
  },
  "click .collapse"() {
    matsParamUtils.collapseParams();
  },
  // restore settings
  "click .restore-settings"(event) {
    Session.set("paramWellColor", "rgb(245,245,245)");
    event.preventDefault();
    document.getElementById("restore-settings").click();
    return false;
  },
  // add curve
  // save changes
  /*
        Note: when adding a curve or saving changes after editing a curve there is a special
        case for scatter plots. Each hidden axis parameter must get set with the value from the regular parameter.
     */
  "submit form"(event, template) {
    event.preventDefault();
    if (!matsParamUtils.getValueForParamName("label")) {
      setError("Label cannot be blank");
      return;
    }
    const isScatter = matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d;
    const isMap = matsPlotUtils.getPlotType() === matsTypes.PlotTypes.map;
    const isReliability =
      matsPlotUtils.getPlotType() === matsTypes.PlotTypes.reliability;
    const isContour = matsPlotUtils.getPlotType() === matsTypes.PlotTypes.contour;
    const isContourDiff =
      matsPlotUtils.getPlotType() === matsTypes.PlotTypes.contourDiff;
    const curves = Session.get("Curves");
    const p = {};
    const elems = event.target.valueOf().elements;
    let curveNames = matsCollections.CurveParamsInfo.find({
      curve_params: { $exists: true },
    }).fetch()[0].curve_params;
    const dateParamNames = [];
    let param;
    // remove any hidden params (not unused ones -- unused is a valid state)
    // iterate backwards so that we can splice to remove
    for (let cindex = curveNames.length - 1; cindex >= 0; cindex--) {
      const cname = curveNames[cindex];
      param = matsCollections[cname].find({}).fetch()[0];
      if (param.type === matsTypes.InputTypes.dateRange) {
        dateParamNames.push(cname);
      }
    }

    // remove any hidden date params or unused ones
    // iterate backwards so that we can splice to remove
    // dates are a little different - there is no element named paramName-paramtype
    // because of the way daterange widgets are attached (--There is now but this still works--)
    // Instead we have to look for a document element with an id element-paramName
    for (let dindex = dateParamNames.length - 1; dindex >= 0; dindex--) {
      const dElem = document.getElementById(`${dateParamNames[dindex]}-item`);
      if (dElem && dElem.style && dElem.style.display === "none") {
        dateParamNames.splice(dindex, 1);
      }
    }
    if (isScatter) {
      const scatterCurveNames = [];
      for (var i = 0; i < curveNames.length; i++) {
        scatterCurveNames.push(curveNames[i]);
        scatterCurveNames.push(`xaxis-${curveNames[i]}`);
        scatterCurveNames.push(`yaxis-${curveNames[i]}`);
      }
      curveNames = scatterCurveNames;
    }
    const paramElems = _.filter(elems, function (elem) {
      return _.contains(curveNames, elem.name);
    });
    // add in any date params (they aren't technically elements)
    paramElems.push.apply(paramElems, dateParamNames);
    // add in the scatter2d parameters if it is a scatter plot.
    if (isScatter) {
      $(":input[id^='Fit-Type']:input[name*='Fit-Type']").each(function () {
        paramElems.push(this);
      });
    }
    const l = paramElems.length;
    if (Session.get("editMode")) {
      const changingCurveLabel = Session.get("editMode");
      Session.set("editMode", "");
      Session.set("paramWellColor", "rgb(245,245,245)");
      const labelId = `label-${matsTypes.InputTypes.textInput}`;
      const label = document.getElementById(labelId);
      label.disabled = false;

      for (var i = 0; i < l; i++) {
        if (paramElems[i].name === "label") {
          p[paramElems[i].name] = changingCurveLabel; // don't change the label when editing a curve
          continue;
        }
        if (paramElems[i] instanceof Element === false) {
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
      for (var i = 0; i < curves.length; i++) {
        if (curves[i].label === p.label) {
          index = i;
          p.color = curves[i].color;
        }
      }
      if (index !== -1) {
        if (isScatter) {
          // copy the params to the current axis paremeters
          const axis = Session.get("axis");
          const axisParams = Object.keys(p).filter(function (key) {
            return key.startsWith(axis);
          });
          for (let api = 0; api < axisParams.length; api++) {
            const ap = axisParams[api];
            const pp = ap.replace(`${axis}-`, "");
            p[ap] = p[pp];
            curves[index][ap] = p[pp];
          }
          curves[index]["Fit-Type"] = p["Fit-Type"];
        } else {
          curves[index] = p;
        }
      }
    } else {
      if (isMap && curves.length >= 1) {
        setError(new Error("ERROR: Map plot-type can only have one curve!"));
        return false;
      }
      if (isContour && curves.length >= 1) {
        setError(new Error("ERROR: Contour plot-type can only have one curve!"));
        return false;
      }
      if (isContourDiff && curves.length >= 2) {
        setError(new Error("ERROR: Contour Diff plot-type can only have two curves!"));
        return false;
      }
      if (isReliability && curves.length >= 1) {
        setError(
          new Error("ERROR: Reliability plot-type can only have one curve right now!")
        );
        return false;
      }
      for (var i = 0; i < l; i++) {
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
        } else if (isScatter) {
          p[paramElems[i].name] = paramElems[i].value;
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
