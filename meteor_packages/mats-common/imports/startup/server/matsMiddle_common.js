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

    let queryTemplate = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_distinct_fcstValidEpoch_obs.sql",
      "utf-8"
    );
    queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
    queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);
    console.log(`fromSecs:${fromSecs},toSecs:${toSecs}`);
    console.log(`queryTemplate:\n${queryTemplate}`);

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

    let queryTemplate = fs.readFileSync(
      "assets/app/matsMiddle/sqlTemplates/tmpl_get_distinct_fcstLen.sql",
      "utf-8"
    );
    queryTemplate = queryTemplate.replace(/{{vxMODEL}}/g, `"${model}"`);
    queryTemplate = queryTemplate.replace(/{{vxFROM_SECS}}/g, fromSecs);
    queryTemplate = queryTemplate.replace(/{{vxTO_SECS}}/g, toSecs);
    console.log(`model:${model},fromSecs:${fromSecs},toSecs:${toSecs}`);
    console.log(`queryTemplate:\n${queryTemplate}`);

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
    for (let i = 0; i < ctc.sub_data.length; i++) {
      const sdiToks = ctc.sub_data[i].split(";");

      if (i === 0) {
        prevFve = sdiToks[0];
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
        prevFve = sdiToks[0];
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
}

export default matsMiddleCommon = {
  MatsMiddleCommon,
};
