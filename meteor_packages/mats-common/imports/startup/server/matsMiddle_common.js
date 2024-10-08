import { matsTypes, matsDataQueryUtils } from "meteor/randyp:mats-common";
import { Meteor } from "meteor/meteor";

class MatsMiddleCommon {
  cbPool = null;

  conn = null;

  constructor(cbPool) {
    this.cbPool = cbPool;
  }

  writeToLocalFile(filePath, contentStr) {
    const fs = require("fs");
    const homedir = require("os").homedir();
    fs.writeFileSync(homedir + filePath, contentStr);
  }

  get_fcstValidEpoch_Array = async (fromSecs, toSecs) => {
    console.log(`get_fcstValidEpoch_Array(${fromSecs},${toSecs})`);

    const fs = require("fs");
    this.conn = await cbPool.getConnection();

    const startTime = new Date().valueOf();

    let queryTemplate = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_distinct_fcstValidEpoch_obs.sql"
    );
    queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
    queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);
    console.log(`fromSecs:${fromSecs},toSecs:${toSecs}`);

    const qr_fcstValidEpoch = await this.conn.cluster.query(queryTemplate);

    const fcstValidEpoch_Array = [];
    for (let imfve = 0; imfve < qr_fcstValidEpoch.rows.length; imfve++) {
      fcstValidEpoch_Array.push(qr_fcstValidEpoch.rows[imfve].fcstValidEpoch);
    }
    const endTime = new Date().valueOf();
    console.log(
      `\tget_fcstValidEpoch_Array():${fcstValidEpoch_Array.length} in ${
        endTime - startTime
      } ms.`
    );

    return fcstValidEpoch_Array;
  };

  get_fcstLen_Array = async (model, fromSecs, toSecs) => {
    console.log(`get_fcstLen_Array(${model},${fromSecs},${toSecs})`);

    const fs = require("fs");
    this.conn = await cbPool.getConnection();

    const startTime = new Date().valueOf();

    let queryTemplate = Assets.getText(
      "imports/startup/server/matsMiddle/sqlTemplates/tmpl_get_distinct_fcstLen.sql"
    );
    queryTemplate = queryTemplate.replace(/{{vxMODEL}}/g, `"${model}"`);
    queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
    queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);
    console.log(`model:${model},fromSecs:${fromSecs},toSecs:${toSecs}`);

    const qr_distinct_fcstLen = await this.conn.cluster.query(queryTemplate);

    const fcstLenArray = [];
    for (let ifcstLen = 0; ifcstLen < qr_distinct_fcstLen.rows.length; ifcstLen++) {
      fcstLenArray.push(qr_distinct_fcstLen.rows[ifcstLen].fcstLen);
    }
    endTime = new Date().valueOf();
    console.log(
      `fcstLenArray:${qr_distinct_fcstLen.rows.length} in ${endTime - startTime} ms.`
    );

    return fcstLenArray;
  };

  sumUpCtc = (ctc) => {
    const rv = JSON.parse(JSON.stringify(ctc));

    rv.sub_data = [];

    let prevFve = null;
    const sumVals = [0, 0, 0, 0];
    for (let i = 0; i < ctc.sub_data.length; i += 1) {
      const sdiToks = ctc.sub_data[i].split(";");

      if (i === 0) {
        [prevFve] = sdiToks;
      }
      if (prevFve === sdiToks[0]) {
        sumVals[0] += Number(sdiToks[1]);
        sumVals[1] += Number(sdiToks[2]);
        sumVals[2] += Number(sdiToks[3]);
        sumVals[3] += Number(sdiToks[4]);
      } else {
        rv.sub_data.push(
          `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]}`
        );
        [prevFve] = sdiToks;
        sumVals[0] = Number(sdiToks[1]);
        sumVals[1] = Number(sdiToks[2]);
        sumVals[2] = Number(sdiToks[3]);
        sumVals[3] = Number(sdiToks[4]);
      }
      if (i === ctc.sub_data.length - 1) {
        rv.sub_data.push(
          `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]}`
        );
      }
    }
    return rv;
  };

  sumUpSums = (sum) => {
    const rv = JSON.parse(JSON.stringify(sum));

    rv.sub_data = [];

    let prevFve = null;
    const sumVals = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < sum.sub_data.length; i += 1) {
      const sdiToks = sum.sub_data[i].split(";");

      if (i === 0) {
        [prevFve] = sdiToks;
      }
      if (prevFve === sdiToks[0]) {
        sumVals[0] += Number(sdiToks[1]);
        sumVals[1] += Number(sdiToks[2]);
        sumVals[2] += Number(sdiToks[3]);
        sumVals[3] += Number(sdiToks[4]);
        sumVals[4] += Number(sdiToks[5]);
        sumVals[5] += Number(sdiToks[6]);
      } else {
        rv.sub_data.push(
          `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]};${sumVals[4]};${sumVals[5]}`
        );
        [prevFve] = sdiToks;
        sumVals[0] = Number(sdiToks[1]);
        sumVals[1] = Number(sdiToks[2]);
        sumVals[2] = Number(sdiToks[3]);
        sumVals[3] = Number(sdiToks[4]);
        sumVals[4] = Number(sdiToks[5]);
        sumVals[5] = Number(sdiToks[6]);
      }
      if (i === sum.sub_data.length - 1) {
        rv.sub_data.push(
          `${sdiToks[0]};${sumVals[0]};${sumVals[1]};${sumVals[2]};${sumVals[3]};${sumVals[4]};${sumVals[5]}`
        );
      }
    }
    return rv;
  };

  computeCtcForStations(
    fve,
    threshold,
    ctc,
    stationNames,
    obsSingleFve,
    modelSingleFve
  ) {
    for (let i = 0; i < stationNames.length; i += 1) {
      const station = stationNames[i];
      const varValO = obsSingleFve.stations[station];
      const varValM = modelSingleFve.stations[station];

      if (varValO && varValM) {
        ctc.n0 += 1;
        let sub = `${fve};`;
        if (varValO < threshold && varValM < threshold) {
          ctc.hit += 1;
          sub += "1;";
        } else {
          sub += "0;";
        }

        if (varValO >= threshold && varValM < threshold) {
          ctc.fa += 1;
          sub += "1;";
        } else {
          sub += "0;";
        }

        if (varValO < threshold && varValM >= threshold) {
          ctc.miss += 1;
          sub += "1;";
        } else {
          sub += "0;";
        }

        if (varValO >= threshold && varValM >= threshold) {
          ctc.cn += 1;
          sub += "1";
        } else {
          sub += "0";
        }
        ctc.sub_data.push(sub);
      }
    }
  }

  computeSumsForStations(fve, sums, stationNames, obsSingleFve, modelSingleFve) {
    for (let i = 0; i < stationNames.length; i += 1) {
      const station = stationNames[i];
      const varValO = obsSingleFve.stations[station];
      const varValM = modelSingleFve.stations[station];

      if (varValO && varValM) {
        const squareDiffSum = (varValO - varValM) ** 2;
        const nSum = 1;
        const obsModelDiffSum = varValO - varValM;
        const modelSum = varValM;
        const obsSum = varValO;
        const absSum = Math.abs(varValO - varValM);

        sums.n0 += 1;
        sums.square_diff_sum += squareDiffSum;
        sums.N_sum += nSum;
        sums.obs_model_diff_sum += obsModelDiffSum;
        sums.model_sum += modelSum;
        sums.obs_sum += obsSum;
        sums.abs_sum += absSum;

        const sub = `${fve};${squareDiffSum};${nSum};${obsModelDiffSum};${modelSum};${obsSum};${absSum};`;
        sums.sub_data.push(sub);
      }
    }
  }
}

export default matsMiddleCommon = {
  MatsMiddleCommon,
};
