import { matsMiddleCommon } from "meteor/randyp:mats-common";

import { Meteor } from "meteor/meteor";
import { memoryUsage } from "node:process";

class MatsMiddleTsDieoff {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

  fcstLenArray = [];

  fveObs = {};

  fveModels = {};

  ctc = [];

  varName = null;

  stationNames = null;

  model = null;

  fcstLen = null;

  threshold = null;

  average = null;

  fromSecs = null;

  toSecs = null;

  validTimes = [];

  utcCycleStart = [];

  singleCycle = null;

  writeOutput = false;

  mmCommon = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
    this.mmCommon = new matsMiddleCommon.MatsMiddleCommon(cbPool);
  }

  processStationQuery = (
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle
  ) => {
    const Future = require("fibers/future");

    let rv = [];
    const dFuture = new Future();
    (async () => {
      rv = await this.processStationQuery_int(
        varName,
        stationNames,
        model,
        fcstLen,
        threshold,
        average,
        fromSecs,
        toSecs,
        validTimes,
        utcCycleStart,
        singleCycle
      );
      dFuture.return();
    })();
    dFuture.wait();
    return rv;
  };

  processStationQuery_int = async (
    varName,
    stationNames,
    model,
    fcstLen,
    threshold,
    average,
    fromSecs,
    toSecs,
    validTimes,
    utcCycleStart,
    singleCycle
  ) => {
    const fs = require("fs");

    console.log(
      `processStationQuery(${varName},${
        stationNames.length
      },${model},${fcstLen},${threshold},${average},${fromSecs},${toSecs},${JSON.stringify(
        validTimes
      )})`
    );

    this.varName = varName;
    this.stationNames = stationNames;
    this.model = model;
    this.fcstLen = fcstLen;
    this.threshold = threshold;
    this.average = average;
    this.fromSecs = fromSecs;
    this.toSecs = toSecs;

    if (this.average) {
      this.average = this.average.replace(/m0./g, "");
    }

    if (validTimes && validTimes.length > 0) {
      for (let i = 0; i < validTimes.length; i++) {
        if (validTimes[i] != null && Number(validTimes[i]) > 0) {
          this.validTimes.push(Number(validTimes[i]));
        }
      }
      console.log(`validTimes:${JSON.stringify(this.validTimes)}`);
    }

    if (utcCycleStart && utcCycleStart.length > 0) {
      for (let i = 0; i < utcCycleStart.length; i++) {
        if (utcCycleStart[i] != null && Number(utcCycleStart[i]) > 0) {
          this.utcCycleStart.push(Number(utcCycleStart[i]));
        }
      }
      console.log(`utcCycleStart:${JSON.stringify(this.utcCycleStart)}`);
    }

    this.singleCycle = singleCycle;

    this.conn = await cbPool.getConnection();

    const startTime = new Date().valueOf();

    this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
      fromSecs,
      toSecs
    );

    let endTime = new Date().valueOf();
    console.log(
      `\tfcstValidEpoch_Array:${this.fcstValidEpoch_Array.length} in ${
        endTime - startTime
      } ms.`
    );

    if (!this.fcstLen) {
      // =============== get distinct fcstLen in time frame ==================
      this.fcstLenArray = await this.mmCommon.get_fcstLen_Array(
        this.model,
        this.fcstValidEpoch_Array[0],
        this.fcstValidEpoch_Array[this.fcstValidEpoch_Array.length - 1]
      );
    } else {
      this.fcstLenArray = [this.fcstLen];
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
        "/scratch/matsMiddle/output/ctc.json",
        JSON.stringify(this.ctc, null, 2)
      );
    }

    endTime = new Date().valueOf();
    console.log(`\tprocessStationQuery in ${endTime - startTime} ms.`);

    return this.ctc;
  };

  createObsData = async () => {
    console.log("createObsData()");
    const fs = require("fs");

    const startTime = new Date().valueOf();

    const tmpl_get_N_stations_mfve_obs = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql",
      "utf-8"
    );

    let stationNames_obs = "";
    for (let i = 0; i < this.stationNames.length; i++) {
      if (i === 0) {
        stationNames_obs = `obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else {
        stationNames_obs += `,obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }
    let tmplWithStationNames_obs = cbPool.trfmSQLRemoveClause(
      tmpl_get_N_stations_mfve_obs,
      "{{vxAVERAGE}}"
    );
    tmplWithStationNames_obs = tmplWithStationNames_obs.replace(
      /{{stationNamesList}}/g,
      stationNames_obs
    );
    let endTime = new Date().valueOf();
    console.log(`\tobs query:${stationNames_obs.length} in ${endTime - startTime} ms.`);

    const promises = [];
    for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(iofve, iofve + 100);
      const sql = tmplWithStationNames_obs.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && iofve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);
      promises.push(prSlice);
      prSlice.then((qr) => {
        console.log(`qr:\n${qr.rows.length}`);
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve++) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          if (this.average) {
            dataSingleEpoch.avtime = fveDataSingleEpoch.avtime;
          } else {
            dataSingleEpoch.fcst = fveDataSingleEpoch.fcst;
          }
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveObs[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
        if (iofve % 100 == 0) {
          endTime = new Date().valueOf();
          console.log(
            `iofve:${iofve}/${this.fcstValidEpoch_Array.length} in ${
              endTime - startTime
            } ms.`
          );
        }
      });
    }

    await Promise.all(promises);
    endTime = new Date().valueOf();
    console.log(`fveObs:` + ` in ${endTime - startTime} ms.`);
  };

  createModelData = async () => {
    console.log("createModelData()");
    const fs = require("fs");

    const startTime = new Date().valueOf();

    let tmpl_get_N_stations_mfve_model = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql",
      "utf-8"
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );

    if (this.fcstLen) {
      tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
        /{{vxFCST_LEN}}/g,
        this.fcstLen
      );
      tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
        /{{vxAVERAGE}}/g,
        this.average
      );
      tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
        tmpl_get_N_stations_mfve_model,
        "{{vxFCST_LEN_ARRAY}}"
      );
      tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
        tmpl_get_N_stations_mfve_model,
        "fcstLen fcst_lead"
      );
    } else {
      tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
        tmpl_get_N_stations_mfve_model,
        "fcstLen = {{vxFCST_LEN}}"
      );
      tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
        tmpl_get_N_stations_mfve_model,
        "{{vxAVERAGE}}"
      );
    }

    let stationNames_models = "";
    for (let i = 0; i < this.stationNames.length; i++) {
      if (i === 0) {
        stationNames_models = `models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      } else {
        stationNames_models += `,models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
      }
    }

    const tmplWithStationNames_models = tmpl_get_N_stations_mfve_model.replace(
      /{{stationNamesList}}/g,
      stationNames_models
    );
    let endTime = new Date().valueOf();
    console.log(
      `\tmodel query:${stationNames_models.length} in ${endTime - startTime} ms.`
    );
    console.log(`tmplWithStationNames_models:\n${tmplWithStationNames_models}`);

    const flaIncr = 3;
    for (let flai = 0; flai < this.fcstLenArray.length; flai += flaIncr) {
      this.fveModels = {};
      const flaSlice = this.fcstLenArray.slice(flai, flai + flaIncr);
      const tmplWithStationNames_models_fcst_array =
        tmplWithStationNames_models.replace(
          /{{vxFCST_LEN_ARRAY}}/g,
          JSON.stringify(flaSlice)
        );
      const promises = [];
      for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100) {
        const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
        const sql = tmplWithStationNames_models_fcst_array.replace(
          /{{fcstValidEpoch}}/g,
          JSON.stringify(fveArraySlice)
        );
        // console.log(sql);
        console.log(
          `flaSlice:${JSON.stringify(flaSlice)},fveArraySlice:${fveArraySlice[0]} => ${
            fveArraySlice[fveArraySlice.length - 1]
          }`
        );
        if (this.logToFile === true && imfve === 0) {
          this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
        }
        const prSlice = this.conn.cluster.query(sql);

        promises.push(prSlice);
        prSlice.then((qr) => {
          const idx = imfve / 100;
          for (let jmfve = 0; jmfve < qr.rows.length; jmfve++) {
            const fveDataSingleEpoch = qr.rows[jmfve];
            const dataSingleEpoch = {};
            const stationsSingleEpoch = {};
            for (let i = 0; i < this.stationNames.length; i++) {
              const varValStation = fveDataSingleEpoch[this.stationNames[i]];
              stationsSingleEpoch[this.stationNames[i]] = varValStation;
            }
            dataSingleEpoch.stations = stationsSingleEpoch;
            if (!this.fveModels[fveDataSingleEpoch.fcst_lead]) {
              this.fveModels[fveDataSingleEpoch.fcst_lead] = {};
            }
            this.fveModels[fveDataSingleEpoch.fcst_lead][fveDataSingleEpoch.fve] =
              dataSingleEpoch;
          }

          endTime = new Date().valueOf();
          console.log(
            `imfve:${imfve}/${this.fcstValidEpoch_Array.length} idx: ${idx} in ${
              endTime - startTime
            } ms.`
          );

          if (this.logMemUsage === true) {
            try {
              console.log(memoryUsage());
              const obsSize =
                new TextEncoder().encode(JSON.stringify(this.fveObs)).length /
                (1024 * 1024);
              const modelsSize =
                new TextEncoder().encode(JSON.stringify(this.fveModels)).length /
                (1024 * 1024);
              const ctcSize =
                new TextEncoder().encode(JSON.stringify(this.ctc)).length /
                (1024 * 1024);
              console.log(
                `sizes (MB), obs:${obsSize},model:${modelsSize},ctc:${ctcSize}`
              );
            } catch (ex) {
              console.log(`exception getting sizes:${ex}`);
            }
          }
        });
      }
      await Promise.all(promises);
      this.generateCtc();
    }
    endTime = new Date().valueOf();
    console.log(`fveModel:` + ` in ${endTime - startTime} ms.`);
  };

  generateCtc = () => {
    console.log("generateCtc()");

    const { threshold } = this;

    const startTime = new Date().valueOf();

    const fcst_lead_array = Object.keys(this.fveModels);
    fcst_lead_array.sort(function (a, b) {
      return a - b;
    });
    for (let flai = 0; flai < fcst_lead_array.length; flai++) {
      const stats_fcst_lead = {};

      const fcst_lead = Number(fcst_lead_array[flai]);
      stats_fcst_lead.fcst_lead = fcst_lead;
      stats_fcst_lead.hit = 0;
      stats_fcst_lead.miss = 0;
      stats_fcst_lead.fa = 0;
      stats_fcst_lead.cn = 0;
      stats_fcst_lead.N0 = 0;
      stats_fcst_lead.N_times = new Set(fcst_lead_array).size;
      stats_fcst_lead.sub_data = [];

      // get all the fve for this fcst_lead
      const fcst_lead_single = this.fveModels[fcst_lead_array[flai]];
      const fve_array = Object.keys(fcst_lead_single);
      fve_array.sort();

      stats_fcst_lead.min_secs = fve_array[0];
      stats_fcst_lead.max_secs = fve_array[fve_array.length - 1];
      for (let imfve = 0; imfve < fve_array.length; imfve++) {
        const fve = fve_array[imfve];
        const obsSingleFve = this.fveObs[fve];
        const modelSingleFve = fcst_lead_single[fve];

        if (!obsSingleFve || !modelSingleFve) {
          continue;
        }

        if (this.validTimes && this.validTimes.length > 0) {
          // m0.fcstValidEpoch%(24*3600)/3600 IN[vxVALID_TIMES]
          if (this.validTimes.includes((fve % (24 * 3600)) / 3600) == false) {
            continue;
          }
        }

        if (this.utcCycleStart && this.utcCycleStart.length > 0) {
          // (obs.fcstValidEpoch - obs.fcstLen*3600)%(24*3600)/3600 IN[vxUTC_CYCLE_START])
          if (
            this.utcCycleStart.includes(
              ((fve - fcst_lead * 3600) % (24 * 3600)) / 3600
            ) == false
          ) {
            continue;
          }
        }

        if (this.singleCycle !== null) {
          // obs.fcstValidEpoch-obs.fcstLen*3600 = vxFROM_SECS
          if (fve - fcst_lead * 3600 == this.singleCycle) {
            continue;
          }
        }

        for (let i = 0; i < this.stationNames.length; i++) {
          const station = this.stationNames[i];
          const varVal_o = obsSingleFve.stations[station];
          const varVal_m = modelSingleFve.stations[station];

          if (varVal_o && varVal_m) {
            stats_fcst_lead.N0 += 1;
            let sub = `${fve};`;
            if (varVal_o < threshold && varVal_m < threshold) {
              stats_fcst_lead.hit += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varVal_o >= threshold && varVal_m < threshold) {
              stats_fcst_lead.fa += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varVal_o < threshold && varVal_m >= threshold) {
              stats_fcst_lead.miss += 1;
              sub += "1;";
            } else {
              sub += "0;";
            }

            if (varVal_o >= threshold && varVal_m >= threshold) {
              stats_fcst_lead.cn += 1;
              sub += "1";
            } else {
              sub += "0";
            }
            stats_fcst_lead.sub_data.push(sub);
          }
        }
      }
      try {
        const stats_fcst_lead_summed = this.mmCommon.sumUpCtc(stats_fcst_lead);
        this.ctc.push(stats_fcst_lead_summed);
      } catch (ex) {
        console.log(ex);
      }
    }

    const endTime = new Date().valueOf();
    console.log(`generateCtc:` + ` in ${endTime - startTime} ms.`);
  };
}

export default matsMiddleTsDieoff = {
  MatsMiddleTsDieoff,
};
