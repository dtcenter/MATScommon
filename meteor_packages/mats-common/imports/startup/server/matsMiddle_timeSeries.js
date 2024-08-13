/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global cbPool, Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleTimeSeries {
  logToFile = false;

  logMemUsage = false;

  avtime_Array = [];

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

  average = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

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
    average,
    fromSecs,
    toSecs,
    validTimes,
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
        average,
        fromSecs,
        toSecs,
        validTimes,
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
    average,
    fromSecs,
    toSecs,
    validTimes,
    filterInfo
  ) => {
    const fs = require("fs");

    this.statType = statType;
    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.average = average.replace(/m0./g, "");
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;
    if (validTimes.length !== 0 && validTimes !== matsTypes.InputTypes.unused) {
      this.validTimes = validTimes.map(function (vt) {
        return Number(vt);
      });
    }
    this.filterInfo = filterInfo;

    this.conn = await cbPool.getConnection();

    this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
      fromSecs,
      toSecs
    );

    // create distinct avtime array
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 1) {
      const ofve = this.fcstValidEpoch_Array[iofve];
      let avtime;
      if (this.average === "m0.fcstValidEpoch") {
        avtime = ofve;
      } else {
        const avgConst = Number(this.average.substring(5, this.average.indexOf("*")));
        avtime = Math.ceil(avgConst * Math.floor((ofve + avgConst / 2) / avgConst));
      }
      if (!this.avtime_Array.includes(avtime)) {
        this.avtime_Array.push(avtime);
      }
    }
    this.avtime_Array.sort((a, b) => a - b);

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
    let tmplWithStationNamesObs = tmplGetNStationsMfveObs.replace(
      /{{vxAVERAGE}}/g,
      this.average
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
          const { avtime } = fveDataSingleEpoch;
          const avtimeKey = avtime.toString();
          if (!this.fveObs[avtimeKey]) {
            this.fveObs[avtimeKey] = {};
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
          this.fveObs[avtimeKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
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
    tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
      /{{vxAVERAGE}}/g,
      this.average
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
          const { avtime } = fveDataSingleEpoch;
          const avtimeKey = avtime.toString();
          if (!this.fveModels[avtimeKey]) {
            this.fveModels[avtimeKey] = {};
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
          this.fveModels[avtimeKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
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
    const avtimesWithData = _.intersection(
      Object.keys(this.fveObs),
      Object.keys(this.fveModels)
    );

    for (let iavt = 0; iavt < avtimesWithData.length; iavt += 1) {
      const ctcAvtime = {};

      const avtime = avtimesWithData[iavt];
      const avtimeKey = avtime.toString();
      ctcAvtime.avtime = avtime;
      ctcAvtime.hit = 0;
      ctcAvtime.miss = 0;
      ctcAvtime.fa = 0;
      ctcAvtime.cn = 0;
      ctcAvtime.n0 = 0;
      ctcAvtime.sub_data = [];

      // get all the fve for this avtime
      const avtimeSingle = this.fveModels[avtimeKey];
      const fveArray = Object.keys(avtimeSingle);
      fveArray.sort();

      [ctcAvtime.min_secs] = fveArray;
      ctcAvtime.max_secs = fveArray[fveArray.length - 1];
      ctcAvtime.nTimes = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[avtimeKey][fve];
        const modelSingleFve = avtimeSingle[fve];

        if (
          obsSingleFve &&
          modelSingleFve &&
          (!this.validTimes ||
            this.validTimes.length === 0 ||
            (this.validTimes &&
              this.validTimes.length > 0 &&
              this.validTimes.includes((fve % (24 * 3600)) / 3600)))
        ) {
          this.mmCommon.computeCtcForStations(
            fve,
            threshold,
            ctcAvtime,
            this.stationNames,
            obsSingleFve,
            modelSingleFve
          );
        }
      }

      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpCtc(ctcAvtime);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };

  generateSums = () => {
    const avtimesWithData = _.intersection(
      Object.keys(this.fveObs),
      Object.keys(this.fveModels)
    );

    for (let iavt = 0; iavt < avtimesWithData.length; iavt += 1) {
      const sumsAvtime = {};

      const avtime = avtimesWithData[iavt];
      const avtimeKey = avtime.toString();
      sumsAvtime.avtime = avtime;
      sumsAvtime.square_diff_sum = 0;
      sumsAvtime.N_sum = 0;
      sumsAvtime.obs_model_diff_sum = 0;
      sumsAvtime.model_sum = 0;
      sumsAvtime.obs_sum = 0;
      sumsAvtime.abs_sum = 0;
      sumsAvtime.n0 = 0;
      sumsAvtime.sub_data = [];

      // get all the fve for this avtime
      const avtimeSingle = this.fveModels[avtimeKey];
      const fveArray = Object.keys(avtimeSingle);
      fveArray.sort();

      [sumsAvtime.min_secs] = fveArray;
      sumsAvtime.max_secs = fveArray[fveArray.length - 1];
      sumsAvtime.nTimes = fveArray.length;
      for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
        const fve = fveArray[imfve];
        const obsSingleFve = this.fveObs[avtimeKey][fve];
        const modelSingleFve = avtimeSingle[fve];

        if (
          obsSingleFve &&
          modelSingleFve &&
          (!this.validTimes ||
            this.validTimes.length === 0 ||
            (this.validTimes &&
              this.validTimes.length > 0 &&
              this.validTimes.includes((fve % (24 * 3600)) / 3600)))
        ) {
          this.mmCommon.computeSumsForStations(
            fve,
            sumsAvtime,
            this.stationNames,
            obsSingleFve,
            modelSingleFve
          );
        }
      }

      try {
        const statsFcstLeadSummed = this.mmCommon.sumUpSums(sumsAvtime);
        this.stats.push(statsFcstLeadSummed);
      } catch (ex) {
        throw new Error(ex);
      }
    }
  };
}

export default matsMiddleTimeSeries = {
  MatsMiddleTimeSeries,
};
