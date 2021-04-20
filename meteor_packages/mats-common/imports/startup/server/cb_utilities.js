import {Meteor} from "meteor/meteor";
class CBUtilities {
    constructor(host, bucketName, user, pwd) {
        this.host = host;
        this.bucketName = bucketName;
        this.user = user;
        this.pwd = pwd;
        this.conn = undefined;
    }

    const
    getConnection = async () => {
        // DO NOT require couchbase at the top of the file, the client breaks if it gets couchbase included into it.
        const couchbase = require("couchbase");
        try {
            if (this.conn == undefined || this.conn.cluster == undefined) {
                const cluster = await couchbase.connect("couchbase://" + this.host, {
                    username: this.user,
                    password: this.pwd
                });
                const bucket = cluster.bucket(this.bucketName);
                const collection = bucket.defaultCollection();
                this.conn = {cluster: cluster, bucket: bucket, collection: collection};
            }
            return this.conn;
        } catch (err) {
            console.log("CBUtilities.getConnection ERROR: " + err);
            throw new Meteor.Error("CBUtilities.getConnection ERROR: " + err);
        }
    };

    const
    upsertCB = async (key, doc) => {
        const couchbase = require("couchbase");
        try {
            const conn = await this.getConnection();
            const result = await conn.collection.upsert(key, doc, {
                expiry: 60,
                persist_to: 1
            });
            return result;
        } catch (err) {
            console.log("upsertCB ERROR: ", err);
            throw new Meteor.Error("upsertCB ERROR: " + err);
        }
        return ret;
    };

    const
    removeCB = async (key) => {
        const couchbase = require("couchbase");
        try {
            const conn = await this.getConnection();
            const result = await conn.collection.remove(key);
            return result;
        } catch (err) {
            console.log("removeCB ERROR: ", err);
            throw new Meteor.Error("removeCB ERROR: " + err);
        }
    };

    const
    getCB = async (key) => {
        const couchbase = require("couchbase");
        try {
            const conn = await this.getConnection();
            const result = await conn.collection.get(key);
            return result;
        } catch (err) {
            console.log("getCB ERROR: ", err);
            throw new Meteor.Error("getCB ERROR: " + err);
        }
    };

    const
    queryCB = async (statement) => {
        const couchbase = require("couchbase");
        try {
            const conn = await this.getConnection();
            const result = await conn.cluster.query(statement);
            return result.rows;
        } catch (err) {
            console.log("queryCB ERROR: ", err);
            throw new Meteor.Error("queryCB ERROR: " + err);
        }
    };

    const
    searchStationsByBoundingBox = async (topleft_lon, topleft_lat, bottomright_lon, bottomright_lat) => {
        const couchbase = require("couchbase");
        const index = 'station_geo';
        try {
            const conn = await this.getConnection();
            var geoBoundingBoxQuery = couchbase.SearchQuery.geoBoundingBox(topleft_lon, topleft_lat, bottomright_lon, bottomright_lat);
            var results = await conn.cluster.searchQuery(index, geoBoundingBoxQuery, {fields: ["*"], limit: 10000});
            return results.rows;
        } catch (err) {
            console.log("searchStationsByBoundingBox ERROR: ", err);
            throw new Meteor.Error("searchStationsByBoundingBox ERROR: " + err);
        }
    }
}

const test = async () => {
    const host = "adb-cb1.gsd.esrl.noaa.gov";
    const bucketName = "travel-sample";
    const user = "auser";
    const pwd = "apassword";
    const cbUtilities = new CBUtilities(host, bucketName, user, pwd);

    const airline = {
        type: "airline",
        id: 8091,
        callsign: "CBS",
        iata: null,
        icao: null,
        name: "Couchbase Airways",
    };
    const key = `${airline.type}_${airline.id}`;
    const statement = "select * from `travel-sample` where meta().id = '" + key + "';"

    const ret = await cbUtilities.upsertCB(key, airline)
    console.log("upsertCB: ", ret);

    const ret1 = await cbUtilities.getCB(key)
    console.log("getCB: ", ret1);

    const ret2 = await cbUtilities.queryCB(statement)
    console.log("queryCB: ", ret2.rows);

    const ret3 = await cbUtilities.removeCB(key)
    console.log("deleteCB: ", ret3);

    process.exit();
}

export default matsCouchbaseUtils = {
    CBUtilities: CBUtilities,
    test: test
}
