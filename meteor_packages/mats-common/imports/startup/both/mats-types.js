/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/**
 * Created by pierce on 8/31/16.
 */

const DEFAULT_GROUP_LIST = [
  "Upper Air",
  "Ceiling and Visibility",
  "Surface",
  "Precipitation",
  "Radar",
  "METexpress Upper Air",
  "METexpress Surface",
  "METexpress Precipitation",
  "METexpress Specialized",
  "Experimental",
];

const DatabaseRoles = {
  MODEL_DATA: "model_data",
  META_DATA: "meta_data",
  SUMS_DATA: "sums_data",
  SITE_DATA: "site_data",
  COUCHBASE: "couchbase",
};

const AppTypes = {
  mats: "mats",
  metexpress: "metexpress",
  mats4met: "mats4met",
};

const DbTypes = {
  couchbase: "couchbase",
  mysql: "mysql",
};

const ScorecardStatus = {
  pending: "Pending",
  running: "Running",
  ready: "Ready",
};

const InputTypes = {
  textInput: "textInput",
  color: "color",
  select: "select",
  selectOrderEnforced: "selectOrderEnforced",
  numberSpinner: "numberSpinner",
  dateRange: "dateRange",
  radioGroup: "radioGroup",
  checkBoxGroup: "checkBoxGroup",
  resetButton: "resetButton",
  controlButton: "controlButton",
  element: "element",
  selectMap: "selectMap",
  custom: "custom",
  unused: "unused",
  forecastSingleCycle: "forecasts single cycle",
  forecastMultiCycle: "forecasts multi cycle",
};

const PlotTypes = {
  timeSeries: "TimeSeries",
  profile: "Profile",
  dieoff: "Dieoff",
  threshold: "Threshold",
  validtime: "ValidTime",
  gridscale: "GridScale",
  dailyModelCycle: "DailyModelCycle",
  yearToYear: "YearToYear",
  reliability: "Reliability",
  roc: "ROC",
  performanceDiagram: "PerformanceDiagram",
  gridscaleProb: "GridScaleProbability",
  map: "Map",
  histogram: "Histogram",
  ensembleHistogram: "EnsembleHistogram",
  contour: "Contour",
  contourDiff: "ContourDiff",
  simpleScatter: "SimpleScatter",
  scatter2d: "Scatter2d",
  scorecard: "Scorecard",
};

const ForecastTypes = {
  dieoff: "dieoff",
  utcCycle: "utc cycle",
  singleCycle: "single cycle",
};

const PlotFormats = {
  none: "none",
  matching: "Diff all curves against the 1st added curve",
  pairwise: "Diff the 1st and 2nd curves, 3rd and 4th, etc",
};

const PlotActions = {
  matched: "matched",
  unmatched: "unmatched",
  scorecard: "scorecard",
};

const BestFits = {
  none: "none",
  linear: "linear",
  linearThroughOrigin: "linearThroughOrigin",
  exponential: "exponential",
  logarithmic: "logarithmic",
  power: "power",
};

const MatchFormats = {
  none: "none",
  time: "time",
  level: "level",
  site: "site",
};

const PlotAxisFilters = {
  none: "none",
  level: "level",
  site: "site",
};

const PlotView = {
  graph: "graph",
  textSeries: "text",
};

const ReservedWords = {
  Zero: "Zero",
  zero: "zero",
  ideal0: "ideal0",
  ideal1: "ideal1",
  ideal2: "ideal2",
  ideal3: "ideal3",
  ideal4: "ideal4",
  ideal5: "ideal5",
  ideal6: "ideal6",
  ideal7: "ideal7",
  ideal8: "ideal8",
  ideal9: "ideal9",
  perfectReliability: "Perfect Reliability",
  perfectForecast: "Perfect Forecast",
  noSkill: "No Skill",
  noSkillNoLabel: "No Skill No Label",
  constantBias: "Constant Bias",
  constantCSI: "Constant CSI",
  centerLine: "X=Y",
  blueCurveText: "Cold bias",
  blackCurveText: "Small bias",
  redCurveText: "Warm bias",
  CTCPurpleCurveText: "0-10th percentile of possible range",
  CTCPurpleBlueCurveText: "10-20th percentile of possible range",
  CTCBlueCurveText: "20-30th percentile of possible range",
  CTCBlueGreenCurveText: "30-40th percentile of possible range",
  CTCGreenCurveText: "40-50th percentile of possible range",
  CTCGreenYellowCurveText: "50-60th percentile of possible range",
  CTCYellowCurveText: "60-70th percentile of possible range",
  CTCOrangeCurveText: "70-80th percentile of possible range",
  CTCOrangeRedCurveText: "80-90th percentile of possible range",
  CTCRedCurveText: "90-100th percentile of possible range",
  ScalarLowestCurveText: "Lowest",
  ScalarLowCurveText: "Low",
  ScalarModerateCurveText: "Moderate",
  ScalarHighCurveText: "High",
  ScalarHighestCurveText: "Highest",
  contourSigLabel: "Curve1-Curve0 Significance",
};

const Messages = {
  NO_DATA_FOUND: "INFO:0 data records found",
};

/*
Class for holding metaData records. These are stored in an array. An app can have multiple metadata databases and each database has a pool for connections.
These pools are global (although for future reference the access might be from this collection.). They are refenced in this script via the pool name.
This class enforces the types of the poolName (in case someone accidentally tries to store the whole pool object), and the database name and a list
of table names. The internal list can be appended. The getRecords returns the internal list.
 */
class MetaDataDBRecord {
  constructor(poolName, dbName, tables) {
    if (!(typeof poolName === "string")) {
      throw new Error("MetaDataDBRecord.constructor : poolName is not a string");
    }
    if (!(typeof dbName === "string")) {
      throw new Error("MetaDataDBRecord.constructor : dbName is not a string");
    }
    if (!(tables instanceof Array)) {
      throw new Error("MetaDataDBRecord.constructor : tables is not an array");
    }
    this.records = [];
    const record = { pool: poolName, name: dbName, tables };
    this.records.push(record);
  }

  addRecord(poolName, dbName, tables) {
    if (!(typeof poolName === "string")) {
      throw new Error("MetaDataDBRecord.constructor : poolName is not a string");
    }
    if (!(typeof dbName === "string")) {
      throw new Error("MetaDataDBRecord.constructor : dbName is not a string");
    }
    if (!(tables instanceof Array)) {
      throw new Error("MetaDataDBRecord.constructor : tables is not an array");
    }
    const record = { pool: poolName, name: dbName, tables };
    this.records.push(record);
  }

  getRecords() {
    return this.records;
  }
}

// eslint-disable-next-line no-undef
export default matsTypes = {
  InputTypes,
  ScorecardStatus,
  PlotTypes,
  PlotFormats,
  PlotActions,
  BestFits,
  MatchFormats,
  PlotAxisFilters,
  PlotView,
  Messages,
  ForecastTypes,
  ReservedWords,
  MetaDataDBRecord,
  AppTypes,
  DbTypes,
  DatabaseRoles,
  DEFAULT_GROUP_LIST,
};
