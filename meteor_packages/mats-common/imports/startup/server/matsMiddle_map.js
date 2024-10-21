/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";

class MatsMiddleMap {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpochArray = [];

  indVarArray = [];

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

  validTimes = [];

  filterInfo = {};

  writeOutput = false;

  mmCommon = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
    this.mmCommon = new matsMiddleCommon.MatsMiddleCommon(cbPool);
  }

  /* eslint-disable global-require */
  /* eslint-disable no-console */
  /* eslint-disable class-methods-use-this */

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
    let rv = "";
    const dFuture = new Future();
    (async () => {
      rv = await this.processStationQueryInt(
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
    })().catch((err) => {
      console.log(`MatsMiddleMap.processStationQuery ERROR: ${err.message}`);
      rv = `MatsMiddleMap.processStationQuery ERROR: ${err.message}`;
      dFuture.return();
    });
    dFuture.wait();
    return rv;
  };

  processStationQueryInt = async (
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
    try {
      this.statType = statType;
      this.varName = varName;
      this.stationNames = stationNames;
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

      this.conn = await this.cbPool.getConnection();

      this.fcstValidEpochArray = await this.mmCommon.getFcstValidEpochArray(
        fromSecs,
        toSecs
      );

      // create distinct indVar array
      for (let iofve = 0; iofve < this.stationNames.length; iofve += 100) {
        const stationNamesSlice = this.stationNames.slice(iofve, iofve + 100);

        await this.createObsData(stationNamesSlice);
        await this.createModelData(stationNamesSlice);
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
    } catch (err) {
      console.log(`MatsMiddleMap.processStationQueryInt ERROR: ${err.message}`);
      throw new Error(`MatsMiddleMap.processStationQueryInt ERROR: ${err.message}`);
    }
  };

  createObsData = async (stationNamesSlice) => {
    try {
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
      for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 100) {
        const fveArraySlice = this.fcstValidEpochArray.slice(iofve, iofve + 100);
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

      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
    } catch (err) {
      console.log(`MatsMiddleMap.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleMap.createObsData ERROR: ${err.message}`);
    }
  };

  createModelData = async (stationNamesSlice) => {
    try {
      this.fveModels = {};

      let tmplGetNStationsMfveModel = Assets.getText(
        "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql"
      );
      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "{{vxAVERAGE}}"
      );
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{vxMODEL}}/g,
        `"${this.model}"`
      );
      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "fcstLen fcst_lead"
      );
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /{{vxFCST_LEN}}/g,
        this.fcstLen
      );
      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "{{vxFCST_LEN_ARRAY}}"
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
      for (let imfve = 0; imfve < this.fcstValidEpochArray.length; imfve += 100) {
        const fveArraySlice = this.fcstValidEpochArray.slice(imfve, imfve + 100);
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
      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });

      if (this.statType === "ctc") {
        this.generateCtc(stationNamesSlice);
      } else {
        this.generateSums(stationNamesSlice);
      }
    } catch (err) {
      console.log(`MatsMiddleMap.createModelData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleMap.createModelData ERROR: ${err.message}`);
    }
  };

  generateCtc = (stationNamesSlice) => {
    try {
      const threshold = Number(this.threshold);

      for (let idx = 0; idx < stationNamesSlice.length; idx += 1) {
        const indVar = stationNamesSlice[idx];
        const stnObs = this.fveObs[indVar];
        const stnModel = this.fveModels[indVar];

        if (stnObs && stnModel) {
          const ctcStats = {};
          ctcStats.sta_id = indVar;
          ctcStats.hit = 0;
          ctcStats.miss = 0;
          ctcStats.fa = 0;
          ctcStats.cn = 0;
          ctcStats.n0 = 0;
          ctcStats.nTimes = 0;
          ctcStats.sub_data = [];
          [ctcStats.min_secs] = this.fcstValidEpochArray;
          ctcStats.max_secs =
            this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1];

          for (let imfve = 0; imfve < this.fcstValidEpochArray.length; imfve += 1) {
            const fve = this.fcstValidEpochArray[imfve];

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
              ctcStats.n0 += 1;
              ctcStats.nTimes += 1;

              if (varValO < threshold && varValM < threshold) {
                ctcStats.hit += 1;
              }

              if (varValO >= threshold && varValM < threshold) {
                ctcStats.fa += 1;
              }

              if (varValO < threshold && varValM >= threshold) {
                ctcStats.miss += 1;
              }

              if (varValO >= threshold && varValM >= threshold) {
                ctcStats.cn += 1;
              }
            }
          }
          if (ctcStats.n0 > 0) {
            const sub = `${this.fcstValidEpochArray[0]};${ctcStats.hit};${ctcStats.fa};${ctcStats.miss};${ctcStats.cn}`;
            ctcStats.sub_data.push(sub);
            this.stats.push(ctcStats);
          }
        }
      }
    } catch (err) {
      console.log(`MatsMiddleMap.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleMap.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = (stationNamesSlice) => {
    try {
      for (let idx = 0; idx < stationNamesSlice.length; idx += 1) {
        const indVar = stationNamesSlice[idx];
        const stnObs = this.fveObs[indVar];
        const stnModel = this.fveModels[indVar];

        if (stnObs && stnModel) {
          const sumsStats = {};
          sumsStats.sta_id = indVar;
          sumsStats.square_diff_sum = 0;
          sumsStats.N_sum = 0;
          sumsStats.obs_model_diff_sum = 0;
          sumsStats.model_sum = 0;
          sumsStats.obs_sum = 0;
          sumsStats.abs_sum = 0;
          sumsStats.n0 = 0;
          sumsStats.nTimes = 0;
          sumsStats.sub_data = [];
          [sumsStats.min_secs] = this.fcstValidEpochArray;
          sumsStats.max_secs =
            this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1];

          for (let imfve = 0; imfve < this.fcstValidEpochArray.length; imfve += 1) {
            const fve = this.fcstValidEpochArray[imfve];
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
              sumsStats.n0 += 1;
              sumsStats.nTimes += 1;

              if (varValO && varValM) {
                sumsStats.square_diff_sum += (varValO - varValM) ** 2;
                sumsStats.N_sum += 1;
                sumsStats.obs_model_diff_sum += varValO - varValM;
                sumsStats.model_sum += varValM;
                sumsStats.obs_sum += varValO;
                sumsStats.abs_sum += Math.abs(varValO - varValM);
              }
            }
          }
          if (sumsStats.n0 > 0) {
            const sub = `${this.fcstValidEpochArray[0]};${sumsStats.square_diff_sum};${sumsStats.N_sum};${sumsStats.obs_model_diff_sum};${sumsStats.model_sum};${sumsStats.obs_sum};${sumsStats.abs_sum}`;
            sumsStats.sub_data.push(sub);
            this.stats.push(sumsStats);
          }
        }
      }
    } catch (err) {
      console.log(`MatsMiddleMap.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleMap.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleMap = {
  MatsMiddleMap,
};
