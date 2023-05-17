/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsTypes, matsCollections, matsPlotUtils } from "meteor/randyp:mats-common";

const isEditing = function () {
  const mode = Session.get("editMode");
  return !(mode === "" || mode === undefined || mode === null);
};
const setAxisText = function (axis) {
  Session.set(
    `${axis}CurveText`,
    `${axis} ${matsPlotUtils.getAxisText(matsPlotUtils.getPlotType())}`
  );
  Session.set(`${axis}CurveColor`, "green");
  Session.set("axisCurveIcon", "fa-check");
};

Template.scatter2d.helpers({
  modeText() {
    return isEditing()
      ? `Editing the curve ${Session.get("editMode")} (${Session.get("axis")})`
      : "Creating a new curve";
  },
  creating() {
    if (isEditing()) {
      return "none";
    }
    return "block";
  },
  editing() {
    if (isEditing()) {
      return "block";
    }
    return "none";
  },
  xaxisCurveText() {
    if (isEditing()) {
      setAxisText("xaxis");
    }
    const t = Session.get("xaxisCurveText");
    if (t) {
      return t;
    }
    Session.set("xaxisCurveText", "XAXIS NOT YET APPLIED");
    return "XAXIS NOT YET APPLIED";
  },
  yaxisCurveText() {
    if (isEditing()) {
      setAxisText("yaxis");
    }
    const t = Session.get("yaxisCurveText");
    if (t || isEditing()) {
      return t;
    }
    Session.set("yaxisCurveText", "YAXIS NOT YET APPLIED");
    return "YAXIS NOT YET APPLIED";
  },
  yApplyEnabled() {
    const c = Session.get("xaxisCurveColor");
    if (c === "red" && !isEditing()) {
      return "disabled";
    }
    return "";
  },

  xaxisCurveColor() {
    const t = Session.get("xaxisCurveColor");
    if (t) {
      return t;
    }
    Session.set("xaxisCurveColor", "red");
    return "red";
  },
  yaxisCurveColor() {
    const t = Session.get("yaxisCurveColor");
    if (t) {
      return t;
    }
    Session.set("yaxisCurveColor", "red");
    return "red";
  },
  curveIcon() {
    const t = Session.get("axisCurveIcon");
    if (t) {
      return t;
    }
    Session.set("axisCurveIcon", "fa-asterisk");
    return "-solid fa-asterisk";
  },
  title() {
    return "Scatter Plot parameters";
  },
  scatter2dParams() {
    const params = matsCollections.Scatter2dParams.find({}).fetch();
    return params;
  },
  scatter2dOptions() {
    const { options } = this;
    return options;
  },
  name(param) {
    // console.log("name: " + param.name);
    const name = param.name.replace(/ /g, "-");
    return name;
  },
  className(param) {
    // console.log("name: " + param.name);
    const cname = `${param.name.replace(/ /g, "-")}-${param.type}`;
    return cname;
  },

  type(param) {
    switch (param.type) {
      case matsTypes.InputTypes.checkBoxGroup:
        return "checkbox";
        break;
      case matsTypes.InputTypes.radioGroup:
        return "radio";
        break;
      case matsTypes.InputTypes.select:
        return "select";
        break;
      case matsTypes.InputTypes.numberSpinner:
        return "number";
        break;
      default:
        return "text";
    }
  },
  default() {
    return this.default;
  },
  idOption(param) {
    let id = `${param.name}-${param.type}-${this}`;
    id = id.replace(/ /g, "-");
    return id;
  },
  idParam() {
    let id = `${this.name}-${this.type}`;
    id = id.replace(/ /g, "-");
    return id;
  },
  plotType() {
    return matsTypes.PlotTypes.scatter2d;
  },
  isDefault(param) {
    const def = param.default;
    if (def === this) {
      return "checked";
    }
    return "";
  },
  displayScatter2d() {
    if (matsPlotUtils.getPlotType() === matsTypes.PlotTypes.scatter2d) {
      return "block";
    }
    return "none";
  },
  label(param, parent) {
    if (parent.name === "Fit Type") {
      return parent.optionsMap[this];
    }
    return this;
  },
  labelParam() {
    return this.name;
  },
  log() {
    console.log(this);
  },
  axis(param) {
    const axis = Session.get("axis");
    if (axis === undefined) {
      if (param) {
        return param.default;
      }
      return "xaxis";
    }
    return axis;
  },
  isNumberSpinner(param) {
    return param.type === matsTypes.InputTypes.numberSpinner;
  },
  hasHelp() {
    return this.help !== undefined;
  },
});

