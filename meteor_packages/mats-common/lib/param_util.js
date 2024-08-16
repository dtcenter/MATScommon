/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global $, Session */
/* eslint-disable no-console */

import {
  matsTypes,
  matsCollections,
  matsMethods,
  matsPlotUtils,
  matsCurveUtils,
  matsSelectUtils,
} from "meteor/randyp:mats-common";
import { moment } from "meteor/momentjs:moment";

// get the document id for the control button element that corresponds to the param name
const getControlButtonIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  if (matsCollections[pname] !== undefined) {
    const param = matsCollections[pname].findOne({ name: pname });
    if (param !== undefined) {
      const id = `controlButton-${param.name}`;
      return id;
    }
  }
  return null;
};

// get the control Button Element that corresponds to the param name
const getControlElementForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  return document.getElementById(getControlButtonIdForParamName(pname));
};

// get the VALUE BOX id for the element that corresponds to the param name
const getValueIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  return `controlButton-${pname}-value`;
};

// get the document element that corresponds to the param name
const getValueElementForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  const val = getValueIdForParamName(pname);
  return document.getElementById(val);
};

// get the current selected value in the document element that corresponds to the param name
// Note that the value should be reflected in the adjoining control button value textContent.
const getValueForParamName = function (paramName) {
  try {
    return getValueElementForParamName(paramName).textContent.trim();
  } catch (error) {
    return undefined;
  }
};

// get the document id for the element that corresponds to the param name
const getInputIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  let param;
  if (matsCollections[pname] !== undefined) {
    param = matsCollections[pname].findOne({ name: pname });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: pname });
  }
  if (param === undefined) {
    param = matsCollections.Scatter2dParams.findOne({ name: pname });
    if (param === undefined) {
      return undefined;
    }
  }
  if (param.type === matsTypes.InputTypes.dateRange) {
    return `element-${param.name}`.replace(/ /g, "-");
  }
  return `${param.name}-${param.type}`.replace(/ /g, "-");
};

// get the document element that corresponds to the param name
const getInputElementForParamName = function (paramName) {
  const name = paramName.replace(/^.axis-/, "");
  const id = getInputIdForParamName(name);
  if (id === undefined) {
    return undefined;
  }
  return document.getElementById(id);
};

// set the VALUE BOX text for the element that corresponds to the param name
const setValueTextForParamName = function (paramName, text) {
  try {
    let param;
    let thisText = text;
    if (matsCollections[paramName] !== undefined) {
      param = matsCollections[paramName].findOne({ name: paramName });
    }
    if (param === undefined) {
      param = matsCollections.PlotParams.findOne({ name: paramName });
    }
    if (param === undefined) {
      return;
    }
    if (thisText === undefined) {
      if (param.multiple) {
        // .... if multi selected  get the first .. last
        const selection = getInputElementForParamName(paramName).selectedOptions;
        if (selection.length === 0) {
          thisText = "";
        } else if (selection.length === 1) {
          thisText = selection[0].textContent;
        } else {
          thisText = `${selection[0].textContent} .. ${
            selection[selection.length - 1].textContent
          }`;
        }
      }
    }
    const elem = getValueElementForParamName(paramName);
    if (elem && elem.textContent !== thisText) {
      delete elem.textContent;
      elem.textContent = thisText;
    }
    if (
      paramName.includes("dates") &&
      document.getElementById(`${paramName}-dateRange`) !== undefined &&
      document.getElementById(`${paramName}-dateRange`) !== null
    ) {
      delete document.getElementById(`${paramName}-dateRange`).value;
      document.getElementById(`${paramName}-dateRange`).value = thisText;
    }
  } catch (error) {
    console.log(`Error: could not find param: ${paramName}`);
  }
};

// get the parameter for the element that corresponds to the param name
const getParameterForName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");

  let param;
  if (matsCollections[pname] !== undefined) {
    param = matsCollections[pname].findOne({ name: pname });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: pname });
  }
  if (param === undefined) {
    param = matsCollections.Scatter2dParams.findOne({ name: pname });
    if (param === undefined) {
      return undefined;
    }
  }
  return param;
};

