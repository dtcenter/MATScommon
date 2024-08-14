/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

import { matsCollections, matsTypes } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";
import { moment } from "meteor/momentjs:moment";
import { _ } from "meteor/underscore";

// sets plot options for timeseries plots
const generateSeriesPlotOptions = function (axisMap, errorMax) {
  let { xmin } = axisMap[Object.keys(axisMap)[0]];
  let { xmax } = axisMap[Object.keys(axisMap)[0]];
  const yAxisNumber = Object.keys(axisMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Time",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 16,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    xmin = axisMap[axisKey].xmin < xmin ? axisMap[axisKey].xmin : xmin;
    xmax = axisMap[axisKey].xmax > xmax ? axisMap[axisKey].xmax : xmax;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      // tickformat: ".3r",
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax = moment
    .utc(xmax + xPad * Math.ceil(yAxisNumber / 2))
    .format("YYYY-MM-DD HH:mm");
  xmin = moment
    .utc(xmin - xPad * Math.ceil(yAxisNumber / 2))
    .format("YYYY-MM-DD HH:mm");
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for profile plots
const generateProfilePlotOptions = function (axisMap, errorMax) {
  let { ymin } = axisMap[Object.keys(axisMap)[0]];
  let { ymax } = axisMap[Object.keys(axisMap)[0]];
  const xAxisNumber = Object.keys(axisMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: xAxisNumber > 1 ? 80 : 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // y-axis options
  let tickVals;
  if (matsCollections.Settings.findOne({}).appType === matsTypes.AppTypes.metexpress) {
    tickVals = [1000, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100, 50, 10];
  } else {
    tickVals = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];
  }
  const tickText = tickVals.map(String);
  layout.yaxis = {
    title: "Pressure Level (hPa)",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: tickVals,
    ticktext: tickText,
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    type: "linear",
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple x-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "bottom",
    1: "top",
    2: "bottom",
    3: "top",
    4: "bottom",
    5: "top",
    6: "bottom",
    7: "top",
  };
  const axisPosition = {
    0: 0,
    1: 1,
    2: 0.15,
    3: 0.85,
    4: 0.3,
    5: 0.7,
    6: 0.45,
    7: 0.55,
  };

  // loop over all x-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < xAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this x-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { xmin } = axisMap[axisKey];
    let { xmax } = axisMap[axisKey];
    xmax += errorMax;
    xmin -= errorMax;
    const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [xmin - xPad, xmax + xPad],
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) x-axis
      axisObjectKey = "xaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent x-axes, up to the 8 we support
      axisObjectKey = `xaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "x";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 x-axes, just shove them all into the position of the 8th
      axisObjectKey = `xaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "x";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
  ymax += yPad * Math.ceil(xAxisNumber / 2);
  ymin -= yPad * Math.ceil(xAxisNumber / 2) * 0.05;
  layout.yaxis.range = [ymax, ymin];
  return layout;
};

// sets plot options for dieoff plots
const generateDieoffPlotOptions = function (axisMap, errorMax) {
  let { xmin } = axisMap[Object.keys(axisMap)[0]];
  let { xmax } = axisMap[Object.keys(axisMap)[0]];
  const yAxisNumber = Object.keys(axisMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // people want the axis tick for fhr to be displayed in multiples of three
  let dtick;
  if (xmax < 50) {
    dtick = 3;
  } else if (xmax < 122) {
    dtick = 6;
  } else if (xmax < 194) {
    dtick = 12;
  } else {
    dtick = 24;
  }

  // x-axis options
  layout.xaxis = {
    title: "Forecast Hour",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    dtick,
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    xmin = axisMap[axisKey].xmin < xmin ? axisMap[axisKey].xmin : xmin;
    xmax = axisMap[axisKey].xmax > xmax ? axisMap[axisKey].xmax : xmax;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax += xPad * Math.ceil(yAxisNumber / 2);
  xmin -= xPad * Math.ceil(yAxisNumber / 2);
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for threshold plots
const generateThresholdPlotOptions = function (dataset, axisMap, errorMax) {
  let { xmin } = axisMap[Object.keys(axisMap)[0]];
  let { xmax } = axisMap[Object.keys(axisMap)[0]];
  const yAxisNumber = Object.keys(axisMap).length;

  // get actual thresholds from the query to place on the x-axis.
  // also deal with x-axis labels
  let xLabel = "";
  let xUnits;
  let tickvals = [];
  for (let didx = 0; didx < dataset.length; didx += 1) {
    xUnits = dataset[didx].thresholdAxisLabel;
    if (!xLabel.includes(xUnits) && xUnits !== undefined) {
      xLabel = xLabel.length === 0 ? xUnits : `${xLabel},${xUnits}`;
    }
    tickvals = _.union(tickvals, dataset[didx].x);
  }
  xLabel = xLabel.length === 0 ? "Threshold" : `Threshold (${xLabel})`;
  tickvals = tickvals.sort(function (a, b) {
    return a - b;
  });

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: xLabel,
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals,
    ticktext: tickvals.map(String),
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    xmin = axisMap[axisKey].xmin < xmin ? axisMap[axisKey].xmin : xmin;
    xmax = axisMap[axisKey].xmax > xmax ? axisMap[axisKey].xmax : xmax;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax += xPad * Math.ceil(yAxisNumber / 2);
  xmin -= xPad * Math.ceil(yAxisNumber / 2);
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for valid time plots
const generateValidTimePlotOptions = function (axisMap, errorMax) {
  let xmin = 0;
  let xmax = 23;
  const yAxisNumber = Object.keys(axisMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Hour of Day",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 16,
      color: "#000000",
    },
    tickvals: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
      23,
    ],
    ticktext: [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax += xPad * Math.ceil(yAxisNumber / 2);
  xmin -= xPad * Math.ceil(yAxisNumber / 2);
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for grid scale plots
const generateGridScalePlotOptions = function (axisMap, errorMax) {
  let { xmin } = axisMap[Object.keys(axisMap)[0]];
  let { xmax } = axisMap[Object.keys(axisMap)[0]];
  const yAxisNumber = Object.keys(axisMap).length;

  const { appName } = matsCollections.Settings.findOne({});
  let xLabel;
  if (appName.includes("met-")) {
    xLabel = "Interpolation Points";
  } else {
    xLabel = "Grid Scale";
  }

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: xLabel,
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    xmin = axisMap[axisKey].xmin < xmin ? axisMap[axisKey].xmin : xmin;
    xmax = axisMap[axisKey].xmax > xmax ? axisMap[axisKey].xmax : xmax;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax += xPad * Math.ceil(yAxisNumber / 2);
  xmin -= xPad * Math.ceil(yAxisNumber / 2);
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for grid scale plots
const generateYearToYearPlotOptions = function (axisMap, errorMax) {
  let { xmin } = axisMap[Object.keys(axisMap)[0]];
  let { xmax } = axisMap[Object.keys(axisMap)[0]];
  const yAxisNumber = Object.keys(axisMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  const tickVals = _.range(xmin, xmax + 1, 1);
  const tickText = tickVals.map(String);
  layout.xaxis = {
    title: "Year",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: tickVals,
    ticktext: tickText,
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all y-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisMap)[axisIdx];
    let { ymin } = axisMap[axisKey];
    let { ymax } = axisMap[axisKey];
    ymax += errorMax;
    ymin -= errorMax;
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    xmin = axisMap[axisKey].xmin < xmin ? axisMap[axisKey].xmin : xmin;
    xmax = axisMap[axisKey].xmax > xmax ? axisMap[axisKey].xmax : xmax;
    axisLabel = axisMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  xmax += xPad * Math.ceil(yAxisNumber / 2);
  xmin -= xPad * Math.ceil(yAxisNumber / 2);
  layout.xaxis.range = [xmin, xmax];
  return layout;
};

// sets plot options for reliability plots
const generateReliabilityPlotOptions = function () {
  const xmin = 0;
  const xmax = 1;
  const ymin = 0;
  const ymax = 1;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 80,
      pad: 4,
    },
    zeroline: true,
    perfectLine: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Forecast Probability",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [xmin, xmax],
  };

  // y-axis options
  layout.yaxis = {
    title: "Observed Relative Frequency",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [ymin, ymax],
  };

  return layout;
};

// sets plot options for ROC plots
const generateROCPlotOptions = function () {
  const xmin = 0;
  const xmax = 1;
  const ymin = 0;
  const ymax = 1;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 80,
      pad: 4,
    },
    zeroline: true,
    perfectLine: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Probability of False Detection",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [xmin, xmax],
  };

  // y-axis options
  layout.yaxis = {
    title: "Probability of Detection",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [ymin, ymax],
  };

  return layout;
};

// sets plot options for performance diagrams
const generatePerformanceDiagramPlotOptions = function () {
  const xmin = 0;
  const xmax = 1;
  const ymin = 0;
  const ymax = 1;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 80,
      pad: 4,
    },
    zeroline: true,
    perfectLine: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Success Ratio (1-FAR)",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [xmin, xmax],
  };

  // y-axis options
  layout.yaxis = {
    title: "Probability of Detection",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    tickvals: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    ticktext: [
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ],
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [ymin, ymax],
  };

  return layout;
};

// sets plot options for grid scale probability plots
const generateGridScaleProbPlotOptions = function (axisMap) {
  const { xmin } = axisMap[Object.keys(axisMap)[0]];
  const { xmax } = axisMap[Object.keys(axisMap)[0]];
  const { ymin } = axisMap[Object.keys(axisMap)[0]];
  const { ymax } = axisMap[Object.keys(axisMap)[0]];

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Probability Bin",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  // x-axis options
  layout.yaxis = {
    title: "Number of Grid Points",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    type: "log",
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    zeroline: false,
  };

  const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
  layout.xaxis.range = [xmin - xPad, xmax + xPad];
  const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
  const newYmax = Math.log10(ymax + yPad * 100);
  const newYmin =
    Number.isNaN(Math.log10(ymin - yPad)) || Math.log10(ymin - yPad) < 1
      ? 0
      : Math.log10(ymin - yPad);
  layout.yaxis.range = [newYmin, newYmax];
  return layout;
};

// sets plot options for map plots
const generateMapPlotOptions = function (extraLegendSpace) {
  const layout = {
    autosize: true,
    hovermode: "closest",
    mapbox: {
      bearing: 0,
      center: {
        lat: 50,
        lon: -92.5,
      },
      pitch: 0,
      zoom: 2,
      accesstoken:
        Meteor.settings.private && Meteor.settings.private.MAPBOX_KEY
          ? Meteor.settings.private.MAPBOX_KEY
          : "undefined",
      style: "light",
    },
    margin: {
      l: 30,
      r: 30,
      b: 40,
      t: 10,
      pad: 4,
    },
    legend: {
      orientation: "h",
      x: 0,
      y: extraLegendSpace ? 1.1 : 1.05,
      font: {
        size: 14,
        color: "#000000",
      },
    },
  };
  // make sure this instance of MATS actually has a key for mapbox
  if (!layout.mapbox.accesstoken || layout.mapbox.accesstoken === "undefined") {
    throw new Error(
      "The mapbox access token is currently undefined, so MATS cannot produce a map " +
        "plot at this time. To fix this, create an account at mapbox.com, " +
        "generate a free access token, and add it to your settings.json file as private.MAPBOX_KEY."
    );
  }
  return layout;
};

// sets plot options for histograms
const generateHistogramPlotOptions = function (curves, axisMap, varUnits, plotBins) {
  const { axisKey } = curves[0];
  const { axisLabel } = axisMap[axisKey];
  const { xmin } = axisMap[axisKey];
  const { xmax } = axisMap[axisKey];
  const xPad = ((xmax - xmin) / plotBins.binMeans.length) * 1.2;
  const { ymin } = axisMap[axisKey];
  const { ymax } = axisMap[axisKey];
  const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 100,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    bargap: 0.25,
    barmode: "group",
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    // put units on the x-axis if we have them
    title: varUnits !== undefined && varUnits.length > 0 ? `Bin (${varUnits})` : "Bin",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 14,
      color: "#000000",
    },
    tickvals: plotBins.binMeans,
    ticktext: plotBins.binLabels,
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [xmin - xPad, xmax + xPad],
  };

  // y-axis options
  layout.yaxis = {
    title: axisLabel,
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
  };

  return layout;
};

