/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes } from "meteor/randyp:mats-common";
import { matsCollections } from "meteor/randyp:mats-common";
import { matsPlotUtils } from "meteor/randyp:mats-common";
import { matsCurveUtils } from "meteor/randyp:mats-common";
import { moment } from "meteor/momentjs:moment";

// get the document id for the control button element that corresponds to the param name
const getControlButtonIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  if (matsCollections[pname] !== undefined) {
    const param = matsCollections[pname].findOne({ name: pname });
    if (param !== undefined) {
      const id = "controlButton-" + param.name;
      return id;
    }
  }
};

// get the control Button Element that corresponds to the param name
const getControlElementForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  return document.getElementById(getControlButtonIdForParamName(pname));
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
    const elem = getValueElementForParamName(paramName);
    return getValueElementForParamName(paramName).textContent.trim();
  } catch (error) {
    return undefined;
  }
};

// get the VALUE BOX id for the element that corresponds to the param name
const getValueIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  return "controlButton-" + pname + "-value";
};

// set the VALUE BOX text for the element that corresponds to the param name
const setValueTextForParamName = function (paramName, text) {
  try {
    var param;
    if (matsCollections[paramName] !== undefined) {
      param = matsCollections[paramName].findOne({ name: paramName });
    }
    if (param === undefined) {
      param = matsCollections.PlotParams.findOne({ name: paramName });
    }
    if (param === undefined) {
      return;
    }
    if (text === undefined) {
      if (param.multiple) {
        // .... if multi selected  get the first .. last
        const selection = getInputElementForParamName(paramName).selectedOptions;
        if (selection.length === 0) {
          text = "";
        } else if (selection.length === 1) {
          text = selection[0].textContent;
        } else {
          text =
            selection[0].textContent +
            " .. " +
            selection[selection.length - 1].textContent;
        }
      }
    }
    const elem = getValueElementForParamName(paramName);
    if (elem && elem.textContent !== text) {
      delete elem.textContent;
      elem.textContent = text;
    }
    if (
      paramName.includes("dates") &&
      document.getElementById(paramName + "-dateRange") !== undefined &&
      document.getElementById(paramName + "-dateRange") !== null
    ) {
      document.getElementById(paramName + "-dateRange").value = text;
    }
  } catch (error) {
    console.log("Error: could not find param: " + paramName);
  }
};

// get the document id for the element that corresponds to the param name
const getInputIdForParamName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");
  var param;
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
    return ("element-" + param.name).replace(/ /g, "-");
  } else {
    return (param.name + "-" + param.type).replace(/ /g, "-");
  }
};