// get a param disabledOptions list - if any.
const getDisabledOptionsForParamName = function (paramName) {
  const name = paramName.replace(/^.axis-/, "");
  const id = getInputIdForParamName(name);
  if (id === undefined) {
    return undefined;
  }
  const param = getParameterForName(name);
  if (!param) {
    return undefined;
  }
  return param.disabledOptions;
};

// set the input for the element that corresponds to the param name
// also sets a data-mats-currentValue attribute
const setInputForParamName = function (paramName, value) {
  const param = getParameterForName(paramName);
  const id = getInputIdForParamName(paramName);
  const idSelectorStr = `#${id}`;
  const idSelector = $(idSelectorStr);

  // SHOULD DEAL WITH CHECKBOXES HERE
  if (param.type === matsTypes.InputTypes.radioGroup) {
    $(`#${id}-${value}`).prop("checked", true);
  } else {
    idSelector.val(value);
    setValueTextForParamName(paramName, value);
  }
};

const getElementValues = function () {
  const data = {
    curveParams: {},
    plotParams: {},
    scatterParams: {},
  };
  const axis = ["xaxis-", "yaxis-"];
  let params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  let param;
  for (let pidx = 0; pidx < params.length; pidx += 1) {
    [param] = matsCollections[params[pidx]].find({}).fetch();
    let val = "";
    if (param.type === matsTypes.InputTypes.radioGroup) {
      const selector = `input:radio[name='${param.name}']:checked`;
      val = $(selector).val();
    } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
      const selector = `input[name='${param.name}']:checked`;
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else if (param.type === matsTypes.InputTypes.dateRange) {
      val = getValueForParamName(param.name);
    } else {
      const idSelect = `#${getInputIdForParamName(param.name)}`;
      val = $(idSelect).val();
    }
    data.curveParams[param.name] = val;
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      for (let a = 0; a < axis.length; a += 1) {
        const axisStr = axis[a];
        const name = axisStr + param.name;
        val = "";
        if (param.type === matsTypes.InputTypes.radioGroup) {
          const selector = `input:radio[name='${name}']:checked`;
          val = $(selector).val();
        } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
          const selector = `input[name='${name}']:checked`;
          val = $(selector)
            .map(function (_, el) {
              return $(el).val();
            })
            .get();
        } else {
          const idSelect = `#${getInputIdForParamName(name)}`;
          val = $(idSelect).val();
        }
        data.curveParams[name] = val;
      }
    }
  }

  params = matsCollections.PlotParams.find({}).fetch();
  params.forEach(function (p) {
    let val = "";
    if (p.type === matsTypes.InputTypes.radioGroup) {
      const selector = `input:radio[name='${p.name}']:checked`;
      val = $(selector).val();
    } else if (p.type === matsTypes.InputTypes.checkBoxGroup) {
      const selector = `input[name='${p.name}']:checked`;
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else if (p.type === matsTypes.InputTypes.color) {
      val = document.querySelector(`[name='${p.name}-icon']`).style.color;
    } else {
      const idSelect = `#${getInputIdForParamName(p.name)}`;
      val = $(idSelect).val();
    }
    data.plotParams[p.name] = val;
  });

  params = matsCollections.Scatter2dParams.find({}).fetch();
  params.forEach(function (p) {
    let val = "";
    if (p.type === matsTypes.InputTypes.radioGroup) {
      const selector = `input:radio[name='${p.name}']:checked`;
      val = $(selector).val();
    } else if (p.type === matsTypes.InputTypes.checkBoxGroup) {
      const selector = `input[name='${p.name}']:checked`;
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else if (p.type === matsTypes.InputTypes.color) {
      val = document.querySelector(`[name='${p.name}-icon']`).style.color;
    } else {
      const idSelect = `#${getInputIdForParamName(p.name)}`;
      val = $(idSelect).val();
    }
    data.scatterParams[p.name] = val;
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      for (let a = 0; a < axis.length; a += 1) {
        const axisStr = axis[a];
        const name = axisStr + p.name;
        val = "";
        if (p.type === matsTypes.InputTypes.radioGroup) {
          const selector = `input:radio[name='${name}']:checked`;
          val = $(selector).val();
        } else if (p.type === matsTypes.InputTypes.checkBoxGroup) {
          const selector = `input[name='${name}']:checked`;
          val = $(selector)
            .map(function (_, el) {
              return $(el).val();
            })
            .get();
        } else if (p.type === matsTypes.InputTypes.color) {
          val = document.querySelector(`[name='${p.name}-icon']`).style.color;
        } else {
          const idSelect = `#${getInputIdForParamName(name)}`;
          val = $(idSelect).val();
        }
        data.scatterParams[name] = val;
      }
    }
  });
  return data;
};

