/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global cbPool, Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleValidTime {
  logToFile = false;

  logMemUsage = false;

  hrOfDay_Array = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  statType = null;

  varName = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  fromSecs = null;

  toSecs = null;

  filterInfo = {};

  writeOutput = false;

  mmCommon = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
    this.mmCommon = new matsMiddleCommon.MatsMiddleCommon(cbPool);
  }

  processStationQuery = (
    statType,
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    fromSecs,
    toSecs,
    filterInfo
  ) => {
    const Future = require("fibers/future");

    let rv = [];
    const dFuture = new Future();
    (async () => {
      rv = await this.processStationQuery_int(
        statType,
        varName,
        stationNames,
        model,
        fcstLen,
        threshold,
        fromSecs,
        toSecs,
        filterInfo
      );
      dFuture.return();
    })();
    dFuture.wait();
    return rv;
  };

  processStationQuery_int = async (
    statType,
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    fromSecs,
    toSecs,
    filterInfo
  ) => {
    const fs = require("fs");

    this.statType = statType;
    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;
    this.filterInfo = filterInfo;

    this.conn = await cbPool.getConnection();

    this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
      fromSecs,
      toSecs
    );

    // create distinct hour of day array
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 1) {
      const ofve = this.fcstValidEpoch_Array[iofve];
      const hod = (ofve % (24 * 3600)) / 3600;
      if (!this.hrOfDay_Array.includes(hod)) {
        this.hrOfDay_Array.push(hod);
      }
    }
    this.hrOfDay_Array.sort((a, b) => a - b);

    await this.createObsData();
    await this.createModelData();

    if (this.logToFile === true) {
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/fveObs.json",
        JSON.stringify(this.fveObs, null, 2)
      );
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/fveModels.json",
        JSON.stringify(this.fveModels, null, 2)
      );
      this.mmCommon.writeToLocalFile(
        "/scratch/matsMiddle/output/stats.json",
        JSON.stringify(this.stats, null, 2)
      );
    }

    return this.stats;
  };

  createObsData = async () => {
    const fs = require("fs");

    const tmplGetNStationsMfveObs = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql"
    );

    let stationNamesObs = "";
    for (let i = 0; i < this.stationNames.length; i += 1) {
      if (i === 0) {
        if (this.filterInfo.filterObsBy) {
          stationNamesObs = `CASE WHEN obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\` >= ${this.filterInfo.filterObsMin} AND obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\` <= ${this.filterInfo.filterObsMax} THEN obs.data.${this.stationNames[i]}.\`${this.varName}\` ELSE "NULL" END ${this.stationNames[i]}`;
        } else {
          stationNamesObs = `obs.data.${this.stationNames[i]}.\`${this.varName}\` ${this.stationNames[i]}`;
        }
      } else if (this.filterInfo.filterObsBy) {
        stationNamesObs += `, CASE WHEN obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\` >= ${this.filterInfo.filterObsMin} AND obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\` <= ${this.filterInfo.filterObsMax} THEN obs.data.${this.stationNames[i]}.\`${this.varName}\` ELSE "NULL" END ${this.stationNames[i]}`;
      } else {
        stationNamesObs += `, obs.data.${this.stationNames[i]}.\`${this.varName}\` ${this.stationNames[i]}`;
      }
    }
    let tmplWithStationNamesObs = cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveObs,
      "{{vxAVERAGE}}"
    );
    tmplWithStationNamesObs = tmplWithStationNamesObs.replace(
      /{{stationNamesList}}/g,
      stationNamesObs
    );

    const promises = [];
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(iofve, iofve + 100);
      const sql = tmplWithStationNamesObs.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && iofve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);
      promises.push(prSlice);
      prSlice.then((qr) => {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const hod = (fveDataSingleEpoch.fve % (24 * 3600)) / 3600;
          const hodKey = hod.toString();
          if (!this.fveObs[hodKey]) {
            this.fveObs[hodKey] = {};
          }
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation =
              fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                ? null
                : fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.fcst = fveDataSingleEpoch.fcst;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveObs[hodKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
      });
    }

    await Promise.all(promises);
  };

  createModelData = async () => {
    const fs = require("fs");

    let tmplGetNStationsMfveModel = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "fcstLen fcst_lead"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "{{vxFCST_LEN_ARRAY}}"
    );
    tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
      tmplGetNStationsMfveModel,
      "{{vxAVERAGE}}"
    );

    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );
    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /{{vxFCST_LEN}}/g,
      this.fcstLen
    );

    let stationNamesModels = "";
    for (let i = 0; i < this.stationNames.length; i += 1) {
      if (i === 0) {
        if (this.filterInfo.filterModelBy) {
          stationNamesModels = `CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varName}\` ELSE "NULL" END ${this.stationNames[i]}`;
        } else {
          stationNamesModels = `models.data.${this.stationNames[i]}.\`${this.varName}\` ${this.stationNames[i]}`;
        }
      } else if (this.filterInfo.filterModelBy) {
        stationNamesModels += `, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varName}\` ELSE "NULL" END ${this.stationNames[i]}`;
      } else {
        stationNamesModels += `, models.data.${this.stationNames[i]}.\`${this.varName}\` ${this.stationNames[i]}`;
      }
    }

    const tmplWithStationNamesModels = tmplGetNStationsMfveModel.replace(
      /{{stationNamesList}}/g,
      stationNamesModels
    );

    const promises = [];
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
      const sql = tmplWithStationNamesModels.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && imfve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);

      promises.push(prSlice);
      prSlice.then((qr) => {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve += 1) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const hod = (fveDataSingleEpoch.fve % (24 * 3600)) / 3600;
          const hodKey = hod.toString();
          if (!this.fveModels[hodKey]) {
            this.fveModels[hodKey] = {};
          }
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation =
              fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                ? null
                : fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveModels[hodKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
      });
    }
    await Promise.all(promises);
    if (this.statType === "ctc") {
      this.generateCtc();
    } else {
      this.generateSums();
    }
  };

  generateCtc = () => {
    const { threshold } = this;
    const hodsWithData = _.intersection(
      Object.keys(this.fveObs),
      Object.keys(this.fveModels)
    );

    for (let ihod = 0; ihod < hodsWithData.length; ihod += 1) {
      const ctcHod = {};

      const hod = hodsWithData[ihod];
      const hodKey = hod.toString();
      ctcHod.hr_of_day = hod;
      ctcHod.hit = 0;
      ctcHod.miss = 0;
      ctcHod.fa = 0;
      ctcHod.cn = 0;
      ctcHod.N0 = 0;
      ctcHod.sub_data = [];

      // get all the fve for this hod
      const hodSingle = this.fveModels[hodKey];
      const fveArray = Object.keys(hodSingle);
      fveArray.sort();

      [ctcHod.min_secs] = fveArray;
      ctcHod.max_secs = fveArray[fveArray.length - 1];
      ctcHod.N_times = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[hodKey][fve];
        const modelSingleFve = hodSingle[fve];

        if (obsSingleFve && modelSingleFve) {
          this.mmCommon.computeCtcForStations(
            fve,
            threshold,
            ctcHod,
            this.stationNames,
            obsSingleFve,
            modelSingleFve
          );
        }
      }

      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpCtc(ctcHod);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };

  generateSums = () => {
    const hodsWithData = _.intersection(
      Object.keys(this.fveObs),
      Object.keys(this.fveModels)
    );

    for (let ihod = 0; ihod < hodsWithData.length; ihod += 1) {
      const sumsHod = {};

      const hod = hodsWithData[ihod];
      const hodKey = hod.toString();
      sumsHod.hr_of_day = hod;
      sumsHod.square_diff_sum = 0;
      sumsHod.N_sum = 0;
      sumsHod.obs_model_diff_sum = 0;
      sumsHod.model_sum = 0;
      sumsHod.obs_sum = 0;
      sumsHod.abs_sum = 0;
      sumsHod.N0 = 0;
      sumsHod.sub_data = [];

      // get all the fve for this hod
      const hodSingle = this.fveModels[hodKey];
      const fveArray = Object.keys(hodSingle);
      fveArray.sort();

      [sumsHod.min_secs] = fveArray;
      sumsHod.max_secs = fveArray[fveArray.length - 1];
      sumsHod.N_times = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[hodKey][fve];
        const modelSingleFve = hodSingle[fve];

        if (obsSingleFve && modelSingleFve) {
          this.mmCommon.computeSumsForStations(
            fve,
            sumsHod,
            this.stationNames,
            obsSingleFve,
            modelSingleFve
          );
        }
      }

      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpSums(sumsHod);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };
}

export default matsMiddleValidTime = {
  MatsMiddleValidTime,
};
