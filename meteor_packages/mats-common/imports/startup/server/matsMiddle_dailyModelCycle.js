/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsMiddleCommon } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleDailyModelCycle {
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

  threshold = null;

  fromSecs = null;

  toSecs = null;

  utcCycleStart = null;

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

  processStationQuery = async (
    statType,
    varName,
    stationNames,
    model,
    threshold,
    fromSecs,
    toSecs,
    utcCycleStart,
    filterInfo
  ) => {
    let rv = [];
    try {
      rv = await this.processStationQueryInt(
        statType,
        varName,
        stationNames,
        model,
        threshold,
        fromSecs,
        toSecs,
        utcCycleStart,
        filterInfo
      );
    } catch (err) {
      console.log(
        `MatsMiddleDailyModelCycle.processStationQuery ERROR: ${err.message}`
      );
      rv = `MatsMiddleDailyModelCycle.processStationQuery ERROR: ${err.message}`;
    }
    return rv;
  };

  processStationQueryInt = async (
    statType,
    varName,
    stationNames,
    model,
    threshold,
    fromSecs,
    toSecs,
    utcCycleStart,
    filterInfo
  ) => {
    try {
      this.statType = statType;
      this.varName = varName;
      this.stationNames = stationNames;
      this.model = model;
      this.threshold = threshold;
      this.fromSecs = fromSecs;
      this.toSecs = toSecs;
      this.utcCycleStart = utcCycleStart;
      this.filterInfo = filterInfo;

      this.conn = await this.cbPool.getConnection();

      this.fcstValidEpochArray = await this.mmCommon.getFcstValidEpochArray(
        fromSecs,
        toSecs
      );

      // create distinct indVar array
      for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
        const indVar = this.fcstValidEpochArray[iofve];
        if (!this.indVarArray.includes(indVar)) {
          this.indVarArray.push(indVar);
        }
      }
      this.indVarArray.sort((a, b) => Number(a) - Number(b));

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
    } catch (err) {
      console.log(
        `MatsMiddleDailyModelCycle.processStationQueryInt ERROR: ${err.message}`
      );
      throw new Error(
        `MatsMiddleDailyModelCycle.processStationQueryInt ERROR: ${err.message}`
      );
    }
  };

  createObsData = async () => {
    try {
      const tmplGetNStationsMfveObs = await Assets.getTextAsync(
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
            const indVarKey = fveDataSingleEpoch.fve.toString();
            if (!this.fveObs[indVarKey]) {
              this.fveObs[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (fveDataSingleEpoch[this.stationNames[i]]) {
                const varValStation =
                  fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                    ? null
                    : fveDataSingleEpoch[this.stationNames[i]];
                stationsSingleEpoch[this.stationNames[i]] = varValStation;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveObs[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }

      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });
    } catch (err) {
      console.log(`MatsMiddleDailyModelCycle.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleDailyModelCycle.createObsData ERROR: ${err.message}`);
    }
  };

  createModelData = async () => {
    try {
      let tmplGetNStationsMfveModel = await Assets.getTextAsync(
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
      tmplGetNStationsMfveModel = tmplGetNStationsMfveModel.replace(
        /fcstLen = {{vxFCST_LEN}}/g,
        `fcstLen < 24 AND (models.fcstValidEpoch - models.fcstLen*3600)%(24*3600)/3600 IN [${this.utcCycleStart}]`
      );
      tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
        tmplGetNStationsMfveModel,
        "{{vxFCST_LEN_ARRAY}}"
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
            const indVarKey = fveDataSingleEpoch.fve.toString();
            if (!this.fveModels[indVarKey]) {
              this.fveModels[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (fveDataSingleEpoch[this.stationNames[i]]) {
                const varValStation =
                  fveDataSingleEpoch[this.stationNames[i]] === "NULL"
                    ? null
                    : fveDataSingleEpoch[this.stationNames[i]];
                stationsSingleEpoch[this.stationNames[i]] = varValStation;
              }
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            this.fveModels[indVarKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
          }
        });
      }
      await Promise.all(promises).catch((err) => {
        console.log(`${err.message}`);
        throw new Error(`${err.message}`);
      });

      if (this.statType === "ctc") {
        this.generateCtc();
      } else {
        this.generateSums();
      }
    } catch (err) {
      console.log(`MatsMiddleDailyModelCycle.createModelData ERROR: ${err.message}`);
      throw new Error(
        `MatsMiddleDailyModelCycle.createModelData ERROR: ${err.message}`
      );
    }
  };

  generateCtc = () => {
    try {
      const threshold = Number(this.threshold);
      const indVarsWithData = _.intersection(
        Object.keys(this.fveObs),
        Object.keys(this.fveModels)
      );
      indVarsWithData.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (let idx = 0; idx < indVarsWithData.length; idx += 1) {
        let ctcStats = {};

        const indVar = indVarsWithData[idx];
        ctcStats.avtime = Number(indVar);
        ctcStats.hit = 0;
        ctcStats.miss = 0;
        ctcStats.fa = 0;
        ctcStats.cn = 0;
        ctcStats.n0 = 0;
        ctcStats.sub_data = [];

        // get all the fve for this indVar
        const indVarSingle = this.fveModels[indVar];
        const fveArray = Object.keys(indVarSingle);
        fveArray.sort();

        [ctcStats.min_secs] = fveArray;
        ctcStats.max_secs = fveArray[fveArray.length - 1];
        ctcStats.nTimes = fveArray.length;
        for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
          const fve = fveArray[imfve];
          const obsSingleFve = this.fveObs[indVar][fve];
          const modelSingleFve = indVarSingle[fve];

          if (obsSingleFve && modelSingleFve) {
            ctcStats = this.mmCommon.computeCtcForStations(
              fve,
              threshold,
              ctcStats,
              this.stationNames,
              obsSingleFve,
              modelSingleFve
            );
          }
        }

        try {
          const statsSummedByIndVar = this.mmCommon.sumUpCtc(ctcStats);
          this.stats.push(statsSummedByIndVar);
        } catch (ex) {
          throw new Error(ex);
        }
      }
    } catch (err) {
      console.log(`MatsMiddleDailyModelCycle.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleDailyModelCycle.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = () => {
    try {
      const indVarsWithData = _.intersection(
        Object.keys(this.fveObs),
        Object.keys(this.fveModels)
      );
      indVarsWithData.sort(function (a, b) {
        return Number(a) - Number(b);
      });

      for (let idx = 0; idx < indVarsWithData.length; idx += 1) {
        let sumsStats = {};

        const indVar = indVarsWithData[idx];
        sumsStats.avtime = Number(indVar);
        sumsStats.square_diff_sum = 0;
        sumsStats.N_sum = 0;
        sumsStats.obs_model_diff_sum = 0;
        sumsStats.model_sum = 0;
        sumsStats.obs_sum = 0;
        sumsStats.abs_sum = 0;
        sumsStats.n0 = 0;
        sumsStats.sub_data = [];

        // get all the fve for this indVar
        const indVarSingle = this.fveModels[indVar];
        const fveArray = Object.keys(indVarSingle);
        fveArray.sort();

        [sumsStats.min_secs] = fveArray;
        sumsStats.max_secs = fveArray[fveArray.length - 1];
        sumsStats.nTimes = fveArray.length;
        for (let imfve = 0; imfve < fveArray.length; imfve += 1) {
          const fve = fveArray[imfve];
          const obsSingleFve = this.fveObs[indVar][fve];
          const modelSingleFve = indVarSingle[fve];

          if (obsSingleFve && modelSingleFve) {
            sumsStats = this.mmCommon.computeSumsForStations(
              fve,
              sumsStats,
              this.stationNames,
              obsSingleFve,
              modelSingleFve
            );
          }
        }

        try {
          const statsSummedByIndVar = this.mmCommon.sumUpSums(sumsStats);
          this.stats.push(statsSummedByIndVar);
        } catch (ex) {
          throw new Error(ex);
        }
      }
    } catch (err) {
      console.log(`MatsMiddleDailyModelCycle.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleDailyModelCycle.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleDailyModelCycle = {
  MatsMiddleDailyModelCycle,
};
