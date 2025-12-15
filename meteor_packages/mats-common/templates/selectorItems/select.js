/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCurveUtils,
  matsParamUtils,
  matsSelectUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
// eslint-disable-next-line import/no-unresolved
import UseBootstrapSelect from "use-bootstrap-select";

/* global Session, $, setError */
global.selectorHandlers = {};

/*
    Much of the work for select widgets happens in mats-common->imports->client->select_util.js. Especially the refresh
    routine which sets all the options. Don't forget to look there for much of the handling.
 */
const setValue = function (pName) {
  const elem = matsParamUtils.getInputElementForParamName(pName);
  const { selectedOptions } = elem;
  if (
    selectedOptions === undefined ||
    selectedOptions.length === 0 ||
    elem.selectedIndex === -1
  ) {
    // nothing is selected so set the selector to unused
    matsParamUtils.setValueTextForParamName(pName, matsTypes.InputTypes.unused);
  } else if (selectedOptions.length === 1) {
    // set the selector to the single item
    matsParamUtils.setValueTextForParamName(pName, selectedOptions[0].text);
  } else {
    // multiselect with more than one selected item, so shorten the display text
    const firstOption = selectedOptions[0];
    const lastOption = selectedOptions[selectedOptions.length - 1];
    const text = `${firstOption.text} .. ${lastOption.text}`;
    matsParamUtils.setValueTextForParamName(pName, text);
  }
};

Template.select.onRendered(function () {
  const elem = matsParamUtils.getInputElementForParamName(this.data.name);
  try {
    elem.options = [];
    if (elem) {
      elem.addEventListener("refresh", function (event) {
        // event that responds when custom "refresh" events are issued for individual selectors
        matsSelectUtils.refresh(event, this.name);
      });
      elem.addEventListener("click", function () {
        // event that responds when the item is clicked
        matsSelectUtils.generalDataInputClickEvent();
      });
      elem.addEventListener("change", function (event) {
        // event that responds when the <select> underlying a selector changes
        Session.set("elementChanged", Date.now());
        const paramName = event.target.name;
        if (paramName) {
          // These need to be done in the right order!
          const param = matsParamUtils.getParameterForName(paramName);
          // Always check to see if a dependent selector
          // needs to be hidden or disabled before refreshing
          matsSelectUtils.checkHideOther(param, false);
          // if we're editing a curve with this change, update the curve
          const curveItem = document.getElementById(
            `curveItem-${Session.get("editMode")}`
          );
          if (curveItem) {
            curveItem.scrollIntoView(false);
          }
          // update value text on the selctor button
          setValue(paramName);
          if (param.multiple) {
            // prevents the selector from closing on multiple selectors
            return true;
          }
          matsSelectUtils.refreshDependents(event, param);
          if (param.name === "plotFormat") {
            // update difference curves if necessary
            matsCurveUtils.checkDiffs();
          }
          // $("#save").trigger("click");
          document.getElementById(`element-${paramName}`).style.display = "none"; // be sure to hide the element div
          Session.set("lastUpdate", Date.now());
        }
        return false;
      });
    }
  } catch (e) {
    e.message = `Error in select.js rendered: ${e.message}`;
    setError(e);
  }
  try {
    // do initial refresh of all selectors and dependents
    matsSelectUtils.checkHideOther(this.data, true); // calls checkDisable
    matsSelectUtils.refresh(null, this.data.name);
  } catch (e) {
    e.message = `Error in select.js rendered function checking to hide or disable other elements: ${e.message}`;
    setError(e);
  }
  // initialize comboboxes
  if (this.data.name !== "sites") {
    const selector = new UseBootstrapSelect(elem);
    const selectorKey = matsParamUtils.getInputIdForParam(
      matsParamUtils.getParameterForName(this.data.name)
    );
    // make the combobox handles globally available so that the whole client can use them.
    global.selectorHandlers[selectorKey] = selector;
  }
});

Template.select.helpers({
  multiple() {
    if (this.multiple === true) {
      return "multiple";
    }
    return null;
  },
  isMultiple() {
    return this.multiple === true;
  },
});

Template.select.events({
  "click .doneSelecting"() {
    Session.set("elementChanged", Date.now());
    const controlElem = matsParamUtils.getControlElementForParamName(this.name);
    if (
      this.name === "sites" &&
      matsParamUtils.getInputElementForParamName("sitesMap")
    ) {
      $(controlElem).trigger("click").trigger("change"); // close the selector and fire an event to apply changes
      // let the map selector know that it needs to reflect changes in the sites selector.
      matsParamUtils
        .getInputElementForParamName("sitesMap")
        .dispatchEvent(new CustomEvent("refresh"));
    } else {
      $(controlElem).trigger("click"); // close the selector
    }
    const editMode = Session.get("editMode");
    const curveItem =
      editMode === undefined && editMode === ""
        ? undefined
        : document.getElementById(`curveItem-${editMode}`);
    if (curveItem && this.type !== matsTypes.InputTypes.dateRange) {
      // if we're editing a curve, propagate changes to that curve
      $("#save").trigger("click");
    }
    return false;
  },
  "click .selectAll"() {
    const elem = matsParamUtils.getInputElementForParamName(this.name);
    const values = [];
    for (let i = 0; i < elem.options.length; i += 1) {
      values.push(elem.options[i].text);
    }
    // assign all of the values to the selector
    if (global.selectorHandlers[`${this.name}-${this.type}`]) {
      global.selectorHandlers[`${this.name}-${this.type}`].setValue(values);
    } else {
      $(`#${this.name}-${this.type}`).val(values).trigger("change");
    }
    return false;
  },
  "click .clearSelections"() {
    if (global.selectorHandlers[`${this.name}-${this.type}`]) {
      global.selectorHandlers[`${this.name}-${this.type}`].clearValue();
      global.selectorHandlers[`${this.name}-${this.type}`].show();
    } else {
      // make selected values null
      $(`#${this.name}-${this.type}`).val(null).trigger("change");
    }
    return false;
  },
  "change, blur .item"(event) {
    try {
      let text = "";
      if (event.target.multiple) {
        const values = $(event.target).val();
        if (!values || !values.length) {
          // nothing is selected so set the selector to unused
          text = matsTypes.InputTypes.unused;
        } else {
          // multiselect with more than one selected item, so shorten the display text
          const firstOption = values[0];
          const lastOption = values[values.length - 1];
          text = `${firstOption} .. ${lastOption}`;
        }
      } else {
        // set the selector to the single item
        text = $(event.target).val();
      }
      if (
        // something is wrong so set the selector to unused
        (text === "" || text === undefined || text === null) &&
        (this.default === -1 ||
          this.default === undefined ||
          this.default === null ||
          event.currentTarget.selectedIndex === -1)
      ) {
        text = matsTypes.InputTypes.unused;
      }
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
    // afterwards just propagate changes to curves being edited, if any.
    const editMode = Session.get("editMode");
    const curveItem =
      editMode === undefined && editMode === ""
        ? undefined
        : document.getElementById(`curveItem-${editMode}`);
    if (curveItem && this.type !== matsTypes.InputTypes.dateRange) {
      $("#save").trigger("click");
    }
    if (event.target.multiple) {
      Session.set("editMode", editMode);
    }
    return false;
  },
});