const expandParams = function () {
  const params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  let param;
  for (let pidx = 0; pidx < params.length; pidx += 1) {
    [param] = matsCollections[params[pidx]].find({}).fetch();
    if (param.type !== matsTypes.InputTypes.selectMap) {
      const selector = `element-${param.name}`;
      const elem = document.getElementById(selector);
      if (elem) {
        elem.style.display = "block";
        const dataElem = document.getElementById(`${param.name}-${param.type}`);
        if (dataElem && dataElem.options && dataElem.selectedIndex >= 0) {
          dataElem.options[dataElem.selectedIndex].scrollIntoView();
        }
      }
    }
  }
};

const collapseParams = function () {
  const params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  let param;
  for (let pidx = 0; pidx < params.length; pidx += 1) {
    [param] = matsCollections[params[pidx]].find({}).fetch();
    if (param.type !== matsTypes.InputTypes.selectMap) {
      const selector = `element-${param.name}`;
      if (document.getElementById(selector)) {
        document.getElementById(selector).style.display = "none";
      }
    }
  }
};

const collapseParam = function (paramName) {
  let param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined || param === null) {
    return;
  }
  if (param.type !== matsTypes.InputTypes.selectMap) {
    const selector = `element-${param.name}`;
    if (document.getElementById(selector)) {
      document.getElementById(selector).style.display = "none";
    }
  }
};

const typeSort = function (arr) {
  if (arr === undefined) {
    return undefined;
  }
  return arr.sort(function (a, b) {
    if (matsMethods.isThisANaN(Number(a) && matsMethods.isThisANaN(Number(b)))) {
      // string compare
      const A = a.toLowerCase();
      const B = b.toLowerCase();
      if (A < B) {
        return -1;
      }
      if (A > B) {
        return 1;
      }
      return 0;
    }
    if (matsMethods.isThisANaN(Number(a) || matsMethods.isThisANaN(Number(b)))) {
      // number always precedes
      if (matsMethods.isThisANaN(Number(a))) {
        return 1;
      }
      return -1;
    }
    return a - b; // numerical compare
  });
};

const setDefaultForParamName = function (param) {
  if (param === undefined) {
    return;
  }
  const paramName = param.name;
  const { type } = param;
  const defaultValue = param.default;
  if (paramName === "label") {
    setInputForParamName(paramName, Session.get("NextCurveLabel"));
  } else if (defaultValue !== "undefined") {
    if (
      type === matsTypes.InputTypes.select &&
      (defaultValue === -1 ||
        defaultValue === undefined ||
        defaultValue === matsTypes.InputTypes.unused)
    ) {
      setInputForParamName(paramName, matsTypes.InputTypes.unused);
    } else {
      setInputForParamName(paramName, defaultValue);
    }
    // need to trigger a change so that hideOtherFor and disableOtherFor work properly
    if (param.hideOtherFor !== undefined || param.disableOtherFor !== undefined) {
      const elem = getInputElementForParamName(paramName);
      if (elem && elem.style && elem.style.display === "block") {
        $(elem).trigger("change");
      }
    }
  }
};

const getDefaultDateRange = function (name) {
  let dateParam;
  if (matsCollections[name] !== undefined) {
    dateParam = matsCollections[name].findOne({ name });
  }
  if (dateParam === undefined) {
    dateParam = matsCollections.PlotParams.findOne({ name });
  }
  // make sure we have strings and not objects
  const startInit =
    typeof dateParam.startDate === "string"
      ? dateParam.startDate
      : moment.utc(dateParam.startDate).locale("en").format("MM/DD/YYYY HH:mm");
  const stopInit =
    typeof dateParam.stopDate === "string"
      ? dateParam.stopDate
      : moment.utc(dateParam.stopDate).locale("en").format("MM/DD/YYYY HH:mm");
  const dstr =
    typeof dateParam.default === "string"
      ? dateParam.default
      : `${startInit} - ${stopInit}`;
  return { startDate: startInit, stopDate: stopInit, dstr };
};