// get the parameter for the element that corresponds to the param name
const getParameterForName = function (paramName) {
  // scatter axis don't really exist in CurveParams-related matsCollections but they are elements
  const pname = paramName.replace(/^.axis-/, "");

  var param;
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

// get the document element that corresponds to the param name
const getInputElementForParamName = function (paramName) {
  const name = paramName.replace(/^.axis-/, "");
  const id = getInputIdForParamName(name);
  if (id === undefined) {
    return undefined;
  }
  return document.getElementById(id);
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
  const idSelectorStr = "#" + id;
  const idSelector = $(idSelectorStr);

  // SHOULD DEAL WITH CHECKBOXES HERE
  if (param.type === matsTypes.InputTypes.radioGroup) {
    $("#" + id + "-" + value).prop("checked", true);
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
  var params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  var param;
  for (var pidx = 0; pidx < params.length; pidx++) {
    param = matsCollections[params[pidx]].find({}).fetch()[0];
    var val = "";
    if (param.type === matsTypes.InputTypes.radioGroup) {
      var selector = "input:radio[name='" + param.name + "']:checked";
      val = $(selector).val();
    } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
      var selector = "input[name='" + param.name + "']:checked";
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else if (param.type === matsTypes.InputTypes.dateRange) {
      val = getValueForParamName(param.name);
    } else {
      var idSelect = "#" + getInputIdForParamName(param.name);
      val = $(idSelect).val();
    }
    data.curveParams[param.name] = val;
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      for (var a = 0; a < axis.length; a++) {
        const axisStr = axis[a];
        const name = axisStr + param.name;
        var val = "";
        if (param.type === matsTypes.InputTypes.radioGroup) {
          var selector = "input:radio[name='" + name + "']:checked";
          val = $(selector).val();
        } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
          var selector = "input[name='" + name + "']:checked";
          val = $(selector)
            .map(function (_, el) {
              return $(el).val();
            })
            .get();
        } else {
          var idSelect = "#" + getInputIdForParamName(name);
          val = $(idSelect).val();
        }
        data.curveParams[name] = val;
      }
    }
  }

  params = matsCollections.PlotParams.find({}).fetch();
  params.forEach(function (param) {
    var val = "";
    if (param.type === matsTypes.InputTypes.radioGroup) {
      var selector = "input:radio[name='" + param.name + "']:checked";
      val = $(selector).val();
    } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
      var selector = "input[name='" + param.name + "']:checked";
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else {
      var idSelect = "#" + getInputIdForParamName(param.name);
      val = $(idSelect).val();
    }
    data.plotParams[param.name] = val;
  });

  params = matsCollections.Scatter2dParams.find({}).fetch();
  params.forEach(function (param) {
    var val = "";
    if (param.type === matsTypes.InputTypes.radioGroup) {
      var selector = "input:radio[name='" + param.name + "']:checked";
      val = $(selector).val();
    } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
      var selector = "input[name='" + param.name + "']:checked";
      val = $(selector)
        .map(function (_, el) {
          return $(el).val();
        })
        .get();
    } else {
      var idSelect = "#" + getInputIdForParamName(param.name);
      val = $(idSelect).val();
    }
    data.scatterParams[param.name] = val;
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      for (var a = 0; a < axis.length; a++) {
        var axisStr = axis[a];
        var name = axisStr + param.name;
        var val = "";
        if (param.type === matsTypes.InputTypes.radioGroup) {
          var selector = "input:radio[name='" + name + "']:checked";
          val = $(selector).val();
        } else if (param.type === matsTypes.InputTypes.checkBoxGroup) {
          var selector = "input[name='" + name + "']:checked";
          val = $(selector)
            .map(function (_, el) {
              return $(el).val();
            })
            .get();
        } else {
          var idSelect = "#" + getInputIdForParamName(name);
          val = $(idSelect).val();
        }
        data.scatterParams[name] = val;
      }
    }
  });
  return data;
};

const expandParams = function () {
  var params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  var param;
  for (var pidx = 0; pidx < params.length; pidx++) {
    param = matsCollections[params[pidx]].find({}).fetch()[0];
    if (param.type !== matsTypes.InputTypes.selectMap) {
      const selector = "element" + "-" + param.name;
      const elem = document.getElementById(selector);
      if (elem) {
        elem.style.display = "block";
        const dataElem = document.getElementById(param.name + "-" + param.type);
        if (dataElem && dataElem.options && dataElem.selectedIndex >= 0) {
          dataElem.options[dataElem.selectedIndex].scrollIntoView();
        }
      }
    }
  }
};

const collapseParams = function () {
  var params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  var param;
  for (var pidx = 0; pidx < params.length; pidx++) {
    param = matsCollections[params[pidx]].find({}).fetch()[0];
    if (param.type !== matsTypes.InputTypes.selectMap) {
      const selector = "element" + "-" + param.name;
      if (document.getElementById(selector)) {
        document.getElementById(selector).style.display = "none";
      }
    }
  }
};

const collapseParam = function (paramName) {
  var param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined || param === null) {
    return;
  }
  if (param.type !== matsTypes.InputTypes.selectMap) {
    const selector = "element" + "-" + param.name;
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
    if (isNaN(Number(a) && isNaN(Number(b)))) {
      // string compare
      const A = a.toLowerCase();
      const B = b.toLowerCase();
      if (A < B) {
        return -1;
      } else if (A > B) {
        return 1;
      } else {
        return 0;
      }
    } else if (isNaN(Number(a) || isNaN(Number(b)))) {
      // number always precedes
      if (isNaN(Number(a))) {
        return 1;
      } else {
        return -1;
      }
    } else {
      return a - b; // numerical compare
    }
  });
};

