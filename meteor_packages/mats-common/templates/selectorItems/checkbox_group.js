/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

Template.checkboxGroup.helpers({
  checkedByDefault(def) {
    if (def === this) {
      return "checked";
    }
    return "";
  },
  labelValue(optionsMap) {
    if (optionsMap !== undefined) {
      return optionsMap[this];
    }
    return this;
  },
});

Template.checkboxGroup.events({
  "change, blur"(event) {
    try {
      const text = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
});