const getMinMaxDates = function (minDate, maxDate) {
  let minMoment = moment.utc(minDate, "MM/DD/YYYY HH:mm");
  const maxMoment = moment.utc(maxDate, "MM/DD/YYYY HH:mm");
  if (maxMoment.diff(minMoment, "days") > 30) {
    minMoment = moment.utc(maxMoment).subtract(30, "days");
  }
  return { minDate: minMoment, maxDate: maxMoment };
};

const getMinMaxDatesTC = function (minDate, maxDate) {
  const minMoment = moment.utc(minDate, "MM/DD/YYYY HH:mm");
  const maxMoment = moment.utc(maxDate, "MM/DD/YYYY HH:mm");
  return { minDate: minMoment, maxDate: maxMoment };
};

const setAllParamsToDefault = function () {
  // default the superiors and refresh them so that they cause the dependent options to refresh
  const paramNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  let params = [];
  const superiors = [];
  const dependents = [];
  // get all of the curve param collections in one place
  for (let pidx = 0; pidx < paramNames.length; pidx += 1) {
    const param = matsCollections[paramNames[pidx]].find({}).fetch()[0];
    // superiors
    if (param !== undefined && param.dependentNames !== undefined) {
      superiors.push(param);
      // dependents
    } else if (param !== undefined && param.superiorNames !== undefined) {
      dependents.push(param);
      // everything else
    } else if (param !== undefined) {
      params.push(param);
    }
  }
  superiors.forEach(function (param) {
    setDefaultForParamName(param);
    // actually call the refresh directly - don't use an event, because we want this all to be synchronous
    matsSelectUtils.refresh(null, param.name);
    // remove from params list - actually rewrite params list NOT with this param
    params = params.filter(function (obj) {
      return obj.name !== param.name;
    });
  });
  // refresh all the dependents to their default values
  dependents.forEach(function (param) {
    setDefaultForParamName(param);
    if (param.type === matsTypes.InputTypes.dateRange) {
      const { dstr } = getDefaultDateRange(param.name);
      setValueTextForParamName(param.name, dstr);
    } else {
      matsSelectUtils.refresh(null, param.name);
      // remove from params list - actually rewrite params list NOT with this param
      params = params.filter(function (obj) {
        return obj.name !== param.name;
      });
    }
  });
  // reset everything else
  params.forEach(function (param) {
    if (param !== undefined && param.type === matsTypes.InputTypes.dateRange) {
      const { dstr } = getDefaultDateRange(param.name);
      setValueTextForParamName(param.name, dstr);
    } else if (param !== undefined && param.type === matsTypes.InputTypes.selectMap) {
      const targetId = `${param.name}-${param.type}`;
      const targetElem = document.getElementById(targetId);
      const resetMapEvent = new CustomEvent("reset", {
        detail: {
          refElement: null,
        },
      });
      targetElem.dispatchEvent(resetMapEvent);
    } else if (param !== undefined) {
      setDefaultForParamName(param);
    }
  });
  matsCollections.PlotParams.find({})
    .fetch()
    .forEach(function (param) {
      if (param !== undefined && param.type === matsTypes.InputTypes.dateRange) {
        const { dstr } = getDefaultDateRange(param.name);
        setValueTextForParamName(param.name, dstr);
      } else if (param !== undefined) {
        setDefaultForParamName(param);
      }
    });
};
// is the input element displaying? used by curve_param_item_group
const isInputElementVisible = function (paramName) {
  const name = paramName.replace(/^.axis-/, ""); // need to acount for scatter plots params
  const inputElement = getInputElementForParamName(name);
  return $(inputElement).is(":visible");
};

// is the input element displaying? used by curve_param_item_group
const isParamVisible = function (paramName) {
  const name = paramName.replace(/^.axis-/, ""); // need to acount for scatter plots params
  const paramRef = `#${name}-item`;
  return $(paramRef).is(":visible");
};

// is the input element displaying? used by curve_param_item_group
const isControlButtonVisible = function (paramName) {
  const name = paramName.replace(/^.axis-/, ""); // need to acount for scatter plots params
  const paramRef = `#controlButton-${name}`;
  return $(paramRef).is(":visible");
};

