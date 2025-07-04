/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections, matsParamUtils, matsTypes } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";
import { moment } from "meteor/momentjs:moment";

// eslint-disable-next-line no-unused-vars
const daterangepicker = require("daterangepicker");

/* global Session, $, setError, setInfo */
/* eslint-disable no-console */

Template.dateRange.helpers({
  defaultDate() {
    const defaultDateRange = matsParamUtils.getDefaultDateRange(this.name);
    return defaultDateRange.dstr;
  },
});

Template.dateRange.onRendered(function () {
  // NOTE: Date fields are special in that they are qualified by plotType.
  // TimeSeries and Scatter plots have a common date range
  // but profile plots have a date range for each curve.
  // The decision to hide or show a dataRange is made here in the dateRange template

  const { name } = this.data;
  const idref = `${name}-${this.data.type}`;
  const elem = document.getElementById(`element-${name}`);
  const { superiorNames } = this.data;
  const defaultDateRange = matsParamUtils.getDefaultDateRange(name);
  const startInit = defaultDateRange.startDate;
  const stopInit = defaultDateRange.stopDate;
  const { dstr } = defaultDateRange;
  const isMetexpress =
    matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress;
  const { appName } = matsCollections.Settings.findOne({});
  let statisticTranslations = {};
  if (isMetexpress) {
    statisticTranslations = matsCollections.statistic.findOne({
      name: "statistic",
    }).valuesMap;
  }

  $(function () {
    $(`#${idref}`).daterangepicker({
      autoApply: true,
      parentEL: $(`#${idref}`),
      timePicker: true,
      timePicker24Hour: true,
      timePickerIncrement: 1,
      startDate: startInit,
      endDate: stopInit,
      showDropdowns: true,
      drops: "up",
      locale: {
        format: "MM/DD/YYYY HH:mm",
      },
      ranges: {
        Today: [moment.utc().startOf("day"), moment.utc().endOf("day")],
        Yesterday: [
          moment.utc().subtract(1, "days").startOf("day"),
          moment.utc().subtract(1, "days").endOf("day"),
        ],
        "Last 7 Full Days": [
          moment.utc().subtract(7, "days").startOf("day"),
          moment.utc().startOf("day"),
        ],
        "Last 30 Full Days": [
          moment.utc().subtract(30, "days").startOf("day"),
          moment.utc().startOf("day"),
        ],
        "Last 60 Full Days": [
          moment.utc().subtract(60, "days").startOf("day"),
          moment.utc().startOf("day"),
        ],
        "Last 90 Full Days": [
          moment.utc().subtract(90, "days").startOf("day"),
          moment.utc().startOf("day"),
        ],
        "Last 180 Full Days": [
          moment.utc().subtract(180, "days").startOf("day"),
          moment.utc().startOf("day"),
        ],
      },
      alwaysShowCalendars: true,
    });
    matsParamUtils.setValueTextForParamName(name, dstr);
  });

  $(`#${idref}`).on("apply.daterangepicker", function (ev, picker) {
    if (picker.startDate.toString() === picker.endDate.toString()) {
      setError(
        new Error(
          "date_range error:  Your start and end dates coincide, you must select a range! This is " +
            "because METARs and other obs can come in at slightly different times, so selecting only one time might " +
            "leave you with very few (or no) valid obs. Instead, try using a small range. For example, if you're " +
            "targeting the top-of-the-hour METARs at 2:00 am, set your time range from 1:45 am to 2:00 am, because " +
            "METARs often come in early."
        )
      );
      return false;
    }
    const valStr = `${picker.startDate
      .locale("en")
      .format("MM/DD/YYYY HH:mm")} - ${picker.endDate
      .locale("en")
      .format("MM/DD/YYYY HH:mm")}`;
    matsParamUtils.setValueTextForParamName(name, valStr);
    elem.style.display = "none";
    const curveItem =
      Session.get("editMode") === undefined && Session.get("editMode") === ""
        ? undefined
        : document.getElementById(`curveItem-${Session.get("editMode")}`);
    if (curveItem) {
      $("#save").trigger("click");
    }
    return null;
  });

  $(`#${idref}`).on("cancel.daterangepicker", function () {
    elem.style.display = "none";
  });

  elem.style.display = "none";

  $(".drp-buttons").each(function () {
    if ($(this).find("span.newRangeLabel").length === 0) {
      $(this).prepend(
        "<span class='newRangeLabel' style='text-align: right; font-size: 16px;'>Apply this range?&nbsp;&nbsp;</span>"
      );
      $(this).find("button.applyBtn").attr("id", `${name}-applyBtn`);
    }
  });

  const refresh = function () {
    try {
      // get the current values from the element and check for invalid
      const curVals = matsParamUtils.getValueForParamName(name).split(" - "); // it is a date object values are "someFromDate - someToDate"
      let startDsr = moment.utc(curVals[0], "MM/DD/YYYY HH:mm");
      let endDsr = moment.utc(curVals[1], "MM/DD/YYYY HH:mm");
      // get superior values and check for errors
      const superiorVals = [];
      if (superiorNames !== undefined) {
        const superiorDimensionality =
          superiorNames !== null &&
          superiorNames.length > 0 &&
          Array.isArray(superiorNames[0])
            ? superiorNames.length
            : 1;
        for (let si = 0; si < superiorDimensionality; si += 1) {
          let superiors = [];
          if (superiorDimensionality === 1) {
            superiors = superiorNames;
          } else {
            superiors = superiorNames[si];
          }
          let datesMap;
          for (let si2 = 0; si2 < superiors.length; si2 += 1) {
            const thisSuperior = superiors[si2];
            if (matsCollections[thisSuperior] !== undefined) {
              datesMap =
                datesMap === undefined
                  ? matsCollections[thisSuperior].findOne({ name: thisSuperior }).dates
                  : datesMap;
            }
            let sval =
              matsParamUtils.getInputElementForParamName(thisSuperior).options[
                matsParamUtils.getInputElementForParamName(thisSuperior).selectedIndex
              ].text;
            if (thisSuperior === "statistic" && isMetexpress) {
              [sval] = statisticTranslations[sval];
            }
            if (
              !(
                sval === matsTypes.InputTypes.unused ||
                sval === null ||
                datesMap === undefined ||
                matsParamUtils.getInputElementForParamName(thisSuperior) ===
                  undefined ||
                Number.isNaN(
                  matsParamUtils.getInputElementForParamName(thisSuperior).selectedIndex
                ) ||
                matsParamUtils.getInputElementForParamName(thisSuperior)
                  .selectedIndex === -1
              )
            ) {
              // skip this superior - it isn't being used right now
              datesMap = datesMap[sval];
            }
          }
          const superiorMinimumDateStr = datesMap.minDate;
          const superiorMinimumMoment = moment.utc(
            superiorMinimumDateStr,
            "MM/DD/YYYY HH:mm"
          );
          if (superiorMinimumMoment.isValid()) {
            superiorVals[si] = superiorVals[si] === undefined ? {} : superiorVals[si];
            superiorVals[si].min = superiorMinimumMoment;
          } else {
            setError(
              `date_range refresh error: The end date for the superiors: ${superiors} is invalid: ${superiorMinimumDateStr}`
            );
            return false;
          }
          const superiorMaximumDateStr = datesMap.maxDate;
          const superiorMaximumMoment = moment.utc(
            superiorMaximumDateStr,
            "MM/DD/YYYY HH:mm"
          );
          if (superiorMaximumMoment.isValid()) {
            superiorVals[si] = superiorVals[si] === undefined ? {} : superiorVals[si];
            superiorVals[si].max = superiorMaximumMoment;
          } else {
            setError(
              `date_range refresh error: The end date for the superiors: ${superiors} is invalid: ${superiorMaximumDateStr}`
            );
            return false;
          }
          if (superiorVals[si].min.isAfter(superiorVals[si].max)) {
            // error
            setError(
              `date_range refresh error: The date range for the superiors: ${superiors} is invalid. It has a start date/time that is later than the end date/time - ${superiorVals[
                si
              ].min.toString()} is after ${superiorVals[si].max.toString()}`
            );
            return false;
          }
        }
      }
      // get data range from superiors
      if (superiorVals.length === 0) {
        // no superiors involved - just leave the DSR alone
        return false;
      }

      // these need to be the values for the superiors as they will be not as they are
      let dataStart = superiorVals[0].min;
      let dataEnd = superiorVals[0].max;

      if (superiorVals.length > 1) {
        for (let si = 1; si < superiorVals.length; si += 1) {
          const tStart = superiorVals[si].min;
          const tEnd = superiorVals[si].max;
          if (dataEnd.isBefore(tStart)) {
            // NCD not coincidental data?
            setInfo(
              `You do not have any coincidental data with these two selections: The valid date ranges do not overlap - ${dataStart.toString()} to ${dataEnd.toString()} and ${tStart.toString()} to ${tEnd.toString()}`
            );
            return false;
          }
          if (tEnd.isBefore(dataStart)) {
            // NCD not coincidental data?
            setInfo(
              `You do not have any coincidental data with these two selections: The valid date ranges do not overlap - ${dataStart.toString()} to ${dataEnd.toString()} and ${tStart.toString()} to ${tEnd.toString()}`
            );
            return false;
          }
          // overlapping data
          if (tStart.isAfter(dataStart)) {
            dataStart = tStart;
          }
          if (tEnd.isBefore(dataEnd)) {
            dataEnd = tEnd;
          }
        }
      }
      // now we have a normalized date range for the selected superiors.
      // evaluate DRS
      if (!appName.includes("met-cyclone")) {
        // we want the exact duration of the selected hurricane season
        if (dataEnd.isBefore(startDsr) || dataStart.isAfter(endDsr)) {
          // the current user setting and the valid range do not overlap so just set the DSR to the most recent 30 days of the valid range
          endDsr = dataEnd;
          // set startDsr to the endDsr less 30 days or less the startDsr whichever is later
          const endDsrLess30 = moment.utc(endDsr).subtract(30, "days");
          if (endDsrLess30.isAfter(dataStart)) {
            startDsr = endDsrLess30;
          } else {
            startDsr = dataStart;
          }
        } else {
          // the current user setting and the valid range overlap
          if (startDsr.isBefore(dataStart)) {
            startDsr = dataStart;
          }
          if (endDsr.isAfter(dataEnd)) {
            endDsr = dataEnd;
          }
        }
      } else {
        startDsr = dataStart;
        endDsr = dataEnd;
      }
      // now reset the DSR with the evaluated date range
      const jqIdRef = `#${idref}`;
      $(jqIdRef).data("daterangepicker").setStartDate(startDsr);
      $(jqIdRef).data("daterangepicker").setEndDate(endDsr);
      const newDateStr = `${moment
        .utc(startDsr)
        .locale("en")
        .format("MM/DD/YYYY HH:mm")} - ${moment
        .utc(endDsr)
        .locale("en")
        .format("MM/DD/YYYY HH:mm")}`;
      matsParamUtils.setValueTextForParamName(name, newDateStr);
      if (elem && elem.style && elem.style.display === "block") {
        elem.style.display = "none";
      }
    } catch (error) {
      console.log(`Error in date_range.js.refresh : ${error.message}`);
    }
    return null;
  };

  // register refresh event for superior to use to enforce a refresh of the options list
  elem.addEventListener("refresh", function () {
    refresh();
  });
});

Template.dateRange.events({
  "click, blur"(event) {
    try {
      const text = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
  change(event) {
    try {
      const text = event.currentTarget.value;
      matsParamUtils.setValueTextForParamName(event.target.name, text);
    } catch (error) {
      matsParamUtils.setValueTextForParamName(event.target.name, "");
    }
  },
});
