/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global cbPool, Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";

class MatsMiddleMap {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  statType = null;

  varName = null;

  stationNamesFull = null;

  model = null;

  fcstLen = null;

  threshold = null;

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
    fromSecs,
    toSecs,
    validTimes,
    filterInfo
  ) => {
    const fs = require("fs");

    this.statType = statType;
    this.varName = varName;
    this.stationNamesFull = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
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

    for (let iofve = 0; iofve < this.stationNamesFull.length; iofve += 100) {
      const stationNamesSlice = this.stationNamesFull.slice(iofve, iofve + 100);
      const prObs = this.createObsData(stationNamesSlice);
      const prModel = this.createModelData(stationNamesSlice);
      await Promise.all([prObs, prModel]);
      if (statType === "ctc") {
        this.generateCtc(threshold, stationNamesSlice);
      } else {
        this.generateSums(stationNamesSlice);
      }
    }

    this.fveObs = {};
    this.fveModels = {};

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

  createObsData = async (stationNamesSlice) => {
    const fs = require("fs");

    this.fveObs = {};

    const tmplGetNStationsMfveObs = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql"
    );

    let stationNamesObs = "";
    for (let i = 0; i < stationNamesSlice.length; i += 1) {
      if (i === 0) {
        if (this.filterInfo.filterObsBy) {
          stationNamesObs = `CASE WHEN obs.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterObsBy}\` >= ${this.filterInfo.filterObsMin} AND obs.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterObsBy}\` <= ${this.filterInfo.filterObsMax} THEN obs.data.${stationNamesSlice[i]}.\`${this.varName}\` ELSE "NULL" END ${stationNamesSlice[i]}`;
        } else {
          stationNamesObs = `obs.data.${stationNamesSlice[i]}.\`${this.varName}\` ${stationNamesSlice[i]}`;
        }
      } else if (this.filterInfo.filterObsBy) {
        stationNamesObs += `, CASE WHEN obs.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterObsBy}\` >= ${this.filterInfo.filterObsMin} AND obs.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterObsBy}\` <= ${this.filterInfo.filterObsMax} THEN obs.data.${stationNamesSlice[i]}.\`${this.varName}\` ELSE "NULL" END ${stationNamesSlice[i]}`;
      } else {
        stationNamesObs += `, obs.data.${stationNamesSlice[i]}.\`${this.varName}\` ${stationNamesSlice[i]}`;
      }
    }
    let tmplWithStationNamesObs = this.cbPool.trfmSQLRemoveClause(
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
          for (let i = 0; i < stationNamesSlice.length; i += 1) {
            if (!this.fveObs[stationNamesSlice[i]]) {
              this.fveObs[stationNamesSlice[i]] = {};
              this.fveObs[stationNamesSlice[i]][fveDataSingleEpoch.fve] = {};
            }
            const varValStation =
              fveDataSingleEpoch[stationNamesSlice[i]] === "NULL"
                ? null
                : fveDataSingleEpoch[stationNamesSlice[i]];

            this.fveObs[stationNamesSlice[i]][fveDataSingleEpoch.fve] = varValStation;
          }
        }
      });
    }

    await Promise.all(promises);
  };

  createModelData = async (stationNamesSlice) => {
    const fs = require("fs");

    this.fveModels = {};

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
    for (let i = 0; i < stationNamesSlice.length; i += 1) {
      if (i === 0) {
        if (this.filterInfo.filterModelBy) {
          stationNamesModels = `CASE WHEN models.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${stationNamesSlice[i]}.\`${this.varName}\` ELSE "NULL" END ${stationNamesSlice[i]}`;
        } else {
          stationNamesModels = `models.data.${stationNamesSlice[i]}.\`${this.varName}\` ${stationNamesSlice[i]}`;
        }
      } else if (this.filterInfo.filterModelBy) {
        stationNamesModels += `, CASE WHEN models.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${stationNamesSlice[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${stationNamesSlice[i]}.\`${this.varName}\` ELSE "NULL" END ${stationNamesSlice[i]}`;
      } else {
        stationNamesModels += `, models.data.${stationNamesSlice[i]}.\`${this.varName}\` ${stationNamesSlice[i]}`;
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
          for (let i = 0; i < stationNamesSlice.length; i += 1) {
            if (!this.fveModels[stationNamesSlice[i]]) {
              this.fveModels[stationNamesSlice[i]] = {};
              this.fveModels[stationNamesSlice[i]][fveDataSingleEpoch.fve] = {};
            }
            const varValStation =
              fveDataSingleEpoch[stationNamesSlice[i]] === "NULL"
                ? null
                : fveDataSingleEpoch[stationNamesSlice[i]];

            this.fveModels[stationNamesSlice[i]][fveDataSingleEpoch.fve] =
              varValStation;
          }
        }
      });
    }
    await Promise.all(promises);
  };

  generateCtc = async (threshold, stationNamesSlice) => {
    for (let stni = 0; stni < stationNamesSlice.length; stni += 1) {
      const stn = stationNamesSlice[stni];
      const stnObs = this.fveObs[stn];
      const stnModel = this.fveModels[stn];

      if (stnObs && stnModel) {
        const ctcFve = {};
        ctcFve.sta_id = stn;
        ctcFve.hit = 0;
        ctcFve.miss = 0;
        ctcFve.fa = 0;
        ctcFve.cn = 0;
        ctcFve.n0 = 0;
        ctcFve.nTimes = 0;
        ctcFve.sub_data = [];
        [ctcFve.min_secs] = this.fcstValidEpoch_Array;
        ctcFve.max_secs =
          this.fcstValidEpoch_Array[this.fcstValidEpoch_Array.length - 1];

        for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 1) {
          const fve = this.fcstValidEpoch_Array[imfve];

          const varValO = stnObs[fve];
          const varValM = stnModel[fve];

          if (
            varValO &&
            varValM &&
            (!this.validTimes ||
              this.validTimes.length === 0 ||
              (this.validTimes &&
                this.validTimes.length > 0 &&
                this.validTimes.includes((fve % (24 * 3600)) / 3600)))
          ) {
            ctcFve.n0 += 1;
            ctcFve.nTimes += 1;

            let sub = `${fve};`;
            if (varValO < threshold && varValM < threshold) {
              ctcFve.hit += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varValO >= threshold && varValM < threshold) {
              ctcFve.fa += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varValO < threshold && varValM >= threshold) {
              ctcFve.miss += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varValO >= threshold && varValM >= threshold) {
              ctcFve.cn += 1;
              sub += "1";
            } else {
              sub += "0";
            }
            // stats_fve.sub_data.push(sub);
          }
        }
        if (ctcFve.n0 > 0) {
          const sub = `${this.fcstValidEpoch_Array[0]};${ctcFve.hit};${ctcFve.fa};${ctcFve.miss};${ctcFve.cn}`;
          ctcFve.sub_data.push(sub);
          this.stats.push(ctcFve);
        }
      }
    }
  };

  generateSums = async (stationNamesSlice) => {
    for (let stni = 0; stni < stationNamesSlice.length; stni += 1) {
      const stn = stationNamesSlice[stni];
      const stnObs = this.fveObs[stn];
      const stnModel = this.fveModels[stn];

      if (stnObs && stnModel) {
        const sumsFve = {};
        sumsFve.sta_id = stn;
        sumsFve.square_diff_sum = 0;
        sumsFve.N_sum = 0;
        sumsFve.obs_model_diff_sum = 0;
        sumsFve.model_sum = 0;
        sumsFve.obs_sum = 0;
        sumsFve.abs_sum = 0;
        sumsFve.n0 = 0;
        sumsFve.nTimes = 0;
        sumsFve.sub_data = [];
        [sumsFve.min_secs] = this.fcstValidEpoch_Array;
        sumsFve.max_secs =
          this.fcstValidEpoch_Array[this.fcstValidEpoch_Array.length - 1];

        for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 1) {
          const fve = this.fcstValidEpoch_Array[imfve];

          const varValO = stnObs[fve];
          const varValM = stnModel[fve];

          if (
            varValO &&
            varValM &&
            (!this.validTimes ||
              this.validTimes.length === 0 ||
              (this.validTimes &&
                this.validTimes.length > 0 &&
                this.validTimes.includes((fve % (24 * 3600)) / 3600)))
          ) {
            sumsFve.n0 += 1;
            sumsFve.nTimes += 1;

            if (varValO && varValM) {
              sumsFve.square_diff_sum += (varValO - varValM) ** 2;
              sumsFve.N_sum += 1;
              sumsFve.obs_model_diff_sum += varValO - varValM;
              sumsFve.model_sum += varValM;
              sumsFve.obs_sum += varValO;
              sumsFve.abs_sum += Math.abs(varValO - varValM);
            }
          }
        }
        if (sumsFve.n0 > 0) {
          const sub = `${this.fcstValidEpoch_Array[0]};${sumsFve.square_diff_sum};${sumsFve.N_sum};${sumsFve.obs_model_diff_sum};${sumsFve.model_sum};${sumsFve.obs_sum};${sumsFve.abs_sum}`;
          sumsFve.sub_data.push(sub);
          this.stats.push(sumsFve);
        }
      }
    }
  };
}

export default matsMiddleMap = {
  MatsMiddleMap,
};
