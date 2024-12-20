/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsCollections,
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
  $(`#${ref}`).select2({
    minimumResultsForSearch: 20,
    closeOnSelect: false,
    dropdownAutoWidth: true,
  });

  const elem = document.getElementById(ref);
  try {
    // register refresh event for axis change to use to enforce a refresh

    if (elem) {
      elem.addEventListener("axisRefresh", function (event) {
        // Don't know why I have to do this, I expected the parameter data to be in the context....
        if (matsCollections[this.name] !== undefined) {
          const paramData = matsCollections[this.name].findOne(
            { name: this.name },
            {
              dependentNames: 1,
              peerName: 1,
            }
          );
          matsSelectUtils.refreshPeer(event, paramData);
        }
      });
    }

    // register refresh event for any superior to use to enforce a refresh of the options list
    if (ref.search("axis") === 1) {
      // this is a "brother" (hidden) scatterplot param. There is no need to refresh it or add event listeners etc.
      return;
    }
    elem.options = [];
    if (elem) {
      elem.addEventListener("refresh", function (event) {
        matsSelectUtils.refresh(event, this.name);
      });
    }
  } catch (e) {
    e.message = `Error in select.js rendered: ${e.message}`;
    setError(e);
  }
  try {
    matsSelectUtils.checkHideOther(this.data, true); // calls checkDisable
    matsSelectUtils.refresh(null, this.data.name);
  } catch (e) {
    e.message = `Error in select.js rendered function checking to hide or disable other elements: ${e.message}`;
    setError(e);
  }
});

