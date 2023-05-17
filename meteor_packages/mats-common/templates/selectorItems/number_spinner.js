/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils, matsCollections } from "meteor/randyp:mats-common";

const refresh = function (name) {
  if (matsCollections[name] !== undefined) {
    const paramData = matsCollections[name].findOne(
      { name },
      { dependentNames: 1, peerName: 1 }
    );
    const { optionsMap } = paramData;
    const { superiorNames } = paramData;
    const ref = `${paramData.name}-${paramData.type}`;
    const refValueDisplay = `controlButton-${paramData.name}-value`;
    const dispElem = document.getElementById(refValueDisplay);
    const elem = document.getElementById(ref);
    let dispDefault = paramData.default;
    let { min } = paramData;
    let step = paramData.step === undefined ? "any" : paramData.step;
    let { max } = paramData;
    for (let si = 0; si < superiorNames.length; si++) {
      const superiorElement = matsParamUtils.getInputElementForParamName(
        superiorNames[si]
      );
      const selectedSuperiorValue =
        superiorElement.options[superiorElement.selectedIndex] &&
        superiorElement.options[superiorElement.selectedIndex].text;
      const options = optionsMap[selectedSuperiorValue];
      if (options === undefined) {
        continue;
      }
      min = Number(options.min) < Number(min) ? options.min : min;
      max = Number(options.max) > Number(max) ? options.max : max;
      if (step !== "any" && options.step !== "any") {
        step = Number(options.step) < Number(step) ? options.step : step;
      }
      dispDefault = options.default !== undefined ? options.default : dispDefault;
    }
    elem.setAttribute("min", min);
    elem.setAttribute("max", max);
    elem.setAttribute("step", step);
    elem.value = dispDefault;
  }
};

Template.numberSpinner.helpers({
  defaultValue() {
    return this.default;
  },
  min() {
    // default
    return this.min;
  },
  max() {
    // default
    return this.max;
  },
  step() {
    // default
    return this.step;
  },
});

Template.numberSpinner.onRendered(function () {
  // register an event listener so that the select.js can ask the map div to refresh after a selection
  const ref = `${this.data.name}-${this.data.type}`;
  const elem = document.getElementById(ref);
  if (ref.search("axis") === 1) {
    // this is a "brother" (hidden) scatterplot param. There is no need to refresh it or add event listeners etc.
    return;
  }
  elem.addEventListener("refresh", function (e) {
    refresh(this.name);
  });
});

Template.numberSpinner.events({
  "change, blur"(event) {
    try {
      event.target.checkValidity();
      const text = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
});
