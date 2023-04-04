class CBUtilities
{
  constructor(host, bucketName, scope, collection, user, pwd)
  {
    this.host = host;
    this.bucketName = bucketName;
    this.scope = scope;
    this.collection = collection;
    this.user = user;
    this.pwd = pwd;
    this.conn = undefined;
  }

  getConnection = async () =>
  {
    // DO NOT require couchbase at the top of the file, the client breaks if it gets couchbase included into it.
    const couchbase = require("couchbase");
    try {
      if (!this.conn || !this.conn.cluster) {
        // set query timeout to 10 minutes -- we have some long data ones
        // const cluster = await couchbase.connect("couchbase://" + this.host, {
        const cluster = await couchbase.connect(this.host, {
          username: this.user,
          password: this.pwd,
          timeouts: {
            kvTimeout: 3600000, // this will kill queries after an hour
            queryTimeout: 3600000
          }
        });
        const bucket = cluster.bucket(this.bucketName);
        // const collection = bucket.defaultCollection();
        const collection = bucket.scope(this.scope).collection(this.collection);
        this.conn = { cluster: cluster, bucket: bucket, collection: collection };
      }
      return this.conn;
    } catch (err)
    {
      console.log("CBUtilities.getConnection ERROR: " + err);
      throw new Error("CBUtilities.getConnection ERROR: " + err);
    }
  };

  closeConnection = async () =>
  {
    console.log("closing couchbase connection to: " + this.host);
    if (this.conn)
    {
      this.conn.cluster.close();
    }
  }

  upsertCB = async (key, doc) =>
  {
    const couchbase = require("couchbase");
    try
    {
      const conn = await this.getConnection();
      const result = await conn.collection.upsert(key, doc);
      return result;
    } catch (err)
    {
      console.log("upsertCB ERROR: ", err);
      throw new Error("upsertCB ERROR: " + err);
    }
  };

  removeCB = async (key) =>
  {
    const couchbase = require("couchbase");
    try
    {
      const conn = await this.getConnection();
      const result = await conn.collection.remove(key);
      return result;
    } catch (err)
    {
      console.log("removeCB ERROR: ", err);
      throw new Error("removeCB ERROR: " + err);
    }
  };

  getCB = async (key) =>
  {
    const couchbase = require("couchbase");
    try
    {
      const conn = await this.getConnection();
      const result = await conn.collection.get(key);
      return result;
    } catch (err)
    {
      console.log("getCB ERROR: ", err);
      throw new Error("getCB ERROR: " + err);
    }
  };

  queryCB = async (statement) =>
  {
    const couchbase = require("couchbase");
    try {
      const conn = await this.getConnection();
      const result = await conn.cluster.query(statement);
      return result.rows;
    } catch (err)
    {
      return "queryCB ERROR: " + err;
    }
  };

  queryCBWithConsistency = async (statement) => {
    const couchbase = require("couchbase");
    try {
      const conn = await this.getConnection();
      const result = await conn.cluster.query(statement, {
        scanConsistency: couchbase.QueryScanConsistency.RequestPlus,
      });
      return result.rows;
    } catch (err) {
      return "queryCBWithConsistency ERROR: " + err;
    }
  };

  searchStationsByBoundingBox = async (topleft_lon, topleft_lat, bottomright_lon, bottomright_lat) => {
    const couchbase = require("couchbase");
    const index = 'station_geo';
    try
    {
      const conn = await this.getConnection();
      var geoBoundingBoxQuery = couchbase.SearchQuery.geoBoundingBox(topleft_lon, topleft_lat, bottomright_lon, bottomright_lat);
      var results = await conn.cluster.searchQuery(index, geoBoundingBoxQuery, { fields: ["*"], limit: 10000 });
      return results.rows;
    } catch (err)
    {
      console.log("searchStationsByBoundingBox ERROR: ", err);
      throw new Error("searchStationsByBoundingBox ERROR: " + err);
    }
  };

  trfmSQLForDbTarget = (sqlstr) =>
  {
    var val = sqlstr.replace(/vxBUCKET/g, this.bucket);
    val = val.replace(/vxSCOPE/g, this.scope);
    val = val.replace(/vxCOLLECTION/g, this.collection);
    val = val.replace(/vxDBTARGET/g, this.bucketName + "." + this.scope + "." + this.collection);
    return val;
  };

  trfmListToCSVString = (listVals, prefix, doQuotes) =>
  {
    var newArr = listVals;
    if (prefix)
    {
      newArr = listVals.map(i => prefix + i);
    }
    var rv = "";
    if (doQuotes)
    {
      rv = "'" + newArr.join("','") + + "'";
    }
    else
    {
      rv = newArr;
    }
    return rv;
  };

  // Gopa - this is a trivial implenentation that asssumes that the clause in
  // question is all in a single line, could use improvement
  trfmSQLRemoveClause = (sqlstr, clauseFragment) =>
  {
    var lines = sqlstr.split('\n');
    var rv = "";
    for (var i = 0; i < lines.length; i++)
    {
      if (false == lines[i].includes(clauseFragment))
      {
        rv = rv + lines[i] + "\n";
      }
    }
    return rv;
  }
}

test = async () =>
{
}

export default matsCouchbaseUtils = {
  CBUtilities: CBUtilities,
  test: test
}

