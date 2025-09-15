/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsParamUtils } from "meteor/randyp:mats-common";
import { Template } from "meteor/templating";

/* global Plotly, $ */

Template.map.onRendered(function () {
  const defaultAttrs = this; // save for when we need to reset to defaults
  let divElement; // save so the event handlers can talk to the two selectors
  let targetElement; // save so the event handlers can talk to the two selectors

  $.getScript("https://cdn.plot.ly/plotly-3.1.0.min.js", function () {
    let targetId = "";
    let peerName = "";
    let markers = [];
    let thisMarkers = [];
    let peerOptions = [];
    let selectedValues = [];
    let divId = "";
    let layout = {};
    let dataset = {};

    // method to initialize the map selector
    const initializeSelectorMap = function (item) {
      const thesePeerOptions = [];
      const defaultPoint = item.data.defaultMapView.point;
      const defaultZoomLevel = item.data.defaultMapView.zoomLevel;
      peerName = item.data.peerName;

      [targetElement] = document.getElementsByName(peerName);
      if (!targetElement) {
        return;
      }
      targetId = `#${targetElement.id}`;

      markers = item.data.optionsMap; // from app startup
      thisMarkers = []; // markers valid for this data source

      // find out what peer options are available for this data source
      if (targetElement.options) {
        for (let i = 0; i < targetElement.options.length; i += 1) {
          thesePeerOptions.push(targetElement.options[i].text);
        }
      }
      selectedValues = $(targetId).val() ? $(targetId).val() : [];

      divElement = `${item.data.name}-${item.data.type}`;
      divId = `#${divElement}`;

      layout = {
        autosize: true,
        // height: 500,
        // width: 840,
        hovermode: "closest",
        map: {
          bearing: 0,
          center: {
            lat: defaultPoint[0],
            lon: defaultPoint[1],
          },
          pitch: 0,
          zoom: defaultZoomLevel,
          style: "light",
        },
        margin: {
          l: 10,
          r: 10,
          b: 10,
          t: 10,
          pad: 4,
        },
        showlegend: false,
      };

      dataset = {
        label: "sitesMap",
        siteName: [],
        lat: [],
        lon: [],
        text: [],
        type: "scattermap",
        mode: "markers",
        marker: {
          color: [],
          opacity: 1,
        },
      };

      // set the initial site marker locations and colors
      let marker;
      for (let sidx = 0; sidx < thesePeerOptions.length; sidx += 1) {
        marker = markers.find((obj) => obj.name === thesePeerOptions[sidx]);
        thisMarkers[sidx] = marker;
        dataset.siteName[sidx] = marker.name;
        dataset.text[sidx] = marker.name;
        [dataset.lat[sidx]] = marker.point;
        [, dataset.lon[sidx]] = marker.point;
        if (selectedValues.indexOf(marker.name) === -1) {
          dataset.marker.color[sidx] = marker.options.color;
        } else {
          dataset.marker.color[sidx] = marker.options.highLightColor;
        }
      }
      peerOptions = thesePeerOptions;
    };

    // call the above initialization for the first time
    initializeSelectorMap(defaultAttrs);

    // draw the map for the first time
    Plotly.newPlot($(divId)[0], [dataset], layout, {
      showLink: false,
      scrollZoom: true,
    });

    /*

            The following lines of code are event handlers for if a user clicks on a single station, or uses the area select
            tools to highlight a group of stations. For now, the logic is such that individual stations can toggle between
            chosen and unchosen by clicking them, but the area select tools will just choose everything that is outlined.
            This is so that if a user has been manually choosing stations and then gives up and uses the area select, all of
            their intended stations will be chosen (the ones they had already manually selected won't be unchosen). There will
            be some sort of 'deselect all' button on this modal to unchoose everything.

            NOTE: We are using plotly's event handlers here, but we are not using its native chosen/unchosen capabilities.
            Instead, we are getting the chosen values back from the area select and adding them into out own arrays. We then
            finish by telling plotly to deselect everything in its own internal accounting. There are two reasons for this:
                1) plotly's ways of handling chosen/unchosen values are way more complicated than is needed here
                2) under plotly's system, if we use the area select once, we then can't go back and add other areas or
                individual stations without losing the original selection.

            However, we may want to explore plotly's native chosen/unchosen capabilities in the future for our process-oriented
            verification.

            --MBS, 11/13/18

             */

    // event handler for clicking individual stations
    $(divId)[0].on("plotly_click", function (eventdata) {
      // get index of current station
      const currPoint = eventdata.points[0].pointNumber;
      if (dataset.marker.color[currPoint] === thisMarkers[currPoint].options.color) {
        // switch to selected color and add this station to our selected values array
        dataset.marker.color[currPoint] = thisMarkers[currPoint].options.highLightColor;
        selectedValues.push(eventdata.points[0].text);
      } else {
        // switch to deselected color and remove this station from our selected values array
        dataset.marker.color[currPoint] = thisMarkers[currPoint].options.color;
        const tidx = selectedValues.indexOf(eventdata.points[0].text);
        if (tidx > -1) {
          selectedValues.splice(tidx, 1);
        }
      }
      // update the marker color on the plot and the values in the site selector
      const update = { marker: { color: dataset.marker.color, opacity: 1 } };
      Plotly.restyle($(divId)[0], update, eventdata.points[0].curveNumber);
      $(targetId).val(selectedValues).trigger("change");
      matsParamUtils.collapseParam(peerName);
      $(targetId).select2("close");
    });

    // event handler for outlining multiple stations
    $(divId)[0].on("plotly_selected", function (eventdata) {
      if (eventdata === undefined || eventdata.points.length < 1) {
        // the user has clicked outside of the select area, so make sure plotly's area select is disabled.
        // otherwise the user won't be able to choose individual stations after choosing an area select
        $(`${divId} .select-outline`).remove();
        Plotly.restyle($(divId)[0], { selectedpoints: [null] });
      } else {
        // the user has selected all the points in an area. Iterate through them and select any that are not already selected.
        let currPoint;
        eventdata.points.forEach(function (pt) {
          currPoint = pt.pointNumber;
          if (
            dataset.marker.color[currPoint] === thisMarkers[currPoint].options.color
          ) {
            // switch to selected color and add this station to our selected values array
            dataset.marker.color[currPoint] =
              thisMarkers[currPoint].options.highLightColor;
            selectedValues.push(pt.text);
          }
        });
        // update the marker color on the plot and the values in the site selector
        const update = { marker: { color: dataset.marker.color, opacity: 1 } };
        Plotly.restyle($(divId)[0], update, eventdata.points[0].curveNumber);
        $(targetId).val(selectedValues).trigger("change");
        matsParamUtils.collapseParam(peerName);
        $(targetId).select2("close");

        // As per the comment block above, we're done here, so make sure plotly's area select is disabled.
        // otherwise the user won't be able to choose individual stations after choosing an area select.
        $(`${divId} .select-outline`).remove();
        Plotly.restyle($(divId)[0], { selectedpoints: [null] });
      }
    });

    // event handler for selecting all stations
    $(".selectSites").on("click", function (event) {
      event.preventDefault();
      // fill the selected values array with all available options and change the marker to its highlight color
      $(targetId).val(peerOptions).trigger("change");
      matsParamUtils.collapseParam(peerName);
      $(targetId).select2("close");
      for (let sidx = 0; sidx < thisMarkers.length; sidx += 1) {
        dataset.marker.color[sidx] = thisMarkers[sidx].options.highLightColor;
      }
      const update = { marker: { color: dataset.marker.color, opacity: 1 } };
      Plotly.restyle($(divId)[0], update, [0]);
    });

    // event handler for deselecting all stations
    $(".deselectSites").on("click", function (event) {
      event.preventDefault();
      // empty the selected values array and return the marker to its original color
      $(targetId).val([]).trigger("change");
      matsParamUtils.collapseParam(peerName);
      $(targetId).select2("close");
      for (let sidx = 0; sidx < thisMarkers.length; sidx += 1) {
        dataset.marker.color[sidx] = thisMarkers[sidx].options.color;
      }
      const update = { marker: { color: dataset.marker.color, opacity: 1 } };
      Plotly.restyle($(divId)[0], update, [0]);
    });

    // method to see if the available sites have changed for this data source
    const refreshOptionsForPeer = function (peerElement) {
      // find out what peer options are available
      const thesePeerOptions = [];
      if (peerElement.options) {
        for (let i = 0; i < peerElement.options.length; i += 1) {
          thesePeerOptions.push(peerElement.options[i].text);
        }
      }
      peerOptions = thesePeerOptions;
    };

    // method to sync the map up with the sites selector
    const refresh = function (peerElement) {
      if (!peerElement) {
        return;
      }
      const thesePeerOptions = peerOptions;
      const peerId = peerElement.id;
      refreshOptionsForPeer(peerElement);
      selectedValues = $(`#${peerId}`).val() ? $(`#${peerId}`).val() : [];

      // need to redo these in case the available sites have changed for this data source
      thisMarkers = [];
      dataset.siteName = [];
      dataset.text = [];
      dataset.lat = [];
      dataset.lon = [];
      dataset.marker.color = [];
      let marker;
      for (let sidx = 0; sidx < thesePeerOptions.length; sidx += 1) {
        marker = markers.find((obj) => obj.name === thesePeerOptions[sidx]);
        thisMarkers[sidx] = marker;
        dataset.siteName[sidx] = marker.name;
        dataset.text[sidx] = marker.name;
        [dataset.lat[sidx]] = marker.point;
        [, dataset.lon[sidx]] = marker.point;
        if (selectedValues.indexOf(marker.name) === -1) {
          dataset.marker.color[sidx] = marker.options.color;
        } else {
          dataset.marker.color[sidx] = marker.options.highLightColor;
        }
      }
      $(divId)[0].data[0] = dataset;
      Plotly.redraw($(divId)[0]);
    };

    // method to reset the map to defaults
    const resetMap = function (item) {
      initializeSelectorMap(item);
      $(divId)[0].data[0] = dataset;
      $(divId)[0].layout = layout;
      Plotly.redraw($(divId)[0]);
    };

    // register an event listener so that the select.js can ask the map div to refresh after a selection
    let elem = document.getElementById(divElement);
    elem.addEventListener("refresh", function () {
      refresh(targetElement);
    });

    // register an event listener so that the param_util.js can ask the map div to reset when someone clicks 'reset to defaults'
    elem = document.getElementById(divElement);
    elem.addEventListener("reset", function () {
      resetMap(defaultAttrs);
    });
  });
});
