/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import {
  matsCollections,
  matsSelectUtils,
  matsParamUtils,
} from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global $ */

Template.radioGroup.helpers({
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

/*
   NOTE: hideOtherFor - radio button groups.
   The hideOtherFor plotParam option for radio groups is similar to hideOtherFor for select params.
   The key in the map is the param name that is to be hidden for any of the values in the value array.
   hideOtherFor: {
       'param-name-to-be-hidden':['checked-option-that-hides','other-checked-option-that-hides', ...]
   }

   example:
   hideOtherFor: {
       'scorecard-recurrence-interval':['once'],
       'these-hours-of-the-day':['once'],
       'these-days-of-the-week':['once'],
       'these-days-of-the-month':['once'],
       'these-months':['once'],
       'dates':['recurring']
   },

   */
Template.radioGroup.events({
  "change, blur"(event) {
    try {
      const text = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, text);

      // check hide other for
      const radioGroupParam = matsCollections.PlotParams.findOne({
        name: event.target.parentElement.id.replace("-radioGroup", ""),
      });
      if (radioGroupParam !== "undefined") {
        matsSelectUtils.checkHideOther(radioGroupParam, false); // calls checkDisable

        // trigger changes in dependent radio groups, if any exist, without changing their values
        // this makes sure that *their* hideOtherFor is correct
        if (radioGroupParam.dependentRadioGroups !== undefined) {
          for (
            let didx = 0;
            didx < radioGroupParam.dependentRadioGroups.length;
            didx += 1
          ) {
            const dependentElemOptions = matsParamUtils
              .getInputElementForParamName(radioGroupParam.dependentRadioGroups[didx])
              .getElementsByTagName("input");
            for (let deidx = 0; deidx < dependentElemOptions.length; deidx += 1) {
              if (dependentElemOptions[deidx].checked) {
                $(`#${dependentElemOptions[deidx].id}`).trigger("change");
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
});
