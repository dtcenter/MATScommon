/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsTypes,
  matsSelectUtils,
  matsParamUtils,
  matsCollections,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Session, $, setError */

Template.item.onRendered(function () {
  try {
    if (
      typeof this.data.type !== "undefined" &&
      this.data.type === matsTypes.InputTypes.radioGroup
    ) {
      matsSelectUtils.checkHideOther(this.data, true); // calls checkDisable
    }
    $(document).ready(function () {
      $('[data-toggle="tooltip"]').tooltip();
    });
  } catch (e) {
    e.message = `Error in item.js rendered function checking to hide or disable other elements: ${e.message}`;
    setError(e);
  }
});

Template.item.helpers({
  tcname() {
    // Make everything title case
    let tcname = "";
    if (this.controlButtonText !== undefined) {
      tcname = this.controlButtonText;
    } else {
      tcname = this.name;
    }
    tcname = tcname.split(" ");
    for (let i = 0; i < tcname.length; i += 1) {
      tcname[i] = tcname[i].charAt(0).toUpperCase() + tcname[i].slice(1);
      tcname[i] = tcname[i] === "Utc" ? "UTC" : tcname[i];
    }
    tcname = tcname.join(" ").split("-");
    for (let i = 0; i < tcname.length; i += 1) {
      tcname[i] = tcname[i].charAt(0).toUpperCase() + tcname[i].slice(1);
    }
    return tcname.join(" ");
  },
  fa() {
    // font awesome helper
    if (this.controlButtonFA !== undefined) {
      return (
        `<i name="${this.name}-icon` +
        `" style="color:${this.default}"  class="${this.controlButtonFA}"></i>`
      );
    }
    return "";
  },
  lcname() {
    // Make everything lower case except first word
    let lcname = "";
    if (this.controlButtonText !== undefined) {
      lcname = this.controlButtonText;
    } else {
      lcname = this.name;
    }
    /*
        This little secion is transforming the lcname into something more presentable
        like "scorecard-schedule-mode" into "Scorecard schedule mode"
        or
        "scorecard-percent-stdv" into "Scorecard percent stdv"
        */
    lcname = lcname.split(" ");
    lcname[0] = lcname[0].charAt(0).toUpperCase() + lcname[0].slice(1);
    for (let i = 1; i < lcname.length; i += 1) {
      lcname[i] = lcname[i].charAt(0).toLowerCase() + lcname[i].slice(1);
      lcname[i] = lcname[i] === "Utc" ? "UTC" : lcname[i];
    }
    lcname = lcname.join(" ").split("-");
    lcname[0] = lcname[0].charAt(0).toUpperCase() + lcname[0].slice(1);
    for (let i = 1; i < lcname.length; i += 1) {
      lcname[i] = lcname[i].charAt(0).toLowerCase() + lcname[i].slice(1);
    }
    return lcname.join(" ");
  },
  textValue() {
    Session.get("lastUpdate");
    if (this.name === "label") {
      // label is handled specially
      return undefined;
    }
    if (matsParamUtils.getInputElementForParamName(this.name)) {
      return this.default;
    }
    if (this.value) {
      return this.value;
    }
    if (
      this.type === matsTypes.InputTypes.select &&
      (this.default === -1 ||
        this.default === undefined ||
        this.default === matsTypes.InputTypes.unused)
    ) {
      return matsTypes.InputTypes.unused;
    }
    return this.default;
  },
  hasHelp() {
    return this.help !== undefined;
  },
  isSelect() {
    return (
      typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.select
    );
  },
  isSelectMap() {
    return (
      typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.selectMap
    );
  },
  isInput() {
    return (
      typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.textInput
    );
  },
  isColor() {
    return typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.color;
  },
  isSpinner() {
    return (
      typeof this.type !== "undefined" &&
      this.type === matsTypes.InputTypes.numberSpinner
    );
  },
  isDateRange() {
    return (
      typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.dateRange
    );
  },
  isCheckBoxGroup() {
    return (
      typeof this.type !== "undefined" &&
      this.type === matsTypes.InputTypes.checkBoxGroup
    );
  },
  isRadioGroup() {
    return (
      typeof this.type !== "undefined" && this.type === matsTypes.InputTypes.radioGroup
    );
  },
  controlButton() {
    return `${matsTypes.InputTypes.controlButton}-${this.name}`;
  },
  resetButton() {
    return `${matsTypes.InputTypes.resetButton}-${this.type}`;
  },
  element() {
    return `${matsTypes.InputTypes.element}-${this.name}`;
  },
  display() {
    if (this.hidden) {
      return "none;";
    }
    if (
      this.displayPriority !== undefined &&
      this.displayPriority > Session.get("displayPriority")
    ) {
      return "none;";
    }
    if (
      this.controlButtonVisibility !== undefined &&
      this.controlButtonVisibility === "none"
    ) {
      return "none;";
    }
    if (!this.controlButtonCovered) {
      return "none;";
    }
    return "block; margin-top: 1.5em;";
  },
  elementHidden() {
    if (this.controlButtonCovered) {
      return "none";
    }
    return "block";
  },
  position() {
    if (
      typeof this.type !== "undefined" &&
      this.type === matsTypes.InputTypes.radioGroup
    ) {
      return "";
    }
    return "position:absolute";
  },
  zIndexVal() {
    // the difference selector keeps trying to cover the map modal, so increase the map's z-index, and decrease the difference selector's.
    if (
      typeof this.type !== "undefined" &&
      this.type === matsTypes.InputTypes.selectMap
    ) {
      return "10";
    }
    if (
      typeof this.type !== "undefined" &&
      this.type === matsTypes.InputTypes.radioGroup
    ) {
      return "4";
    }
    return "5";
  },
  defaultColor() {
    return this.default;
  },
  tooltipPlacement() {
    return this.tooltipPlacement === undefined ? "top" : this.tooltipPlacement;
  },
  tooltipTitle() {
    return this.tooltip === undefined ? "" : this.tooltip;
  },
});