// sets plot options for histograms
const generateEnsembleHistogramPlotOptions = function (dataset, curves, axisMap) {
  const { axisKey } = curves[0];
  const { axisLabel } = axisMap[axisKey];
  const xmin = dataset[0].x[0];
  const xmax = dataset[0].x[dataset[0].x.length - 1];
  const xPad = ((xmax - xmin) / dataset[0].x.length) * 0.6;
  const { ymin } = axisMap[axisKey];
  const { ymax } = axisMap[axisKey];
  const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;

  // get actual bins from the query to place on the x-axis
  let tickvals = [];
  for (let didx = 0; didx < dataset.length; didx += 1) {
    tickvals = _.union(tickvals, dataset[didx].x);
  }
  tickvals = tickvals.sort(function (a, b) {
    return a - b;
  });

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    bargap: 0.25,
    barmode: "group",
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: "Bin",
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 14,
      color: "#000000",
    },
    tickvals,
    ticktext: tickvals.map(String),
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [xmin - xPad, xmax + xPad],
  };

  // y-axis options
  layout.yaxis = {
    title: axisLabel,
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    linecolor: "black",
    linewidth: 2,
    mirror: true,
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
    range: [ymin - yPad, ymax + 8 * yPad], // need to allow room at the top for the legend
  };

  return layout;
};