const setDefaultForParamName = function (param) {
  if (param === undefined) {
    return;
  }
  const paramName = param.name;
  const type = param.type;
  const defaultValue = param.default;
  if (paramName === "label") {
    setInputForParamName(paramName, Session.get("NextCurveLabel"));
  } else {
    if (defaultValue !== "undefined") {
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
  }
};

const getDefaultDateRange = function (name) {
  var dateParam;
  if (matsCollections[name] !== undefined) {
    dateParam = matsCollections[name].findOne({ name: name });
  }
  if (dateParam === undefined) {
    dateParam = matsCollections.PlotParams.findOne({ name: name });
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
  const dstr = dateParam.default;
  return { startDate: startInit, stopDate: stopInit, dstr: dstr };
};

const getMinMaxDates = function (minDate, maxDate) {
  var minMoment = moment.utc(minDate, "MM/DD/YYYY HH:mm");
  var maxMoment = moment.utc(maxDate, "MM/DD/YYYY HH:mm");
  if (maxMoment.diff(minMoment, "days") > 30) {
    minMoment = moment.utc(maxMoment).subtract(30, "days");
  }
  return { minDate: minMoment, maxDate: maxMoment };
};

const getMinMaxDatesTC = function (minDate, maxDate) {
  var minMoment = moment.utc(minDate, "MM/DD/YYYY HH:mm");
  var maxMoment = moment.utc(maxDate, "MM/DD/YYYY HH:mm");
  return { minDate: minMoment, maxDate: maxMoment };
};

const setAllParamsToDefault = function () {
  // default the superiors and refresh them so that they cause the dependent options to refresh
  var paramNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  var params = [];
  var superiors = [];
  var dependents = [];
  // get all of the curve param collections in one place
  for (var pidx = 0; pidx < paramNames.length; pidx++) {
    const param = matsCollections[paramNames[pidx]].find({}).fetch()[0];
    // superiors
    if (param !== undefined && param.dependentNames !== undefined) {
      superiors.push(param);
      // dependents
    } else if (param !== undefined && param.superiorNames !== undefined) {
      dependents.push(param);
      // everything else
    } else {
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
      const dstr = getDefaultDateRange(param.name).dstr;
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
      const dstr = getDefaultDateRange(param.name).dstr;
      setValueTextForParamName(param.name, dstr);
    } else if (param !== undefined && param.type === matsTypes.InputTypes.selectMap) {
      const targetId = param.name + "-" + param.type;
      const targetElem = document.getElementById(targetId);
      const resetMapEvent = new CustomEvent("reset", {
        detail: {
          refElement: null,
        },
      });
      targetElem.dispatchEvent(resetMapEvent);
    } else {
      setDefaultForParamName(param);
    }
  });
  matsCollections.PlotParams.find({})
    .fetch()
    .forEach(function (param) {
      if (param !== undefined && param.type === matsTypes.InputTypes.dateRange) {
        const dstr = getDefaultDateRange(param.name).dstr;
        setValueTextForParamName(param.name, dstr);
      } else {
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
  const paramRef = "#" + name + "-item";
  return $(paramRef).is(":visible");
};

// is the input element displaying? used by curve_param_item_group
const isControlButtonVisible = function (paramName) {
  const name = paramName.replace(/^.axis-/, ""); // need to acount for scatter plots params
  const paramRef = "#controlButton-" + name;
  return $(paramRef).is(":visible");
};

const setInputValueForParamAndTriggerChange = function (paramName, value) {
  const elem = getInputElementForParamName(paramName);
  elem.value = value;
  setValueTextForParamName(paramName, elem.value);
  $(elem).trigger("change");
};

const getOptionsMapForParam = function (paramName) {
  var param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: paramName });
  }
  if (param === undefined) {
    return;
  }
  return param.optionsMap;
};

const getOptionsForParam = function (paramName) {
  var param;
  if (matsCollections[paramName] !== undefined) {
    param = matsCollections[paramName].findOne({ name: paramName });
  }
  if (param === undefined) {
    param = matsCollections.PlotParams.findOne({ name: paramName });
  }
  if (param === undefined) {
    return;
  }
  return param.options;
};

const getAppName = function () {
  const app = matsCollections.Settings.findOne({}).appName;
  return app;
};

const getCurveItemValueForParamName = function (curveNumber, paramName) {
  //MODEL-curve-0-Item
  //    const id = paramName.toString().toUpperCase() + "-curve-" + curveNumber + "-Item"; // the id of the text span for a curveItem
  //    return text = ‌‌document.getElementById(id).innerText;
  // const elem = $("#" + id);
  // var text = undefined;
  // if (elem) {
  //     text = elem.text();
  // }
};
const visibilityControllerForParam = function (paramName) {
  /*
    Need to iterate all the params looking for one that has this paramName as a key in its
    hideOtherFor map.
    If it exists, that param is returned. Otherwise return undefined.
     */
  var found = undefined;
  var params = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  var param;
  for (var pidx = 0; pidx < params.length; pidx++) {
    param = matsCollections[params[pidx]].find({}).fetch()[0];
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

const getSingleSelectCurveParamNames = function () {
  let curveParamNames = matsCollections.CurveParamsInfo.find(
    {},
    { curve_params: 1 }
  ).fetch()[0]["curve_params"];
  let multiParamNames = getMultiSelectCurveParamNames();
  let singleParamNames = curveParamNames.filter(function (n) {
    return !multiParamNames.includes(n);
  });
  return singleParamNames;
};

const getMultiSelectCurveParamNames = function () {
  let curveParamNames = matsCollections.CurveParamsInfo.find(
    {},
    { curve_params: 1 }
  ).fetch()[0]["curve_params"];
  let multiParamNames = [];
  curveParamNames.forEach(function (paramName) {
    if (matsParamUtils.getParameterForName(paramName)["multiple"] !== undefined) {
      multiParamNames.push(paramName);
    }
  });
  return multiParamNames;
};

const getPlotParamNames = function () {
  let paramNames = matsCollections.PlotParams.find({}, { _id: 0, name: 1 }).fetch();
  return paramNames;
};

const addImportedCurve = function () {
  let curves = Session.get("Curves");
  let p = {};
  const curveParamNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0]["curve_params"];
  for (let i = 0; i < curveParamNames.length; i++) {
    let currentParam = matsCollections[curveParamNames[i]].find({}).fetch()[0];
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
  var elem = document.getElementById("curveList");
  elem.style.display = "block";

  Session.set("Curves", curves);
  matsCurveUtils.setUsedColorsAndLabels(); // we have used a color and label so we have to set the next one
  collapseParams();
  setInputForParamName("label", matsCurveUtils.getNextCurveLabel());
};

export default matsParamUtils = {
  addImportedCurve: addImportedCurve,
  getDisabledOptionsForParamName: getDisabledOptionsForParamName,
  getControlButtonIdForParamName: getControlButtonIdForParamName,
  getControlElementForParamName: getControlElementForParamName,
  getValueElementForParamName: getValueElementForParamName,
  getValueForParamName: getValueForParamName,
  setValueTextForParamName: setValueTextForParamName,
  getValueIdForParamName: getValueIdForParamName,
  getInputIdForParamName: getInputIdForParamName,
  getInputElementForParamName: getInputElementForParamName,
  getElementValues: getElementValues,
  setInputForParamName: setInputForParamName,
  expandParams: expandParams,
  collapseParams: collapseParams,
  collapseParam: collapseParam,
  getParameterForName: getParameterForName,
  setDefaultForParamName: setDefaultForParamName,
  setAllParamsToDefault: setAllParamsToDefault,
  typeSort: typeSort,
  isInputElementVisible: isInputElementVisible,
  isParamVisible: isParamVisible,
  isControlButtonVisible: isControlButtonVisible,
  setInputValueForParamAndTriggerChange: setInputValueForParamAndTriggerChange,
  getOptionsForParam: getOptionsForParam,
  getOptionsMapForParam: getOptionsMapForParam,
  getCurveItemValueForParamName: getCurveItemValueForParamName,
  visibilityControllerForParam: visibilityControllerForParam,
  getAppName: getAppName,
  getDefaultDateRange: getDefaultDateRange,
  getMinMaxDates: getMinMaxDates,
  getMinMaxDatesTC: getMinMaxDatesTC,
  getSingleSelectCurveParamNames: getSingleSelectCurveParamNames,
  getMultiSelectCurveParamNames: getMultiSelectCurveParamNames,
  getPlotParamNames: getPlotParamNames,
};
