const couchbase = require("couchbase");
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
    };

    const
    upsertCB = async (key, doc) => {
        try {
            const conn = await this.getConnection();
            const result = await conn.collection.upsert(key, doc, {
                expiry: 60,
                persist_to: 1
            });
            return result;
        } catch (err) {
            console.log("upsertCB ERROR: ", err);
            throw new Error("upsertCB ERROR: " + err);
        }
        return ret;
    };

    const
    removeCB = async (key) => {
        try {
            const conn = await this.getConnection();
            const result = await conn.collection.remove(key);
            return result;
        } catch (err) {
            console.log("removeCB ERROR: ", err);
            throw new Error("removeCB ERROR: " + err);
        }
    };

    const
    getCB = async (key) => {
        try {

            const conn = await this.getConnection();
            const result = await conn.collection.get(key);
            return result;
        } catch (err) {
            console.log("getCB ERROR: ", err);
            throw new Error("getCB ERROR: " + err);
        }
    };

    const
    queryCB = async (statement) => {
        try {
            const conn = await this.getConnection();
            const result = await conn.cluster.query(statement);
            return result;
        } catch (err) {
            console.log("queryCB ERROR: ", err);
            throw new Error("queryCB ERROR: " + err);
        }
    };

}
const test = async() => {
    const host = "adb-cb1.gsd.esrl.noaa.gov";
    const bucketName = "travel-sample";
    const user = "auser";
    const pwd = "apassword";
    cbUtilities = new CBUtilities(host, bucketName, user, pwd);

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
    CBUtilities: CBUtilities.constructor,
    test:test
}