Template.item.events({
  "click .control-button"() {
    Session.set("elementChanged", Date.now());
    const elem = document.getElementById(
      `${matsTypes.InputTypes.element}-${this.name}`
    );
    if (elem === undefined) {
      return false;
    }
    if (elem !== null && elem.style.display === "block") {
      elem.style.display = "none";
    } else {
      matsParamUtils.collapseParams();
      if (elem !== null) {
        elem.style.display = "block";
        if (this.type === matsTypes.InputTypes.select) {
          $(`#${this.name}-${this.type}`).trigger("click"); // need to foricibly open the selector for the select
        }
        if (this.type === matsTypes.InputTypes.selectMap) {
          $("#mapModal").modal("show");
          window.dispatchEvent(new Event("resize"));
        }
      }
    }
    return null;
  },
  "click .data-input"() {
    Session.set("elementChanged", Date.now());
    if (this.displayPriority !== undefined) {
      Session.set("displayPriority", this.displayPriority + 1);
    }
    const formats = Object.keys(matsTypes.PlotFormats);
    if ($.inArray(this, formats) !== -1) {
      Session.set("diffStatus", this);
    }
  },
  "change .data-input"(event) {
    Session.set("elementChanged", Date.now());
    event.target.checkValidity();
    if (this.type !== matsTypes.InputTypes.numberSpinner) {
      event.target.checkValidity();
      const elem = document.getElementById(
        `${matsTypes.InputTypes.element}-${this.name}`
      );
      if (elem === undefined) {
        return false;
      }
      if (elem !== null && elem.style.display === "block" && this.multiple !== true) {
        elem.style.display = "none";
      } else if (elem !== null) {
        elem.style.display = "block";
      }
    }
    const curveItem =
      Session.get("editMode") === undefined && Session.get("editMode") === ""
        ? undefined
        : document.getElementById(`curveItem-${Session.get("editMode")}`);
    if (curveItem && this.type !== matsTypes.InputTypes.dateRange) {
      $("#save").trigger("click");
    }
    return null;
  },

  "click .help"() {
    if (this.type === matsTypes.InputTypes.dateRange) {
      // the date range calendar is unfortunately bound to the help button, so we need to click it to re-close it
      const idref = `${this.name}-item`;
      $(`#${idref}`).click();
    }
    const { helpref } = Session.get("app");
    $("#matshelp").load(`${helpref}/${this.help} #matshelp`);
    $("#helpModal").modal("show");
  },
  invalid(event) {
    const defaultValue = matsCollections[event.currentTarget.name].findOne({
      name: event.currentTarget.name,
    }).default;
    if (this.type === matsTypes.InputTypes.numberSpinner) {
      let param;
      if (matsCollections[event.currentTarget.name] !== undefined) {
        param = matsCollections[event.currentTarget.name].findOne({
          name: event.currentTarget.name,
        });
      }
      if (param === undefined) {
        return;
      }
      setError(
        new Error(
          `invalid value (${event.currentTarget.value}) for ${event.currentTarget.name} it must be between ${event.currentTarget.min} and ${event.currentTarget.max} -- resetting to default value: ${defaultValue}`
        )
      );
    } else {
      let errMsg = Session.get("errorMessage");
      if (errMsg === "") {
        errMsg = `invalid value (${event.currentTarget.value}) for ${event.currentTarget.name}`;
      }
      setError(new Error(errMsg));
    }
    // eslint-disable-next-line no-param-reassign
    event.currentTarget.value = defaultValue;
  },
});
