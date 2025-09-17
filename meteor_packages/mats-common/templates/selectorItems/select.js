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

/* global Session, $, setError */

/*
    Much of the work for select widgets happens in mats-common->imports->client->select_util.js. Especially the refresh
    routine which sets all the options. Don't forget to look there for much of the handling.
 */
Template.select.onRendered(function () {
  const ref = `${this.data.name}-${this.data.type}`;
  const elem = document.getElementById(ref);
  try {
    elem.options = [];
    if (elem) {
      elem.addEventListener("refresh", function (event) {
        // if the sellector changes we need to update both it and any dependents
        matsSelectUtils.refresh(event, this.name);
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

Template.select.events({
  "change .data-input"(event) {
    Session.set("elementChanged", Date.now());
    const paramName = event.target.name;
    if (paramName) {
      // These need to be done in the right order!
      // always check to see if an "other" needs to be hidden or disabled before refreshing
      matsSelectUtils.checkHideOther(this, false);
      document.getElementById(`element-${this.name}`).style.display = "none"; // be sure to hide the element div
      // if we're editing a curve with this change, update the curve
      const curveItem = document.getElementById(`curveItem-${Session.get("editMode")}`);
      if (curveItem) {
        curveItem.scrollIntoView(false);
      }
      // update value text on the selctor button
      setValue(paramName);
      if (this.multiple) {
        return true; // prevents the select 2 from closing on multiple selectors
      }
      matsSelectUtils.refreshDependents(event, this);
      if (this.name === "plotFormat") {
        // update difference curves if necessary
        matsCurveUtils.checkDiffs();
      }
      Session.set("lastUpdate", Date.now());
    }
    return false;
  },
  "click .doneSelecting"() {
    Session.set("elementChanged", Date.now());
    const controlElem = matsParamUtils.getControlElementForParamName(this.name);
    $(controlElem).trigger("click").trigger("change"); // close the selector and fire an event to apply changes
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
    $(`#${this.name}-${this.type}`).val(values).trigger("change");
    return false;
  },
  "click .clearSelections"() {
    // make selected values null
    $(`#${this.name}-${this.type}`).val(null).trigger("change");
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
      const controlElem = matsParamUtils.getControlElementForParamName(this.name);
      // prevent the selector from closing before we are done
      $(controlElem).trigger("click");
    }
    return false;
  },
});
