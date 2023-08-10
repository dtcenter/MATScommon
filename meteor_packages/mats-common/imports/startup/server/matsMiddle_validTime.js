import { matsMiddleCommon } from "meteor/randyp:mats-common";

import { Meteor } from "meteor/meteor";
import { memoryUsage } from "node:process";

class MatsMiddleValidTime
{
    logToFile = false;

    logMemUsage = false;

    hrOfDay_Array = [];

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

    fromSecs = null;

    toSecs = null;

    writeOutput = false;

    mmCommon = null;

    constructor(cbPool)
    {
        this.cbPool = cbPool;
        this.mmCommon = new matsMiddleCommon.MatsMiddleCommon(cbPool);
    }

    processStationQuery = (
        varName,
        stationNames,
        model,
        fcstLen,
        threshold,
        fromSecs,
        toSecs
    ) =>
    {
        const Future = require("fibers/future");

        let rv = [];
        const dFuture = new Future();
        (async () =>
        {
            rv = await this.processStationQuery_int(
                varName,
                stationNames,
                model,
                fcstLen,
                threshold,
                fromSecs,
                toSecs
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
        fromSecs,
        toSecs
    ) =>
    {
        console.log(
            `processStationQuery(${varName},${stationNames.length
            },${model},${fcstLen},${threshold},${fromSecs},${toSecs}
      )})`
        );

        this.varName = varName;
        this.stationNames = stationNames;
        this.model = model;
        this.fcstLen = fcstLen;
        this.threshold = threshold;
        this.fromSecs = fromSecs;
        this.toSecs = toSecs;
        const fs = require("fs");

        this.conn = await cbPool.getConnection();

        const startTime = new Date().valueOf();

        this.fcstValidEpoch_Array = await this.mmCommon.get_fcstValidEpoch_Array(
            fromSecs,
            toSecs
        );

        // create distinct hour of day array
        for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; ++iofve)
        {
            let ofve = this.fcstValidEpoch_Array[iofve];
            let hod = ofve%(24*3600)/3600;
            if (!this.hrOfDay_Array.includes(hod))
            {
                this.hrOfDay_Array.push(hod);
            }
        }
        this.hrOfDay_Array.sort((a, b) => a - b);
        if (this.logToFile === true)
        {
            console.log("hrOfDay_Array:\n" + JSON.stringify(this.hrOfDay_Array));
        }

        let endTime = new Date().valueOf();
        console.log(
            `\tfcstValidEpoch_Array:${this.fcstValidEpoch_Array.length} in ${endTime - startTime
            } ms.`
        );

        await this.createObsData();
        await this.createModelData();

        if (this.logToFile === true)
        {
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

    createObsData = async () =>
    {
        console.log("createObsData()");
        const fs = require("fs");

        const startTime = new Date().valueOf();

        const tmpl_get_N_stations_mfve_obs = fs.readFileSync(
            "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_obs.sql",
            "utf-8"
        );

        let stationNames_obs = "";
        for (let i = 0; i < this.stationNames.length; i++)
        {
            if (i === 0)
            {
                stationNames_obs = `obs.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
            } else
            {
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
        for (let iofve = 0; iofve < this.fcstValidEpoch_Array.length; iofve += 100)
        {
            const fveArraySlice = this.fcstValidEpoch_Array.slice(iofve, iofve + 100);
            const sql = tmplWithStationNames_obs.replace(
                /{{fcstValidEpoch}}/g,
                JSON.stringify(fveArraySlice)
            );
            if (this.logToFile === true && iofve === 0)
            {
                this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/obs.sql", sql);
            }
            const prSlice = this.conn.cluster.query(sql);
            promises.push(prSlice);
            prSlice.then((qr) =>
            {
                console.log(`qr:\n${qr.rows.length}`);
                for (let jmfve = 0; jmfve < qr.rows.length; jmfve++)
                {

                    const fveDataSingleEpoch = qr.rows[jmfve];
                    let hod = fveDataSingleEpoch.fve % (24 * 3600) / 3600;
                    let hodKey = hod.toString();
                    if (!this.fveObs[hodKey])
                    {
                        this.fveObs[hodKey] = {};
                    }
                    const dataSingleEpoch = {};
                    const stationsSingleEpoch = {};
                    for (let i = 0; i < this.stationNames.length; i++)
                    {
                        const varValStation = fveDataSingleEpoch[this.stationNames[i]];
                        stationsSingleEpoch[this.stationNames[i]] = varValStation;
                    }
                    dataSingleEpoch.fcst = fveDataSingleEpoch.fcst;
                    dataSingleEpoch.stations = stationsSingleEpoch;
                    this.fveObs[hodKey][fveDataSingleEpoch.fve] = dataSingleEpoch;
                }
                if (iofve % 100 == 0)
                {
                    endTime = new Date().valueOf();
                    console.log(
                        `iofve:${iofve}/${this.fcstValidEpoch_Array.length} in ${endTime - startTime
                        } ms.`
                    );
                }
            });
        }

        await Promise.all(promises);
        endTime = new Date().valueOf();
        console.log(`fveObs:` + ` in ${endTime - startTime} ms.`);
    };

    createModelData = async () =>
    {
        console.log("createModelData()");
        const fs = require("fs");

        const startTime = new Date().valueOf();

        let tmpl_get_N_stations_mfve_model = fs.readFileSync(
            "assets/app/matsMiddle/sqlTemplates/tmpl_get_N_stations_mfve_IN_model.sql",
            "utf-8"
        );
        tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
            tmpl_get_N_stations_mfve_model,
            "{{vxFCST_LEN}}"
        );
        tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
            tmpl_get_N_stations_mfve_model,
            "{{vxFCST_LEN_ARRAY}}"
        );
        tmpl_get_N_stations_mfve_model = this.cbPool.trfmSQLRemoveClause(
            tmpl_get_N_stations_mfve_model,
            "{{vxAVERAGE}}"
        );
        tmpl_get_N_stations_mfve_model = tmpl_get_N_stations_mfve_model.replace(
            /{{vxMODEL}}/g,
            `"${this.model}"`
        );
        let stationNames_models = "";
        for (let i = 0; i < this.stationNames.length; i++)
        {
            if (i === 0)
            {
                stationNames_models = `models.data.${this.stationNames[i]}.${this.varName} ${this.stationNames[i]}`;
            } else
            {
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

        const flaIncr = 3;
        this.fveModels = {};
        const promises = [];
        for (let imfve = 0; imfve < this.fcstValidEpoch_Array.length; imfve += 100)
        {
            const fveArraySlice = this.fcstValidEpoch_Array.slice(imfve, imfve + 100);
            const sql = tmplWithStationNames_models.replace(
                /{{fcstValidEpoch}}/g,
                JSON.stringify(fveArraySlice)
            );
            if (this.logToFile === true && imfve === 0)
            {
                this.mmCommon.writeToLocalFile("/scratch/matsMiddle/output/model.sql", sql);
            }
            const prSlice = this.conn.cluster.query(sql);

            promises.push(prSlice);
            prSlice.then((qr) =>
            {
                const idx = imfve / 100;
                for (let jmfve = 0; jmfve < qr.rows.length; jmfve++)
                {
                    const fveDataSingleEpoch = qr.rows[jmfve];
                    let hod = fveDataSingleEpoch.fve % (24 * 3600) / 3600;
                    let hodKey = hod.toString();
                    if (!this.fveModels[hodKey])
                    {
                        this.fveModels[hodKey] = {};
                    }
                    const dataSingleEpoch = {};
                    const stationsSingleEpoch = {};
                    for (let i = 0; i < this.stationNames.length; i++)
                    {
                        const varValStation = fveDataSingleEpoch[this.stationNames[i]];
                        stationsSingleEpoch[this.stationNames[i]] = varValStation;
                    }
                    dataSingleEpoch.stations = stationsSingleEpoch;
                    this.fveModels[hodKey][fveDataSingleEpoch.fve] =
                        dataSingleEpoch;
                }

                endTime = new Date().valueOf();
                console.log(
                    `imfve:${imfve}/${this.fcstValidEpoch_Array.length} idx: ${idx} in ${endTime - startTime
                    } ms.`
                );

                if (this.logMemUsage === true)
                {
                    try
                    {
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
                    } catch (ex)
                    {
                        console.log(`exception getting sizes:${ex}`);
                    }
                }
            });
        }
        await Promise.all(promises);
        this.generateCtc();
        endTime = new Date().valueOf();
        console.log(`fveModel:` + ` in ${endTime - startTime} ms.`);
    };

    generateCtc = () =>
    {
        console.log("generateCtc()");

        const { threshold } = this;

        const startTime = new Date().valueOf();

        for (let ihod = 0; ihod < this.hrOfDay_Array.length; ihod++)
        {
            const  stats_hod= {};

            const hod = this.hrOfDay_Array[ihod];
            let hodKey = hod.toString();
            stats_hod.hr_of_day = hod;
            stats_hod.hit = 0;
            stats_hod.miss = 0;
            stats_hod.fa = 0;
            stats_hod.cn = 0;
            stats_hod.N0 = 0;
            stats_hod.N_times = new Set(this.hrOfDay_Array).size;
            stats_hod.sub_data = [];

            // get all the fve for this hod
            const hod_single = this.fveModels[hodKey];
            const fve_array = Object.keys(hod_single);
            fve_array.sort();

            stats_hod.min_secs = fve_array[0];
            stats_hod.max_secs = fve_array[fve_array.length - 1];
            for (let imfve = 0; imfve < fve_array.length; imfve++)
            {
                const fve = fve_array[imfve];
                const obsSingleFve = this.fveObs[hodKey][fve];
                const modelSingleFve = hod_single[fve];

                if (!obsSingleFve || !modelSingleFve)
                {
                    continue;
                }

                for (let i = 0; i < this.stationNames.length; i++)
                {
                    const station = this.stationNames[i];
                    const varVal_o = obsSingleFve.stations[station];
                    const varVal_m = modelSingleFve.stations[station];

                    if (varVal_o && varVal_m)
                    {
                        stats_hod.N0 += 1;
                        let sub = `${fve};`;
                        if (varVal_o < threshold && varVal_m < threshold)
                        {
                            stats_hod.hit += 1;
                            sub += "1;";
                        } else
                        {
                            sub += "0;";
                        }

                        if (varVal_o >= threshold && varVal_m < threshold)
                        {
                            stats_hod.fa += 1;
                            sub += "1;";
                        } else
                        {
                            sub += "0;";
                        }

                        if (varVal_o < threshold && varVal_m >= threshold)
                        {
                            stats_hod.miss += 1;
                            sub += "1;";
                        } else
                        {
                            sub += "0;";
                        }

                        if (varVal_o >= threshold && varVal_m >= threshold)
                        {
                            stats_hod.cn += 1;
                            sub += "1";
                        } else
                        {
                            sub += "0";
                        }
                        stats_hod.sub_data.push(sub);
                    }
                }
            }
            try
            {
                const stats_fcst_lead_summed = this.mmCommon.sumUpCtc(stats_hod);
                this.ctc.push(stats_fcst_lead_summed);
            } catch (ex)
            {
                console.log(ex);
            }
        }

        const endTime = new Date().valueOf();
        console.log(`generateCtc:` + ` in ${endTime - startTime} ms.`);
    };
}

export default matsMiddleValidTime = {
    MatsMiddleValidTime,
};
