/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
  matsPlotUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session */
/* eslint-disable no-console */

const allGroups = {};
Template.curveParamItemGroup.helpers({
  curveParamGroups(c) {
    const { label } = c;
    const curves = Session.get("Curves");
    const index = curves.findIndex(function (obj) {
      return obj.label === label;
    });

    // create a set of groups each with an array of 6 params for display
    Session.get("lastUpdate");
    const plotType = matsPlotUtils.getPlotType();
    // derive the sorted pValues, xpValues, and ypValues from the sorted params and the elementValues
    const pValues = [];
    let pattern;
    switch (plotType) {
      case matsTypes.PlotTypes.profile:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.profile,
        });
        break;
      case matsTypes.PlotTypes.dieoff:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.dieoff,
        });
        break;
      case matsTypes.PlotTypes.threshold:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.threshold,
        });
        break;
      case matsTypes.PlotTypes.validtime:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.validtime,
        });
        break;
      case matsTypes.PlotTypes.gridscale:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.gridscale,
        });
        break;
      case matsTypes.PlotTypes.dailyModelCycle:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.dailyModelCycle,
        });
        break;
      case matsTypes.PlotTypes.yearToYear:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.yearToYear,
        });
        break;
      case matsTypes.PlotTypes.reliability:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.reliability,
        });
        break;
      case matsTypes.PlotTypes.roc:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.roc,
        });
        break;
      case matsTypes.PlotTypes.performanceDiagram:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.performanceDiagram,
        });
        break;
      case matsTypes.PlotTypes.gridscaleProb:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.gridscaleProb,
        });
        break;
      case matsTypes.PlotTypes.map:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.map,
        });
        break;
      case matsTypes.PlotTypes.histogram:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.histogram,
        });
        break;
      case matsTypes.PlotTypes.ensembleHistogram:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.ensembleHistogram,
        });
        break;
      case matsTypes.PlotTypes.contour:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.contour,
        });
        break;
      case matsTypes.PlotTypes.contourDiff:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.contourDiff,
        });
        break;
      case matsTypes.PlotTypes.simpleScatter:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.simpleScatter,
        });
        break;
      case matsTypes.PlotTypes.scorecard:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.scorecard,
        });
        break;
      case matsTypes.PlotTypes.timeSeries:
      default:
        pattern = matsCollections.CurveTextPatterns.findOne({
          plotType: matsTypes.PlotTypes.timeSeries,
        });
        break;
    }
    const { groupSize } = pattern;
    const { displayParams } = pattern;
    for (let di = 0; di < displayParams.length; di += 1) {
      pValues.push({
        name: displayParams[di],
        value: c[displayParams[di]],
        color: c.color,
        curve: c.label,
        index,
      });
    }

    // create array of parameter value display groups each of groupSize
    const pGroups = [];
    let groupParams = [];
    let pvi = 0;
    while (pvi < pValues.length) {
      if (
        pValues[pvi] &&
        (pValues[pvi].name === "xaxis" || pValues[pvi].name === "yaxis")
      ) {
        if (groupParams.length > 0) {
          // finish the old group and make a new group for 'xaxis' or 'yaxis'
          pGroups.push(groupParams);
        }
        groupParams = [];
      }
      if (pValues[pvi]) {
        groupParams.push(pValues[pvi]);
      }
      if (groupParams.length >= groupSize) {
        pGroups.push(groupParams);
        groupParams = [];
      }
      pvi += 1;
    }
    // check for a partial last group
    if (groupParams.length > 0) {
      pGroups.push(groupParams);
    }
    allGroups[c.label] = pGroups;
    return pGroups;
  },
  curveNumber(elem) {
    return elem.index;
  },
  curveParams(paramGroup) {
    return paramGroup;
  },
  label(elem) {
    let pLabel = "";
    if (matsCollections[elem.name] !== undefined) {
      const p = matsCollections[elem.name].findOne({ name: elem.name });
      if (p.controlButtonText) {
        pLabel = p.controlButtonText;
      } else {
        pLabel = elem.name;
      }
    }
    // Make everything title case
    pLabel = pLabel.split(" ");
    for (let i = 0; i < pLabel.length; i += 1) {
      pLabel[i] = pLabel[i].charAt(0).toUpperCase() + pLabel[i].slice(1);
      pLabel[i] = pLabel[i] === "Utc" ? "UTC" : pLabel[i];
    }
    pLabel = pLabel.join(" ").split("-");
    for (let i = 0; i < pLabel.length; i += 1) {
      pLabel[i] = pLabel[i].charAt(0).toUpperCase() + pLabel[i].slice(1);
    }
    return pLabel.join(" ");
  },
  name(elem) {
    return elem.name;
  },
  id(elem) {
    return elem.name;
  },
  buttonId(elem) {
    const name = elem.name.toString();
    const upperName = name.toUpperCase();
    const curveNumber = elem.index;
    const spanId = `${upperName}-curve-${curveNumber}-Button`;
    return spanId;
  },
  spanId(elem) {
    const name = elem.name.toString();
    const upperName = name.toUpperCase();
    const curveNumber = elem.index;
    const spanId = `${upperName}-curve-${curveNumber}-Item`;
    return spanId;
  },
  value(elem) {
    // have to get this from the session
    const curve = Session.get("Curves")[elem.index];
    if (curve === undefined) {
      return "";
    }
    const value = curve[elem.name];
    let text = "";
    if (Array.isArray(value)) {
      if (value.length === 1) {
        [text] = value;
      } else if (value.length > 1) {
        text = `${value[0]} .. ${value[value.length - 1]}`;
      }
    } else {
      text = value;
    }
    return text;
  },
  defaultColor(elem) {
    return elem.color;
  },
  border(elem) {
    Session.get("elementChanged");
    const { name } = elem; // for xaxis params
    const { curve } = elem;
    const adb = name === Session.get("activeDisplayButton");
    const isEditMode = curve === Session.get("editMode");
    const inputElemIsVisible = matsParamUtils.isInputElementVisible(name);
    if (adb && isEditMode && inputElemIsVisible) {
      return "solid";
    }
    return "";
  },
  editCurve() {
    return Session.get("editMode");
  },
  editTarget() {
    return Session.get("eventTargetCurve");
  },
  displayParam(elem) {
    const thisElem = elem;
    if (thisElem.name === "label") {
      return "none";
    }
    // it isn't good enough to just check the item control button. Need to evaluate the hideOtherFor functionality with
    // respect to this particular curve item
    // First - determine if my visibility is controlled by another
    const visibilityControllingParam = matsParamUtils.visibilityControllerForParam(
      thisElem.name
    );
    // Second - Check the hide/show state based on the parameter hideOtherFor map in the parameter nad the state of this particular curve
    if (visibilityControllingParam !== undefined) {
      const curve = Session.get("Curves")[thisElem.index];
      const hideOtherFor = visibilityControllingParam.hideOtherFor[thisElem.name];
      if (
        curve !== undefined &&
        curve[visibilityControllingParam.name] !== undefined &&
        hideOtherFor.indexOf(curve[visibilityControllingParam.name]) !== -1
      ) {
        thisElem.purposelyHidden = true;
        return "none";
      }
    }
    thisElem.purposelyHidden = false;
    return "block";
  },
});