const setInputValueForParamAndTriggerChange = function (paramName, value) {
  const elem = getInputElementForParamName(paramName);
  elem.value = value;
  setValueTextForParamName(paramName, elem.value);
  $(elem).trigger("change");
};

const getOptionsMapForParam = function (paramName) {
  let param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: paramName });
  }
  if (param === undefined) {
    return undefined;
  }
  return param.optionsMap;
};

const getOptionsForParam = function (paramName) {
  let param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: paramName });
  }
  if (param === undefined) {
    return undefined;
  }
  return param.options;
};

const getAppName = function () {
  const app = matsCollections.Settings.findOne({}).appName;
  return app;
};

const visibilityControllerForParam = function (paramName) {
  /*
    Need to iterate all the params looking for one that has this paramName as a key in its
    hideOtherFor map.
    If it exists, that param is returned. Otherwise return undefined.
     */
  let found;
  const params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  let param;
  for (let pidx = 0; pidx < params.length; pidx += 1) {
    [param] = matsCollections[params[pidx]].find({}).fetch();
    if (param.hideOtherFor) {
      const pKeys = Object.keys(param.hideOtherFor);
      if (pKeys.indexOf(paramName) !== -1) {
        found = param;
        break;
      }
    }
  }
  return found;
};

const getMultiSelectCurveParamNames = function () {
  const curveParamNames = matsCollections.CurveParamsInfo.find(
    {},
    { curve_params: 1 }
  ).fetch()[0].curve_params;
  const multiParamNames = [];
  curveParamNames.forEach(function (paramName) {
    if (getParameterForName(paramName).multiple !== undefined) {
      multiParamNames.push(paramName);
    }
  });
  return multiParamNames;
};

const getSingleSelectCurveParamNames = function () {
  const curveParamNames = matsCollections.CurveParamsInfo.find(
    {},
    { curve_params: 1 }
  ).fetch()[0].curve_params;
  const multiParamNames = getMultiSelectCurveParamNames();
  const singleParamNames = curveParamNames.filter(function (n) {
    return !multiParamNames.includes(n);
  });
  return singleParamNames;
};

const getPlotParamNames = function () {
  const paramNames = matsCollections.PlotParams.find({}, { _id: 0, name: 1 }).fetch();
  return paramNames;
};

const addImportedCurve = function () {
  const curves = Session.get("Curves");
  const p = {};
  const curveParamNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  for (let i = 0; i < curveParamNames.length; i += 1) {
    const currentParam = matsCollections[curveParamNames[i]].find({}).fetch()[0];
    if (
      currentParam.multiple &&
      getValueForParamName(currentParam.name) === matsTypes.InputTypes.unused
    ) {
      // sometimes multi-selects will have "unused" as a value. This is fine, the data routines are set up to handle it.
      p[currentParam.name] = matsTypes.InputTypes.unused;
    } else {
      p[currentParam.name] = getValueForParamName(currentParam.name);
    }
  }
  p.color = matsCurveUtils.getNextCurveColor();
  curves.push(p);
  const elem = document.getElementById("curveList");
  elem.style.display = "block";

  Session.set("Curves", curves);
  matsCurveUtils.setUsedColorsAndLabels(); // we have used a color and label so we have to set the next one
  collapseParams();
  setInputForParamName("label", matsCurveUtils.getNextCurveLabel());
};

// eslint-disable-next-line no-undef
export default matsParamUtils = {
  addImportedCurve,
  getDisabledOptionsForParamName,
  getControlButtonIdForParamName,
  getControlElementForParamName,
  getValueElementForParamName,
  getValueForParamName,
  setValueTextForParamName,
  getValueIdForParamName,
  getInputIdForParamName,
  getInputElementForParamName,
  getElementValues,
  setInputForParamName,
  expandParams,
  collapseParams,
  collapseParam,
  getParameterForName,
  setDefaultForParamName,
  setAllParamsToDefault,
  typeSort,
  isInputElementVisible,
  isParamVisible,
  isControlButtonVisible,
  setInputValueForParamAndTriggerChange,
  getOptionsForParam,
  getOptionsMapForParam,
  visibilityControllerForParam,
  getAppName,
  getDefaultDateRange,
  getMinMaxDates,
  getMinMaxDatesTC,
  getSingleSelectCurveParamNames,
  getMultiSelectCurveParamNames,
  getPlotParamNames,
};
