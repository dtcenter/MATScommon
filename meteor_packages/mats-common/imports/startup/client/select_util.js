/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsParamUtils,
  matsPlotUtils,
  matsTypes,
} from "meteor/randyp:mats-common";

/* global $, _, Session, setInfo */

// method to refresh the dependents of the current selector
const refreshDependents = function (event, param) {
  try {
    const { dependentNames } = param;
    if (
      dependentNames &&
      Object.prototype.toString.call(dependentNames) === "[object Array]" &&
      dependentNames.length > 0
    ) {
      // refresh the dependents
      let selectAllbool = false;
      for (let i = 0; i < dependentNames.length; i += 1) {
        const name = dependentNames[i];
        const targetParam = matsParamUtils.getParameterForName(name);
        let targetId;
        if (targetParam.type === matsTypes.InputTypes.dateRange) {
          targetId = `element-${targetParam.name}`;
        } else {
          targetId = `${targetParam.name}-${targetParam.type}`;
        }
        const targetElem = document.getElementById(targetId);

        if (document.getElementById("selectAll")) {
          selectAllbool = document.getElementById("selectAll").checked;
        }
        try {
          if (
            !(
              Session.get("confirmPlotChange") &&
              targetParam.type === matsTypes.InputTypes.dateRange
            )
          ) {
            // don't refresh the dates if we're just changing the plot type
            targetElem.dispatchEvent(new CustomEvent("refresh"));
          }
        } catch (re) {
          re.message = `INFO: refreshDependents of: ${param.name} dependent: ${targetParam.name} - error: ${re.message}`;
          setInfo(re.message);
        }
        const elements = targetElem.options;
        const select = true;
        if (targetElem.multiple && elements !== undefined && elements.length > 0) {
          if (selectAllbool) {
            for (let i1 = 0; i1 < elements.length; i1 += 1) {
              elements[i1].selected = select;
            }
            matsParamUtils.setValueTextForParamName(name, "");
          } else {
            const previouslySelected = Session.get("selected");
            for (let i2 = 0; i2 < elements.length; i2 += 1) {
              if (_.indexOf(previouslySelected, elements[i2].text) !== -1) {
                elements[i2].selected = select;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    e.message = `INFO: Error in select.js refreshDependents: ${e.message}`;
    setInfo(e.message);
  }
};

// method to refresh the peers of the current selector
const refreshPeer = function (event, param) {
  try {
    const { peerName } = param;
    if (peerName !== undefined) {
      // refresh the peer
      const targetParam = matsParamUtils.getParameterForName(peerName);
      const targetId = `${targetParam.name}-${targetParam.type}`;
      const targetElem = document.getElementById(targetId);
      const refreshMapEvent = new CustomEvent("refresh", {
        detail: {
          refElement: null,
        },
      });
      targetElem.dispatchEvent(refreshMapEvent);
    }
    refreshDependents(event, param);
  } catch (e) {
    e.message = `INFO: Error in select.js refreshPeer: ${e.message}`;
    setInfo(e.message);
  }
};

// check for enable controlled - This select might have control of another selector
const checkDisableOther = function (param, firstRender) {
  try {
    if (param.disableOtherFor !== undefined) {
      // this param controls the enable/disable properties of at least one other param.
      // Use the options to enable disable that param.
      const controlledSelectors = Object.keys(param.disableOtherFor);
      for (let i = 0; i < controlledSelectors.length; i += 1) {
        const elem = matsParamUtils.getInputElementForParamName(param.name);
        if (!elem) {
          return;
        }
        const { selectedOptions } = elem;
        const selectedText =
          selectedOptions && selectedOptions.length > 0 ? selectedOptions[0].text : "";
        if (
          (firstRender &&
            param.default.toString() ===
              param.hideOtherFor[controlledSelectors[i]].toString()) ||
          (param.disableOtherFor[controlledSelectors[i]] ===
            matsTypes.InputTypes.unused &&
            selectedText === "") ||
          $.inArray(selectedText, param.disableOtherFor[controlledSelectors[i]]) !== -1
        ) {
          matsParamUtils.getInputElementForParamName(
            controlledSelectors[i]
          ).disabled = true;
        } else {
          matsParamUtils.getInputElementForParamName(
            controlledSelectors[i]
          ).disabled = false;
        }
      }
    }
  } catch (e) {
    e.message = `INFO: Error in select.js checkDisableOther: ${e.message}`;
    setInfo(e.message);
  }
};

// check for hide controlled - This select might have control of another selector's visibility
const checkHideOther = function (param, firstRender) {
  try {
    if (param.hideOtherFor !== undefined) {
      // this param controls the visibility of at least one other param.
      const controlledSelectors = Object.keys(param.hideOtherFor);
      for (let i = 0; i < controlledSelectors.length; i += 1) {
        const elem = matsParamUtils.getInputElementForParamName(param.name);
        if (!elem) {
          return;
        }
        let selectedOptions;
        let selectedText;
        if (param.type === matsTypes.InputTypes.radioGroup) {
          const radioButtons = elem.getElementsByTagName("input");
          for (let ridx = 0; ridx < radioButtons.length; ridx += 1) {
            if (radioButtons[ridx].checked) {
              selectedOptions = radioButtons[ridx].id.split("-radioGroup-");
              selectedText = selectedOptions[selectedOptions.length - 1];
              break;
            }
          }
          selectedOptions = selectedOptions || [];
          selectedText = selectedText || "";
        } else {
          selectedOptions = elem.selectedOptions;
          selectedText =
            selectedOptions && selectedOptions.length > 0
              ? selectedOptions[0].text
              : "";
        }

        let doNotShow = false;
        if (
          param.type === matsTypes.InputTypes.radioGroup &&
          param.superiorRadioGroups !== undefined
        ) {
          // if a superior radio group wants the target element hidden and it already is, leave it be.
          for (let sidx = 0; sidx < param.superiorRadioGroups.length; sidx += 1) {
            const superiorName = param.superiorRadioGroups[sidx];
            const superiorHideOtherFor = matsCollections.PlotParams.findOne({
              name: superiorName,
            }).hideOtherFor;
            const superiorInputElementOptions = matsParamUtils
              .getInputElementForParamName(superiorName)
              .getElementsByTagName("input");
            let superiorSelectedText = "";
            for (
              let seidx = 0;
              seidx < superiorInputElementOptions.length;
              seidx += 1
            ) {
              if (superiorInputElementOptions[seidx].checked) {
                const superiorSelectedOptions =
                  superiorInputElementOptions[seidx].id.split("-radioGroup-");
                superiorSelectedText =
                  superiorSelectedOptions[superiorSelectedOptions.length - 1];
                break;
              }
            }
            if (
              superiorHideOtherFor !== undefined &&
              Object.keys(superiorHideOtherFor).indexOf(controlledSelectors[i]) !==
                -1 &&
              superiorHideOtherFor[controlledSelectors[i]].indexOf(
                superiorSelectedText
              ) !== -1
            ) {
              doNotShow = true;
            }
          }
        }

        const otherInputElement = matsParamUtils.getInputElementForParamName(
          controlledSelectors[i]
        );
        let selectorControlElem;
        if (
          (firstRender &&
            param.default.toString() ===
              param.hideOtherFor[controlledSelectors[i]].toString()) ||
          (param.hideOtherFor[controlledSelectors[i]] === matsTypes.InputTypes.unused &&
            selectedText === "") ||
          $.inArray(selectedText, param.hideOtherFor[controlledSelectors[i]]) !== -1
        ) {
          selectorControlElem = document.getElementById(
            `${controlledSelectors[i]}-item`
          );
          if (selectorControlElem && selectorControlElem.style) {
            selectorControlElem.style.display = "none";
            selectorControlElem.purposelyHidden = true;
          }
        } else if (
          !(
            (selectedText === matsTypes.InputTypes.unused || selectedText === "") &&
            param.hideOtherFor[controlledSelectors[i]].indexOf(
              matsTypes.InputTypes.unused
            ) === -1
          )
        ) {
          // don't change anything if the parent parameter is unused in this curve and that situation isn't specified in hideOtherFor.
          selectorControlElem = document.getElementById(
            `${controlledSelectors[i]}-item`
          );
          if (selectorControlElem && selectorControlElem.style) {
            if (param.controlButtonVisibility !== "none" && !doNotShow) {
              selectorControlElem.style.display = "block";
              selectorControlElem.purposelyHidden = false;
            }
          }
          if (
            otherInputElement &&
            otherInputElement.options &&
            otherInputElement.selectedIndex >= 0
          ) {
            otherInputElement.options[otherInputElement.selectedIndex].scrollIntoView();
          }
        }
      }
      checkDisableOther(param, firstRender);
    }
  } catch (e) {
    e.message = `INFO: Error in select.js checkHideOther: ${e.message}`;
    setInfo(e.message);
  }
};

// refresh the selector in question to the appropriate options indicated by the values of any superior selectors
const refresh = function (event, paramName) {
  if (paramName.search("axis") === 1) {
    // this is a "brother" (hidden) scatterplot param. There is no need to refresh it or add event listeners etc.
    return;
  }
  const param = matsParamUtils.getParameterForName(paramName);
  const elem = matsParamUtils.getInputElementForParamName(paramName);

  /*
    OptionsGroups are a mechanism for displaying the select options in groups.
    A disabled option is used for the group header. Disabled options simply show up
    in the selector list in bold font and act as group titles. They are disabled so that
    they cannot be clicked. DisabledOptions are the headers that the options are to be grouped under.
    disabledOptions are optional so if there are disabledOptions they are the keys in the optionsGroups
    and they are the sort order of those keys.
    */
  const disabledOptions = matsParamUtils.getDisabledOptionsForParamName(paramName);
  const { optionsGroups } = param;
  const { optionsMap } = param;
  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;
  const isScorecard = matsCollections.Settings.findOne({}).scorecard;
  let statisticTranslations = {};
  if (isMetexpress) {
    statisticTranslations = matsCollections.statistic.findOne({
      name: "statistic",
    }).valuesMap;
  }

  const { superiorNames } = param;
  const superiorDimensionality =
    superiorNames !== undefined &&
    superiorNames !== null &&
    superiorNames.length > 0 &&
    Array.isArray(superiorNames[0])
      ? superiorNames.length
      : 1;
  const superiors = [];
  // get a list of the current superior selected values - in order of superiority i.e. [databaseValue,dataSourceValue]
  let sNames;
  if (superiorNames !== undefined) {
    if (superiorDimensionality === 1) {
      sNames = superiorNames;
    } else {
      [sNames] = superiorNames;
    }
    for (let sn = 0; sn < sNames.length; sn += 1) {
      const superiorElement = matsParamUtils.getInputElementForParamName(sNames[sn]);
      let selectedSuperiorValue =
        superiorElement.options[superiorElement.selectedIndex] === undefined
          ? matsParamUtils.getParameterForName(sNames[sn]).default
          : superiorElement.options[superiorElement.selectedIndex].text;
      if (sNames[sn].includes("statistic") && isMetexpress) {
        [selectedSuperiorValue] = statisticTranslations[selectedSuperiorValue];
      }
      superiors[0] = superiors[0] === undefined ? [] : superiors[0];
      superiors[0].push({ element: superiorElement, value: selectedSuperiorValue });
    }
    for (let sNameIndex = 1; sNameIndex < superiorDimensionality; sNameIndex += 1) {
      sNames = superiorNames[sNameIndex];
      for (let sn = 0; sn < sNames.length; sn += 1) {
        const superiorElement = matsParamUtils.getInputElementForParamName(sNames[sn]);
        let selectedSuperiorValue =
          superiorElement.options[superiorElement.selectedIndex] === undefined
            ? matsParamUtils.getParameterForName(sNames[sn]).default
            : superiorElement.options[superiorElement.selectedIndex].text;
        if (sNames[sn].includes("statistic") && isMetexpress) {
          [selectedSuperiorValue] = statisticTranslations[selectedSuperiorValue];
        }
        superiors[sNameIndex] =
          superiors[sNameIndex] === undefined ? [] : superiors[sNameIndex];
        superiors[sNameIndex].push({
          element: superiorElement,
          value: selectedSuperiorValue,
        });
      }
    }
  }
  /*
    So what are superiors now.....
    superiors = [[{element:anElement,value:aValue},{element:anElement,value:aValue}...]]
    or they might be [[{element:anElement,value:aValue},{element:anElement,value:aValue}...],[{element:anElement,value:aValue},{element:anElement,value:aValue}...],...]


     Axis-brothers:
     Axis-brothers are for scatter plots. They are a second hidden set of parameters that apply to a different axis.
     Because there may be axis "brothers" This refresh must go and
     see if there are any brother elements that are essentially hidden copies
     of this one, and also refresh their options lists

     Superior Heirarchy:
     There can be a heirarchy of superiors and dependents. The superiorNames are a list of paramNames. The most superior has the 0th index and
     the least superior has the highest index.
     The Refresh uses the superiors to get the appropriate options for a given options map.
     The way it works is that superiors are always refreshed first. The superior heirarchy selections are then used by a
     dependent to retrieve its appropriate optionsMap from the superiorOptionsMap.
     superiorsOptionsMap = {
        mostSuperiorValue0: {  // optionsMap for the most superior first value
            nextSuperiorValue0: [value0,value1,value2,value3,...],
            nextSuperiorValue1: [value0,value1,value2,value3,...],
            nextSuperiorValue2: [value0,value1,value2,value3,...],
            ...
        },
        mostSuperiorValue1:{  // optionsMap for the most superior second value
            nextSuperiorValue0: [value0,value1,value2,value3,...],
            nextSuperiorValue1: [value0,value1,value2,value3,...],
            nextSuperiorValue2: [value0,value1,value2,value3,...],
            ...
        },
        ...,
        mostSuperiorValue2:{  // optionsMap for the most superior third value
            nextSuperiorValue0: [value0,value1,value2,value3,...],
            nextSuperiorValue1: [value0,value1,value2,value3,...],
            nextSuperiorValue2: [value0,value1,value2,value3,...],
            ...
        },
     }
     */

  // find all the elements that have ids like .... "x|y|z" + "axis-" + this.name
  const { name } = param;
  const elems =
    document.getElementsByClassName("data-input") === undefined
      ? []
      : document.getElementsByClassName("data-input");
  Session.set("selected", $(elem).val());

  if (elem && elem.options) {
    if (elem.selectedIndex === undefined || elem.selectedIndex === -1) {
      if (param.default !== matsTypes.InputTypes.unused) {
        elem.selectedIndex = 0;
      }
    }
    let selectedText;
    if (param.multiple) {
      selectedText =
        elem.selectedIndex >= 0
          ? $(elem.selectedOptions)
              .map(function () {
                return this.value;
              })
              .get()
          : matsTypes.InputTypes.unused;
      if (selectedText.includes(",")) selectedText = selectedText.split(",");
    } else {
      selectedText =
        elem.selectedIndex >= 0
          ? elem.options[elem.selectedIndex].text
          : matsTypes.InputTypes.unused;
    }

    const brothers = [];
    for (let i = 0; i < elems.length; i += 1) {
      if (elems[i].id.indexOf(name) >= 0 && elems[i].id !== elem.id)
        brothers.push(elems[i]);
    }

    let myOptions = [];
    const selectedSuperiorValues = [];

    try {
      // index down through the options for the list of superiors
      // starting with the most superior down through the least superior
      // and get the options list for the first set of superiors.
      // These are the ancestral options.
      if (param.optionsMap) {
        let firstSuperiorOptions = optionsMap;
        const theseSuperiors =
          superiors === undefined || superiors.length === 0 ? [] : superiors[0];
        for (
          let theseSuperiorsIndex = 0;
          theseSuperiorsIndex < theseSuperiors.length;
          theseSuperiorsIndex += 1
        ) {
          const superior = theseSuperiors[theseSuperiorsIndex];
          const selectedSuperiorValue = superior.value;
          if (isScorecard) {
            firstSuperiorOptions =
              firstSuperiorOptions[selectedSuperiorValue] !== undefined
                ? firstSuperiorOptions[selectedSuperiorValue]
                : firstSuperiorOptions.NULL;
          } else {
            firstSuperiorOptions = firstSuperiorOptions[selectedSuperiorValue];
          }
        }
        myOptions = Array.isArray(firstSuperiorOptions)
          ? firstSuperiorOptions
          : Object.keys(firstSuperiorOptions);
      } else {
        myOptions = param.options;
      }

      // need to get the ancestral truth options because we may need to intersect the options

      /* tricky little bit here:
            SuperiorDimensionality:
             It is possible to have two superior options maps.. i.e. datasource and truth.
             In that case the superiorNames won't look like ["something","somethingelse"],
             instead it will look like [["something","somethingelse"],["someotherthing","someotherthingelse"]]
             i.e. it will be a multidimensional array.

             If the controlButton for one of these multi-dimensional superior elements is hidden ....
             matsParamUtils.getControlElementForParamName(superior.element.name).offsetParent !== null
             it has been hidden because it has a visibility dependency on another param
             i.e. truth-data-source and truth-variable (for mean there would be no truth, but for bias
             there must always be truth...).
             In this case these are dependent upon statistic such that if the statistic is "mean" the truth-data-source and truth-variable
             are hidden. See the wfip2 main.js statistic param as an example....
             "disableOtherFor:{'truth-data-source':[statisticOptionsMap.mean][0]},"
             and
             "hideOtherFor:{'truth-data-source':[statisticOptionsMap.mean][0]},"
             are the fields that cause the truth-data-source to be hidden when statistic is set to "mean".
             In that condition (the controlButton is hidden) the superior should not be used as an intersection in the selected sites.
             matsParamUtils.getControlElementForParamName(superior.element.name).offsetParent will be null if the controlButton
             for this element (this superior) is hidden. That is the tricky part ... it will be null.

             Also the unused superior is tested against the superior according to the truth table...
             used && unused  -> use the used
             unused and used -> use the used
             used and used -> use the intersection
             unused and unused - set the options to []

             A select may have a list of disabledOptions. These are used as optionGroup markers.
             */

      // need to get the actual options here
      for (let sNameIndex = 1; sNameIndex < superiorDimensionality; sNameIndex += 1) {
        // index down through the options for the list of superiors
        // starting with the most superior down through the least superior
        // and get the options list for the first set of superiors.
        // These are the ancestral options.
        let nextSuperiorOptions = optionsMap;
        const theseSuperiors =
          superiors === undefined || superiors.length === 0
            ? []
            : superiors[sNameIndex];
        for (
          let theseSuperiorsIndex = 0;
          theseSuperiorsIndex < theseSuperiors.length;
          theseSuperiorsIndex += 1
        ) {
          const superior = theseSuperiors[theseSuperiorsIndex];
          const selectedSuperiorValue = superior.value;
          nextSuperiorOptions = nextSuperiorOptions[selectedSuperiorValue];
        }
        // since we now have multiple options we have to intersect them
        myOptions = _.intersection(myOptions, nextSuperiorOptions);
      }
      if (myOptions && myOptions.length === 0) {
        // none used - set to []
        matsParamUtils.setValueTextForParamName(name, matsTypes.InputTypes.unused);
      }
    } catch (e) {
      e.message = `INFO: Error in select.js refresh: determining options from superiors: ${e.message}`;
      setInfo(e.message);
    }

    try {
      // reset the options of the select
      // if the options are null it might be that this is the initial setup.
      // so use the optionsmap and the default options for the map
      // it might also mean that there are no superiors for this param
      if (!myOptions) {
        // get the default options
        if (optionsGroups) {
          // optionGroups are an ordered map. It probably has options that are in the disabledOption list
          // which are used as markers in the select options pulldown. This is typical for models
          const optionsGroupsKeys = Object.keys(optionsGroups);
          for (let k = 0; k < optionsGroupsKeys.length; k += 1) {
            if (myOptions === null) {
              myOptions = [];
              myOptions.push(optionsGroupsKeys[k]);
              myOptions = myOptions.concat(optionsGroups[optionsGroupsKeys[k]]); // the primary group does not get sorted
            } else {
              myOptions.push(optionsGroupsKeys[k]);
              myOptions = myOptions.concat(optionsGroups[optionsGroupsKeys[k]].sort()); // non primary  groups get sorted
            }
          }
        } else {
          myOptions = param.options;
        }
      }
      let optionsAsString = "";
      if (myOptions === undefined || myOptions === null) {
        return;
      }
      let firstGroup = true;
      for (let i = 0; i < myOptions.length; i += 1) {
        const dIndex =
          disabledOptions === undefined ? -1 : disabledOptions.indexOf(myOptions[i]);
        if (dIndex >= 0) {
          // the option was found in the disabled options so it needs to be an optgroup label
          // disabled option
          if (firstGroup === true) {
            // first in group
            optionsAsString += `<optgroup label=${myOptions[i]}>`;
            firstGroup = false;
          } else {
            optionsAsString += "</optgroup>";
            optionsAsString += `<optgroup label=${myOptions[i]}>`;
          }
        } else {
          // regular option - the option was not found in the disabled options
          optionsAsString += `<option value='${myOptions[i]}'>${myOptions[i]}</option>`;
        }
      }
      if (disabledOptions !== undefined) {
        optionsAsString += "</optgroup>";
      }
      $(`select[name="${name}"]`).empty().append(optionsAsString);
      // reset the selected index if it had been set prior (the list may have changed so the index may have changed)
      let selectedOptionIndex;
      let selectedOptionOverlap = [];
      if (selectedText === "initial") {
        if (param.multiple && param.default instanceof Array) {
          selectedOptionOverlap = _.intersection(param.default, myOptions);
          selectedOptionIndex = selectedOptionOverlap.length > 0 ? 0 : -1;
        } else {
          selectedOptionIndex = myOptions.indexOf(param.default);
        }
      } else if (name === "plot-type") {
        // the met apps have a hidden plot-type selector that needs to match the current selected plot type
        selectedOptionIndex = myOptions.indexOf(matsPlotUtils.getPlotType());
      } else if (param.multiple) {
        if (param.name === "probability-bins") {
          // the prob bins behave differently with different kernels, so unfortuately we have to have translation code here
          if (
            _.intersection(selectedText, [
              "20",
              "30",
              "40",
              "50",
              "60",
              "70",
              "80",
              "90",
            ]).length > 0 &&
            _.intersection(myOptions, ["2", "3", "4", "5", "6", "7", "8", "9"]).length >
              0
          ) {
            selectedText = selectedText.map((x) => String(Number(x) / 10));
          }
          if (
            _.intersection(selectedText, ["2", "3", "4", "5", "6", "7", "8", "9"])
              .length > 0 &&
            _.intersection(myOptions, ["20", "30", "40", "50", "60", "70", "80", "90"])
              .length > 0
          ) {
            selectedText = selectedText.map((x) => String(Number(x) * 10));
          }
        }
        selectedOptionOverlap = _.intersection(selectedText, myOptions);
        selectedOptionIndex = selectedOptionOverlap.length > 0 ? 0 : -1;
      } else {
        selectedOptionIndex = myOptions.indexOf(selectedText);
      }
      let sviText = "";
      if (selectedOptionIndex === -1) {
        if (name === "plot-type") {
          setInfo(
            `INFO:  Plot type ${matsPlotUtils.getPlotType()} is not available for this database/model combination.`
          );
        }
        if (elem.selectedIndex >= 0) {
          for (let svi = 0; svi < selectedSuperiorValues.length; svi += 1) {
            const superior = superiors[svi];
            if (
              matsParamUtils.getControlElementForParamName(superior.element.name)
                .offsetParent !== null
            ) {
              if (svi > 0) {
                sviText += " and ";
              }
              sviText += selectedSuperiorValues[svi];
            }
          }
          setInfo(
            `I changed your selected ${name}: '${selectedText}' to '${myOptions[0]}' because '${selectedText}' is no longer an option for ${sviText}`
          );
        }
      }
      // if the selectedText existed in the new options list then the selectedOptionIndex won't be -1 and we have to choose the default option
      if (selectedOptionIndex === -1) {
        // if the param default is unused set it to unused
        // else just choose the 0th element in the element options. default?
        if (param.default === matsTypes.InputTypes.unused) {
          matsParamUtils.setValueTextForParamName(name, matsTypes.InputTypes.unused);
        } else {
          elem.selectedIndex = 0;
          if (elem && elem.options && elem.selectedIndex >= 0) {
            elem.options[elem.selectedIndex].scrollIntoView();
          }
          if (elem && elem.options && elem.selectedIndex >= 0) {
            matsParamUtils.setValueTextForParamName(
              name,
              elem.options[elem.selectedIndex].text
            );
          }
        }
      } else if (param.multiple && selectedOptionOverlap.length > 0) {
        // need to manually select all the desired options
        for (let idx = 0; idx < elem.options.length; idx += 1) {
          elem.options[idx].selected = "";
        }
        for (
          let overlapIdx = 0;
          overlapIdx < selectedOptionOverlap.length;
          overlapIdx += 1
        ) {
          for (let idx = 0; idx < elem.options.length; idx += 1) {
            if (elem.options[idx].value === selectedOptionOverlap[overlapIdx]) {
              elem.options[idx].selected = "selected";
            }
          }
        }
        matsParamUtils.setValueTextForParamName(name, selectedOptionOverlap);
      } else {
        elem.selectedIndex = selectedOptionIndex;
        if (elem && elem.options && elem.selectedIndex >= 0) {
          elem.options[elem.selectedIndex].scrollIntoView();
        }
        if (elem && elem.options && elem.selectedIndex >= 0) {
          matsParamUtils.setValueTextForParamName(
            name,
            elem.options[elem.selectedIndex].text
          );
        }
      }
      for (let i = 0; i < brothers.length; i += 1) {
        const belem = brothers[i];
        const belemSelectedOptions = $(belem.selectedOptions)
          .map(function () {
            return this.value;
          })
          .get();
        if (belemSelectedOptions === undefined || belemSelectedOptions.length === 0) {
          belem.options = [];
          for (let i1 = 0; i1 < myOptions.length; i1 += 1) {
            belem.options[belem.options.length] = new Option(
              myOptions[i1],
              myOptions[i1],
              i1 === 0,
              i1 === 0
            );
          }
        }
      }
    } catch (e) {
      e.message = `INFO: Error in select.js refresh: resetting selected options: ${e.message}`;
      setInfo(e.message);
    }
  }
  // These need to be done in the right order!
  // always check to see if an "other" needs to be hidden or disabled before refreshing
  checkHideOther(param, false);
  refreshPeer(event, param);
}; // refresh function

// eslint-disable-next-line no-undef
export default matsSelectUtils = {
  refresh,
  refreshPeer,
  refreshDependents,
  checkDisableOther,
  checkHideOther,
};