const apply = function (axis) {
  const elems = document.getElementsByClassName("data-input");
  const curveNames = matsCollections.CurveParamsInfo.find({
    curve_params: { $exists: true },
  }).fetch()[0].curve_params;
  const param_elems = _.filter(elems, function (elem) {
    return _.contains(curveNames, elem.name);
  });
  const l = param_elems.length;
  for (let i = 0; i < l; i++) {
    const pelem = param_elems[i];
    // console.log("pelem.type is " + pelem.type);
    const elem_id = pelem.id;
    const target_id = `${axis}-${elem_id}`;
    const telem = document.getElementById(target_id);
    // Notice that these types are not matsTypes these are javascript types
    if (pelem.type === "select-multiple") {
      var $options = $(`#${elem_id} > option`).clone();
      $(`#${target_id}`).empty().append($options);
      const selectedOptions = $(pelem.selectedOptions)
        .map(function () {
          return this.value;
        })
        .get();
      for (let x = 0; x < telem.options.length; x++) {
        if ($.inArray(telem.options[x].value, selectedOptions) !== -1) {
          telem.options[x].selected = true;
        } else {
          telem.options[x].selected = false;
        }
      }
    } else if (pelem.type === "select-one") {
      var $options = $(`#${elem_id} > option`).clone();
      $(`#${target_id}`).empty().append($options);
      telem.selectedIndex = pelem.selectedIndex;
    } else if (pelem.type === "radio") {
      // NOT SURE THIS IS RIGHT
      // console.log(pelem.name + " is " + $('input[name="' + pelem.name + '"]:checked').val());
      $(`input[name="${telem.name}"]:checked`);
    } else if (pelem.type === "button") {
      telem.value = pelem.value;
    } else {
      telem.value = pelem.value;
    }
  }
  setAxisText(axis);
};

Template.scatter2d.events({
  "click .apply-params-to-xaxis"(event) {
    apply("xaxis");
  },
  "click .apply-params-to-yaxis"(event) {
    apply("yaxis");
  },
  "change .axis-selector-radioGroup"(event) {
    const newAxis = event.currentTarget.value;
    Session.set("axis", newAxis);
    const elems = document.getElementsByClassName("data-input");
    const axis_elems = _.filter(elems, function (elem) {
      return elem.name.indexOf(newAxis) > -1;
    });
    const l = axis_elems.length;
    for (let i = 0; i < l; i++) {
      const aelem = axis_elems[i];
      const aelem_id = aelem.id;
      // remove the axis part at the front
      const target_id = aelem_id.substring(newAxis.length + 1, aelem_id.length);
      const telem = document.getElementById(target_id);
      if (aelem.type === "select-multiple") {
        $(telem).val(
          $(aelem.selectedOptions)
            .map(function () {
              return this.value;
            })
            .get()
        );
      } else if (aelem.type === "radio") {
        // NOT SURE THIS IS RIGHT
        // console.log(pelem.name + " is " + $('input[name="' + pelem.name + '"]:checked').val());
        $(`input[name="${telem.name}"]:checked`);
      } else if (aelem.type === "button") {
        telem.value = aelem.value;
      } else {
        telem.value = aelem.value;
      }
      telem.dispatchEvent(new CustomEvent("axisRefresh"));
    }
  },
  "click .axishelp"() {
    $("#matshelp").load("/help/scatter-help.html #matshelp");
    $("#helpModal").modal("show");
  },
  "click .help"() {
    $("#matshelp").load(`/help/${this.help} #matshelp`);
    $("#helpModal").modal("show");
  },
});