// sets plot options for contour plots
const generateContourPlotOptions = function (dataset) {
  const { xAxisKey } = dataset[0];
  const { yAxisKey } = dataset[0];
  const { xmin } = dataset[0];
  const { xmax } = dataset[0];
  const { ymin } = dataset[0];
  const { ymax } = dataset[0];

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.07,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // x-axis options
  layout.xaxis = {
    title: xAxisKey,
    titlefont: {
      size: 24,
      color: "#000000",
    },
    tickfont: {
      size: 18,
      color: "#000000",
    },
    showgrid: true,
    gridwidth: 1,
    gridcolor: "rgb(238,238,238)",
  };

  if (xAxisKey.indexOf("Date") > -1) {
    layout.xaxis.range = [
      moment.utc(xmin * 1000).format("YYYY-MM-DD HH:mm"),
      moment.utc(xmax * 1000).format("YYYY-MM-DD HH:mm"),
    ];
  } else if (xAxisKey.indexOf("Fcst lead time") > -1) {
    layout.xaxis.range = [
      Number(xmin.toString().replace(/0000/g, "")),
      Number(xmax.toString().replace(/0000/g, "")),
    ];
    // people want the axis tick for fhr to be displayed in multiples of three
    if (Number(xmax.toString().replace(/0000/g, "")) < 50) {
      layout.xaxis.dtick = 3;
    } else if (Number(xmax.toString().replace(/0000/g, "")) < 122) {
      layout.xaxis.dtick = 6;
    } else if (Number(xmax.toString().replace(/0000/g, "")) < 194) {
      layout.xaxis.dtick = 12;
    } else {
      layout.xaxis.dtick = 24;
    }
  } else {
    layout.xaxis.range = [xmin, xmax];
  }

  // y-axis options
  if (yAxisKey === "Pressure level") {
    layout.yaxis = {
      title: yAxisKey,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      tickvals: [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
      ticktext: ["1000", "900", "800", "700", "600", "500", "400", "300", "200", "100"],
      type: "linear",
      autorange: "reversed",
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
    };
  } else {
    layout.yaxis = {
      title: yAxisKey,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
    };
  }

  if (yAxisKey.indexOf("Date") > -1) {
    layout.yaxis.range = [
      moment.utc(ymin * 1000).format("YYYY-MM-DD HH:mm"),
      moment.utc(ymax * 1000).format("YYYY-MM-DD HH:mm"),
    ];
  } else if (yAxisKey.indexOf("Fcst lead time") > -1) {
    layout.yaxis.range = [
      Number(ymin.toString().replace(/0000/g, "")),
      Number(ymax.toString().replace(/0000/g, "")),
    ];
    // people want the axis tick for fhr to be displayed in multiples of three
    if (Number(ymax.toString().replace(/0000/g, "")) < 50) {
      layout.yaxis.dtick = 3;
    } else if (Number(ymax.toString().replace(/0000/g, "")) < 122) {
      layout.yaxis.dtick = 6;
    } else if (Number(ymax.toString().replace(/0000/g, "")) < 194) {
      layout.yaxis.dtick = 12;
    } else {
      layout.yaxis.dtick = 24;
    }
  } else {
    layout.yaxis.range = [ymin, ymax];
  }

  return layout;
};

// sets plot options for simple scatter plots
const generateScatterPlotOptions = function (axisXMap, axisYMap) {
  const xAxisNumber = Object.keys(axisXMap).length;
  const yAxisNumber = Object.keys(axisYMap).length;

  // overall plot options
  const layout = {
    margin: {
      l: 80,
      r: 80,
      b: 80,
      t: xAxisNumber > 1 ? 80 : 20,
      pad: 4,
    },
    zeroline: false,
    hovermode: "closest",
    hoverlabel: {
      font: {
        size: 16,
        color: "#FFFFFF",
      },
    },
    legend: {
      orientation: "h",
      x: 0,
      y: 1.1,
      font: {
        size: 12,
        color: "#000000",
      },
    },
  };

  // allow support for multiple y-axes (currently 8)
  const axisAnchor = {
    0: "x",
    1: "x",
    2: "free",
    3: "free",
    4: "free",
    5: "free",
    6: "free",
    7: "free",
  };
  const axisSide = {
    0: "left",
    1: "right",
    2: "left",
    3: "right",
    4: "left",
    5: "right",
    6: "left",
    7: "right",
  };
  const axisPosition = { 0: 0, 1: 1, 2: 0.1, 3: 0.9, 4: 0.2, 5: 0.8, 6: 0.3, 7: 0.7 };

  // loop over all x-axes
  let axisKey;
  let axisIdx;
  let axisLabel;
  for (axisIdx = 0; axisIdx < xAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this x-axis
    axisKey = Object.keys(axisXMap)[axisIdx];
    const { xmin } = axisXMap[axisKey];
    const { xmax } = axisXMap[axisKey];
    const xPad = (xmax - xmin) * 0.025 !== 0 ? (xmax - xmin) * 0.025 : 0.025;
    axisLabel = axisXMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [xmin - xPad, xmax + xPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) x-axis
      axisObjectKey = "xaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent x-axes, up to the 8 we support
      axisObjectKey = `xaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "x";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 x-axes, just shove them all into the position of the 8th
      axisObjectKey = `xaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "x";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }

  // loop over all y-axes
  for (axisIdx = 0; axisIdx < yAxisNumber; axisIdx += 1) {
    // get max and min values and label for curves on this y-axis
    axisKey = Object.keys(axisYMap)[axisIdx];
    const { ymin } = axisYMap[axisKey];
    const { ymax } = axisYMap[axisKey];
    const yPad = (ymax - ymin) * 0.025 !== 0 ? (ymax - ymin) * 0.025 : 0.025;
    axisLabel = axisYMap[axisKey].axisLabel;
    let axisObjectKey;
    const axisObjectBegin = {
      title: axisLabel,
      titlefont: {
        size: 24,
        color: "#000000",
      },
      tickfont: {
        size: 18,
        color: "#000000",
      },
      linecolor: "black",
      linewidth: 2,
      mirror: true,
      showgrid: true,
      gridwidth: 1,
      gridcolor: "rgb(238,238,238)",
      range: [ymin - yPad, ymax + yPad], // need to allow room at the top for the legend
      zeroline: false,
    };
    if (axisIdx === 0) {
      // the first (and main) y-axis
      axisObjectKey = "yaxis";
      layout[axisObjectKey] = axisObjectBegin;
    } else if (axisIdx < Object.keys(axisPosition).length) {
      // subsequent y-axes, up to the 8 we support
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[axisIdx];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[axisIdx];
      layout[axisObjectKey].position = axisPosition[axisIdx];
    } else {
      // if the user by some miracle wants more than 8 y-axes, just shove them all into the position of the 8th
      axisObjectKey = `yaxis${axisIdx + 1}`;
      layout[axisObjectKey] = axisObjectBegin;
      layout[axisObjectKey].anchor = axisAnchor[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].overlaying = "y";
      layout[axisObjectKey].side = axisSide[Object.keys(axisPosition).length - 1];
      layout[axisObjectKey].position =
        axisPosition[Object.keys(axisPosition).length - 1];
    }
  }
  return layout;
};

// eslint-disable-next-line no-undef
export default matsDataPlotOpsUtils = {
  generateSeriesPlotOptions,
  generateProfilePlotOptions,
  generateDieoffPlotOptions,
  generateThresholdPlotOptions,
  generateValidTimePlotOptions,
  generateGridScalePlotOptions,
  generateYearToYearPlotOptions,
  generateReliabilityPlotOptions,
  generateROCPlotOptions,
  generatePerformanceDiagramPlotOptions,
  generateGridScaleProbPlotOptions,
  generateMapPlotOptions,
  generateHistogramPlotOptions,
  generateEnsembleHistogramPlotOptions,
  generateContourPlotOptions,
  generateScatterPlotOptions,
};