Template.select.helpers({
  optionMaxLength() {
    if (!this.options) {
      return 10;
    }
    const longest = this.options.reduce(function (a, b) {
      if (a === null && b === null) {
        return null;
      }
      if (a === null) {
        return b;
      }
      if (b === null) {
        return a;
      }
      return a.length > b.length ? a : b;
    });
    if (!longest) {
      return 10;
    }
    const ret = longest.length <= 10 ? 10 : Math.round(longest.length * 0.8);

    return ret;
  },

  isSelectedByDefault(p) {
    if (p.default === this) {
      return "selected"; // the selected option
    }
    return ""; // not the selected option
  },
  options() {
    let sOptions = [];
    // process options as an option list
    if (this.options === matsTypes.InputTypes.unused) {
      return [];
    }
    if (this.optionsGroups) {
      // options have optionGroups
      this.optionsGroups.foreach(function (value) {
        sOptions.concat(value);
      });
    } else {
      sOptions = matsParamUtils.typeSort(this.options);
    }
    return sOptions;
  },
  multiple() {
    if (this.multiple === true) {
      return "multiple";
    }
    return null;
  },
  isMultiple() {
    return this.multiple === true;
  },
  selectionIsOptional() {
    return this.selectionOptional === true;
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
    // set to the default - the 0th one
    matsParamUtils.setValueTextForParamName(pName, matsTypes.InputTypes.unused);
  } else if (selectedOptions.length === 1) {
    matsParamUtils.setValueTextForParamName(pName, selectedOptions[0].text);
  } else {
    // selected options is greater than 1 - must be a multiple
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
    if (paramName === undefined) {
      return false;
    }
    // These need to be done in the right order!
    // always check to see if an "other" needs to be hidden or disabled before refreshing
    matsSelectUtils.checkHideOther(this, false);
    matsSelectUtils.refreshPeer(event, this);
    document.getElementById(`element-${this.name}`).style.display = "none"; // be sure to hide the element div
    const curveItem = document.getElementById(`curveItem-${Session.get("editMode")}`);
    if (curveItem) {
      curveItem.scrollIntoView(false);
    }
    setValue(paramName);
    if (this.multiple) {
      return true; // prevents the select 2 from closing on multiple selectors
    }
    $(`#${this.name}-${this.type}`).select2("close");
    matsSelectUtils.refreshDependents(event, this);
    if (this.name === "plotFormat") {
      matsCurveUtils.checkDiffs();
    }
    Session.set("lastUpdate", Date.now());
    return false;
  },
  "click .doneSelecting"() {
    Session.set("elementChanged", Date.now());
    const controlElem = matsParamUtils.getControlElementForParamName(this.name);
    $(`#${this.name}-${this.type}`).select2("close").trigger("change"); // apply the selection choices to the select2
    const editMode = Session.get("editMode");
    const curveItem =
      editMode === undefined && editMode === ""
        ? undefined
        : document.getElementById(`curveItem-${editMode}`);
    if (curveItem && this.type !== matsTypes.InputTypes.dateRange) {
      $("#save").trigger("click");
    }
    if (editMode) {
      $(`#${this.name}-${this.type}`).select2("close"); // use the close on the selector when editing
    } else {
      $(controlElem).trigger("click"); // clicking the control element hides the selector when not editing
      $(`#${this.name}-${this.type}`).select2("close");
    }
    return false;
  },
  "click .selectAll"() {
    const elem = matsParamUtils.getInputElementForParamName(this.name);
    const values = [];
    for (let i = 0; i < elem.options.length; i += 1) {
      values.push(elem.options[i].text);
    }
    $(`#${this.name}-${this.type}`).select2().val(values).trigger("change");
    return false;
  },
  "click .clearSelections"() {
    $(`#${this.name}-${this.type}`).select2().val(null).trigger("change");
    return false;
  },
  "click .doNotUse"() {
    $(`#${this.name}-${this.type}`).select2().val(null).trigger("change");
    return false;
  },
  "change, blur .item"(event) {
    try {
      let text = "";
      if (this.type === matsTypes.InputTypes.selectOrderEnforced) {
        /* check the validity of the order enforcement.
                   The requirement for order enforced selectors is that
                   some curve must have previously selected the earlier (lower ordered)
                   options in the options array, not counting the default option to make this a valid selection.
                   For example if my options are... ['auto by variable','y1','y2',y3'] and 'auto by variable'
                   is the selectors default then choosing 'y2' or 'y3' prior to choosing 'y1' is not valid and
                   choosing 'y3' prior to choosing 'y1' and 'y2' is not valid.
                 */
        // what is the default?
        const defaultOption = this.default;
        const selection = $(event.target).val();
        const curves = Session.get("Curves");
        const { options } = this;
        const priorSelected = [defaultOption];
        for (let ci = 0; ci < curves.length; ci += 1) {
          const curve = curves[ci];
          const curveOption = curve[this.name];
          priorSelected.push(curveOption);
        }
        let unusedOption = "";
        if (!priorSelected.includes(selection)) {
          // this option has not been selected prior
          // check to see if all the prior options to this one are selected
          for (let oi = 0; oi < options.length; oi += 1) {
            const option = options[oi];
            // We reached the selected option
            if (option === selection) {
              break;
            }
            if (!priorSelected.includes(option)) {
              unusedOption = option;
              break;
            }
          }
          if (unusedOption === "") {
            // is valid all prior options were selected
            event.target.setCustomValidity(this.name, "");
          } else {
            // HACK ALERT! the customValidity stuff seems to have been overridden in the invalid event event handler of item.js
            Session.set(
              "errorMessage",
              `The prior option: ${unusedOption} was not selected for this selector, you must use that first.`
            );
            event.target.setCustomValidity(
              this.name,
              `The prior option: ${unusedOption} was not selected for this selector, you must use that first.`
            );
            event.target.checkValidity();
            //                        matsParamUtils.setInputForParamName(this.name,this.default);
          }
        }
      }
      if (event.target.multiple) {
        const values = $(event.target).val();
        if (values === null) {
          // happens if unused or empty
          text = matsTypes.InputTypes.unused;
        } else {
          const firstOption = values[0];
          const lastOption = values[values.length - 1];
          text = `${firstOption} .. ${lastOption}`;
        }
      } else {
        text = $(event.target).val();
      }
      if (
        this.type === matsTypes.InputTypes.select &&
        (text === "" || text === undefined || text === null) &&
        (this.default === -1 ||
          this.default === undefined ||
          this.default === null ||
          event.currentTarget.selectedIndex === -1)
      ) {
        text = matsTypes.InputTypes.unused;
        // $('#' + this.name + "-" + this.type).select2().val(null).trigger('change');
      }
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
    const editMode = Session.get("editMode");
    const curveItem =
      editMode === undefined && editMode === ""
        ? undefined
        : document.getElementById(`curveItem-${editMode}`);
    if (curveItem && this.type !== matsTypes.InputTypes.dateRange) {
      $("#save").trigger("click");
    }
    if (event.target.multiple) {
      Session.set("editMode", editMode); // restore the editing of the curve item for muli selects
      const controlElem = matsParamUtils.getControlElementForParamName(this.name);
      $(controlElem).trigger("click"); // reopen the select2 - the regular open is not located properly so do it by clicking the control element button
    }
    return false;
  },
  focusout() {
    // close the selector if it is left open
    // event.currentTarget....
  },
});
