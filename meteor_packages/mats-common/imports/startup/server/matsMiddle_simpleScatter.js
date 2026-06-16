/*
 * Copyright (c) 2021 Colorado State University and Regents of the University of Colorado. All rights reserved.
 */

/* global Assets */

import { matsTypes, matsMiddleCommon } from "meteor/randyp:mats-common";
import { _ } from "meteor/underscore";

class MatsMiddleSimpleScatter {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpochArray = [];

  fcstLengthArray = [];

  indVarArray = [];

  cbPool = null;

  conn = null;

  fveObs = {};

  fveModels = {};

  stats = [];

  binParam = null;

  statTypeX = null;

  statTypeY = null;

  varNameX = null;

  varNameY = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  thresholdX = null;

  thresholdY = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  filterInfo = {};

  elevMap = {};

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
    binParam,
    statTypeX,
    statTypeY,
    varNameX,
    varNameY,
    stationNames,
    model,
    fcstLen,
    thresholdX,
    thresholdY,
    fromSecs,
    toSecs,
    validTimes,
    filterInfo,
    elevMap
  ) => {
    let rv = [];
    try {
      rv = await this.processStationQueryInt(
        binParam,
        statTypeX,
        statTypeY,
        varNameX,
        varNameY,
        stationNames,
        model,
        fcstLen,
        thresholdX,
        thresholdY,
        fromSecs,
        toSecs,
        validTimes,
        filterInfo,
        elevMap
      );
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.processStationQuery ERROR: ${err.message}`);
      rv = `MatsMiddleSimpleScatter.processStationQuery ERROR: ${err.message}`;
    }
    return rv;
  };

  processStationQueryInt = async (
    binParam,
    statTypeX,
    statTypeY,
    varNameX,
    varNameY,
    stationNames,
    model,
    fcstLen,
    thresholdX,
    thresholdY,
    fromSecs,
    toSecs,
    validTimes,
    filterInfo,
    elevMap
  ) => {
    try {
      this.binParam = binParam;
      this.statTypeX = statTypeX;
      this.statTypeY = statTypeY;
      this.varNameX = varNameX;
      this.varNameY = varNameY;
      this.stationNames = stationNames;
      this.model = model;
      this.fcstLen = fcstLen;
      this.thresholdX = thresholdX;
      this.thresholdY = thresholdY;
      this.fromSecs = fromSecs;
      this.toSecs = toSecs;
      if (validTimes.length !== 0 && validTimes !== matsTypes.InputTypes.unused) {
        this.validTimes = validTimes.map(function (vt) {
          return Number(vt);
        });
      }
      this.filterInfo = filterInfo;

      this.elevMap = elevMap;

      this.conn = await this.cbPool.getConnection();

      this.fcstValidEpochArray = await this.mmCommon.getFcstValidEpochArray(
        fromSecs,
        toSecs
      );

      this.fcstLengthArray = await this.mmCommon.getFcstLenArray(
        this.model,
        this.fcstValidEpochArray[0],
        this.fcstValidEpochArray[this.fcstValidEpochArray.length - 1]
      );
      this.fcstLengthArray = this.fcstLengthArray.filter((fl) => Number(fl) % 3 === 0);
      this.fcstLengthArray.sort((a, b) => Number(a) - Number(b));

      // create distinct indVar array
      if (this.binParam === "Fcst lead time") {
        this.indVarArray = this.fcstLengthArray;
      } else {
        for (let iofve = 0; iofve < this.fcstValidEpochArray.length; iofve += 1) {
          const ofve = this.fcstValidEpochArray[iofve];
          let indVar;
          switch (this.binParam) {
            case "Init UTC hour":
              indVar = ((ofve - this.fcstLen) % (24 * 3600)) / 3600;
              break;
            case "Valid UTC hour":
              indVar = (ofve % (24 * 3600)) / 3600;
              break;
            case "Init Date":
              indVar = ofve - this.fcstLen;
              break;
            case "Valid Date":
            default:
              indVar = ofve;
              break;
          }
          if (!this.indVarArray.includes(indVar)) {
            this.indVarArray.push(indVar);
          }
        }
        this.indVarArray.sort((a, b) => Number(a) - Number(b));
      }

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
        `MatsMiddleSimpleScatter.processStationQueryInt ERROR: ${err.message}`
      );
      throw new Error(
        `MatsMiddleSimpleScatter.processStationQueryInt ERROR: ${err.message}`
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
        // if we're querying for elevation, retrieve it from the map we passed in instead of the database
        let wantedValueX = "";
        let wantedValueY = "";
        if (this.varNameX === "Elevation") {
          const station = this.stationNames[i];
          wantedValueX = this.elevMap[station];
        } else {
          wantedValueX = `obs.data.${this.stationNames[i]}.\`${this.varNameX}\``;
        }
        if (this.varNameY === "Elevation") {
          const station = this.stationNames[i];
          wantedValueY = this.elevMap[station];
        } else {
          wantedValueY = `obs.data.${this.stationNames[i]}.\`${this.varNameY}\``;
        }

        // if we're filtering by elevation, retrieve it from the map we passed in instead of the database
        let filterObsValue = "";
        if (this.filterInfo.filterObsBy) {
          if (this.filterInfo.filterObsBy === "Elevation") {
            const station = this.stationNames[i];
            filterObsValue = this.elevMap[station];
          } else {
            filterObsValue = `obs.data.${this.stationNames[i]}.\`${this.filterInfo.filterObsBy}\``;
          }
        }

        if (i === 0) {
          if (this.filterInfo.filterObsBy) {
            stationNamesObs = `CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueX} ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueY} ELSE "NULL" END ${this.stationNames[i]}_Y`;
          } else {
            stationNamesObs = `${wantedValueX} ${this.stationNames[i]}_X, ${wantedValueY} ${this.stationNames[i]}_Y`;
          }
        } else if (this.filterInfo.filterObsBy) {
          stationNamesObs += `, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueX} ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN ${filterObsValue} >= ${this.filterInfo.filterObsMin} AND ${filterObsValue} <= ${this.filterInfo.filterObsMax} THEN ${wantedValueY} ELSE "NULL" END ${this.stationNames[i]}_Y`;
        } else {
          stationNamesObs += `, ${wantedValueX} ${this.stationNames[i]}_X, ${wantedValueY} ${this.stationNames[i]}_Y`;
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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = "0"; // obs don't have a lead time
                break;
              case "Init UTC hour":
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
              case "Valid Date":
              default:
                indVarKey = fveDataSingleEpoch.fve.toString();
                break;
            }
            if (!this.fveObs[indVarKey]) {
              this.fveObs[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (
                fveDataSingleEpoch[`${this.stationNames[i]}_X`] &&
                fveDataSingleEpoch[`${this.stationNames[i]}_Y`]
              ) {
                const varValStationX =
                  fveDataSingleEpoch[`${this.stationNames[i]}_X`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_X`];
                stationsSingleEpoch[`${this.stationNames[i]}_X`] = varValStationX;
                const varValStationY =
                  fveDataSingleEpoch[`${this.stationNames[i]}_Y`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_Y`];
                stationsSingleEpoch[`${this.stationNames[i]}_Y`] = varValStationY;
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
      console.log(`MatsMiddleValidTime.createObsData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleValidTime.createObsData ERROR: ${err.message}`);
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

      if (this.binParam === "Fcst lead time") {
        tmplGetNStationsMfveModel = this.cbPool.trfmSQLRemoveClause(
          tmplGetNStationsMfveModel,
          "{{vxFCST_LEN}}"
        );
      } else {
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
      }

      let stationNamesModels = "";
      for (let i = 0; i < this.stationNames.length; i += 1) {
        if (i === 0) {
          if (this.filterInfo.filterModelBy) {
            stationNamesModels = `CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNameX}\` ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNameY}\` ELSE "NULL" END ${this.stationNames[i]}_Y`;
          } else {
            stationNamesModels = `models.data.${this.stationNames[i]}.\`${this.varNameX}\` ${this.stationNames[i]}_X, models.data.${this.stationNames[i]}.\`${this.varNameY}\` ${this.stationNames[i]}_Y`;
          }
        } else if (this.filterInfo.filterModelBy) {
          stationNamesModels += `, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNameX}\` ELSE "NULL" END ${this.stationNames[i]}_X, CASE WHEN models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` >= ${this.filterInfo.filterModelMin} AND models.data.${this.stationNames[i]}.\`${this.filterInfo.filterModelBy}\` <= ${this.filterInfo.filterModelMax} THEN models.data.${this.stationNames[i]}.\`${this.varNameY}\` ELSE "NULL" END ${this.stationNames[i]}_Y`;
        } else {
          stationNamesModels += `, models.data.${this.stationNames[i]}.\`${this.varNameX}\` ${this.stationNames[i]}_X, models.data.${this.stationNames[i]}.\`${this.varNameY}\` ${this.stationNames[i]}_Y`;
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
            let indVarKey;
            switch (this.binParam) {
              case "Fcst lead time":
                indVarKey = fveDataSingleEpoch.fcst_lead.toString();
                break;
              case "Init UTC hour":
                indVarKey = (
                  ((fveDataSingleEpoch.fve - this.fcstLen) % (24 * 3600)) /
                  3600
                ).toString();
                break;
              case "Valid UTC hour":
                indVarKey = ((fveDataSingleEpoch.fve % (24 * 3600)) / 3600).toString();
                break;
              case "Init Date":
                indVarKey = fveDataSingleEpoch.fve.toString();
                break;
              case "Valid Date":
              default:
                indVarKey = (fveDataSingleEpoch.fve - this.fcstLen).toString();
                break;
            }
            if (!this.fveModels[indVarKey]) {
              this.fveModels[indVarKey] = {};
            }
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i += 1) {
              if (
                fveDataSingleEpoch[`${this.stationNames[i]}_X`] &&
                fveDataSingleEpoch[`${this.stationNames[i]}_Y`]
              ) {
                const varValStationX =
                  fveDataSingleEpoch[`${this.stationNames[i]}_X`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_X`];
                stationsSingleEpoch[`${this.stationNames[i]}_X`] = varValStationX;
                const varValStationY =
                  fveDataSingleEpoch[`${this.stationNames[i]}_Y`] === "NULL"
                    ? null
                    : fveDataSingleEpoch[`${this.stationNames[i]}_Y`];
                stationsSingleEpoch[`${this.stationNames[i]}_Y`] = varValStationY;
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

      if (this.statTypeX === "ctc") {
        this.generateCtc("X");
      } else {
        this.generateSums("X");
      }
      if (this.statTypeY === "ctc") {
        this.generateCtc("Y");
      } else {
        this.generateSums("Y");
      }
    } catch (err) {
      console.log(`MatsMiddleSimpleScatter.createModelData ERROR: ${err.message}`);
      throw new Error(`MatsMiddleSimpleScatter.createModelData ERROR: ${err.message}`);
    }
  };

  generateCtc = (axis) => {
    try {
      const threshold = Number(this[`threshold${axis}`]);
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
        ctcStats.hr_of_day = Number(indVar);
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
      console.log(`MatsMiddleValidTime.generateCtc ERROR: ${err.message}`);
      throw new Error(`MatsMiddleValidTime.generateCtc ERROR: ${err.message}`);
    }
  };

  generateSums = (axis) => {
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
        sumsStats.hr_of_day = Number(indVar);
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
      console.log(`MatsMiddleValidTime.generateSums ERROR: ${err.message}`);
      throw new Error(`MatsMiddleValidTime.generateSums ERROR: ${err.message}`);
    }
  };
}

// eslint-disable-next-line no-undef
export default matsMiddleSimpleScatter = {
  MatsMiddleSimpleScatter,
};
