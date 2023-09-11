import { matsMiddleCommon } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";

class MatsMiddleTimeSeries {
  logToFile = false;

  logMemUsage = false;

  fcstValidEpoch_Array = [];

  cbPool = null;

  conn = null;

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
    validTimes
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
        validTimes
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
    validTimes
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

    this.average = this.average.replace(/m0./g, "");
    if (validTimes && validTimes.length > 0) {
      for (let i = 0; i < validTimes.length; i++) {
        if (validTimes[i] != null && Number(validTimes[i]) > 0) {
          this.validTimes.push(Number(validTimes[i]));
        }
      }
      console.log(`validTimes:${JSON.stringify(this.validTimes)}`);
    }

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

    const prObs = this.createObsData();
    const prModel = this.createModelData();
    await Promise.all([prObs, prModel]);
    this.generateCtc(threshold);

    for (let i = 0; i < this.ctc.length; i++) {
      this.ctc[i] = this.mmCommon.sumUpCtc(this.ctc[i]);
    }

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
    let tmplWithStationNames_obs = tmpl_get_N_stations_mfve_obs.replace(
      /{{vxAVERAGE}}/g,
      this.average
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
          dataSingleEpoch.avtime = fveDataSingleEpoch.avtime;
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
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
      tmpl_get_N_stations_mfve_model,
      "fcstLen fcst_lead"
    );
    tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
      tmpl_get_N_stations_mfve_model,
      "{{vxFCST_LEN_ARRAY}}"
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxMODEL}}/g,
      `"${this.model}"`
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxFCST_LEN}}/g,
      this.fcstLen
    );
    tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
      /{{vxAVERAGE}}/g,
      this.average
    );

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

    const promises = [];
    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100) {
      const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
      const sql = tmplWithStationNames_models.replace(
        /{{fcstValidEpoch}}/g,
        JSON.stringify(fveArraySlice)
      );
      if (this.logToFile === true && imfve === 0) {
        this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
      }
      const prSlice = this.conn.cluster.query(sql);

      promises.push(prSlice);
      prSlice.then((qr) => {
        for (let jmfve = 0; jmfve < qr.rows.length; jmfve++) {
          const fveDataSingleEpoch = qr.rows[jmfve];
          const dataSingleEpoch = {};
          const stationsSingleEpoch = {};
          for (let i = 0; i < this.stationNames.length; i++) {
            const varValStation = fveDataSingleEpoch[this.stationNames[i]];
            stationsSingleEpoch[this.stationNames[i]] = varValStation;
          }
          dataSingleEpoch.avtime = fveDataSingleEpoch.avtime;
          dataSingleEpoch.stations = stationsSingleEpoch;
          this.fveModels[fveDataSingleEpoch.fve] = dataSingleEpoch;
        }
        if (imfve % 100 == 0) {
          endTime = new Date().valueOf();
          console.log(
            `imfve:${imfve}/${this.fcstValidEpoch_Array.length} in ${
              endTime - startTime
            } ms.`
          );
        }
      });
    }
    await Promise.all(promises);
    endTime = new Date().valueOf();
    console.log(`fveModel:` + ` in ${endTime - startTime} ms.`);
  };

  generateCtc = async (threshold) => {
    console.log(`generateCtc(${threshold})`);

    const startTime = new Date().valueOf();

    for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve++) {
      const fve = this.fcstValidEpoch_Array[imfve];
      const obsSingleFve = this.fveObs[fve];
      const modelSingleFve = this.fveModels[fve];

      if (!obsSingleFve || !modelSingleFve) {
        continue;
      }

      if (this.validTimes && this.validTimes.length > 0) {
        if (this.validTimes.includes((fve % (24 * 3600)) / 3600) == false) {
          continue;
        }
      }

      const ctc_fve = {};
      ctc_fve.avtime = obsSingleFve.avtime;
      ctc_fve.hit = 0;
      ctc_fve.miss = 0;
      ctc_fve.fa = 0;
      ctc_fve.cn = 0;
      ctc_fve.N0 = 0;
      ctc_fve.N_times = 1;
      ctc_fve.sub_data = [];

      this.mmCommon.computeCtcForStations(
        fve,
        threshold,
        ctc_fve,
        this.stationNames,
        obsSingleFve,
        modelSingleFve
      );
      this.ctc.push(ctc_fve);
    }

    const endTime = new Date().valueOf();
    console.log(`generateCtc:` + ` in ${endTime - startTime} ms.`);
  };
}

export default matsMiddleTimeSeries = {
  MatsMiddleTimeSeries,
};
