import getopt
import sys
from couchbase.cluster import Cluster
from couchbase.options import ClusterOptions, QueryOptions, ClusterTimeoutOptions
from couchbase.auth import PasswordAuthenticator
from couchbase.exceptions import CouchbaseException
from datetime import timedelta
import numpy as np
import math
import json
import copy
from contextlib import closing
from parse_query_data import parse_query_data_xy_curve, \
    parse_query_data_histogram, parse_query_data_ensemble, \
        parse_query_data_ensemble_histogram, parse_query_data_contour, \
            parse_query_data_simple_scatter, do_matching

class NpEncoder(json.JSONEncoder):
    """class that hopefully allows JSON to encode numpy types"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)


class CBQueryUtil:
    """class that contains all of the tools necessary for querying the db and calculating statistics from the
    returned data. In the future, we plan to split this into two classes, one for querying and one for statistics."""
    error = []  # one of the four fields to return at the end -- records any error message
    n0 = []  # one of the four fields to return at the end -- number of sub_values for each independent variable
    nTimes = []  # one of the four fields to return at the end -- number of sub_secs for each independent variable
    data = []  # one of the four fields to return at the end -- the parsed data structure
    output_JSON = {}  # JSON structure to pass the five output fields back to the MATS JS

    def set_up_output_fields(self, number_of_curves):
        """function for creating an output object for each curve"""
        for i in range(0, number_of_curves):
            self.data.append({
                "x": [],
                "y": [],
                "z": [],
                "n": [],
                "binVals": [],
                "error_x": [],
                "error_y": [],
                "subData": [],
                "subHeaders": [],
                "subVals": [],
                "subSecs": [],
                "subLevs": [],
                "subDataX": [],
                "subHeadersX": [],
                "subValsX": [],
                "subSecsX": [],
                "subLevsX": [],
                "subDataY": [],
                "subHeadersY": [],
                "subValsY": [],
                "subSecsY": [],
                "subLevsY": [],
                "subInterest": [],
                "subHit": [],
                "subFa": [],
                "subMiss": [],
                "subCn": [],
                "stats": [],
                "text": [],
                "xTextOutput": [],
                "yTextOutput": [],
                "zTextOutput": [],
                "nTextOutput": [],
                "hitTextOutput": [],
                "faTextOutput": [],
                "missTextOutput": [],
                "cnTextOutput": [],
                "minDateTextOutput": [],
                "maxDateTextOutput": [],
                "threshold_all": [],
                "oy_all": [],
                "on_all": [],
                "nForecast": [],
                "nMatched": [],
                "nSimple": [],
                "nTotal": [],
                "sample_climo": 0,
                "auc": 0,
                "glob_stats": {
                    "mean": 0,
                    "minDate": 0,
                    "maxDate": 0,
                    "n": 0
                },
                "bin_stats": [],
                "xmin": sys.float_info.max,
                "xmax": -1 * sys.float_info.max,
                "ymin": sys.float_info.max,
                "ymax": -1 * sys.float_info.max,
                "zmin": sys.float_info.max,
                "zmax": -1 * sys.float_info.max,
                "sum": 0
            })
            self.n0.append([])
            self.nTimes.append([])
            self.error.append("")

    def construct_output_json(self, plot_type, queries):
        """function for constructing and jsonifying a dictionary of the output variables"""
        for i in range(len(self.data)):
            stat_line_type = queries[i]["statLineType"]
            # only save relevant sub-data
            if plot_type in ['ValidTime', 'GridScale', 'Profile', 'DailyModelCycle', 'TimeSeries',
                             'Dieoff', 'Threshold', 'YearToYear']:
                if stat_line_type == 'mode_pair':
                    for j in range(len(self.data[i]["subData"])):
                        if self.data[i]["subHeaders"][j] == 'NaN' or len(self.data[i]["subHeaders"][j]) == 0:
                            self.data[i]["subInterest"].append('NaN')
                        else:
                            try:
                                interest_idx = self.data[i]["subHeaders"][j].index('interest')
                                self.data[i]["subInterest"].append([float(a[interest_idx]) for a in self.data[i]["subData"][j]])
                            except Exception as e:
                                self.data[i]["subInterest"].append('NaN')
                elif stat_line_type == 'mode_single':
                    for j in range(len(self.data[i]["subData"])):
                        if self.data[i]["subHeaders"][j] == 'NaN' or len(self.data[i]["subHeaders"][j]) == 0:
                            self.data[i]["nForecast"].append(0)
                            self.data[i]["nMatched"].append(0)
                            self.data[i]["nSimple"].append(0)
                            self.data[i]["nTotal"].append(0)
                        else:
                            try:
                                forecast_idx = self.data[i]["subHeaders"][j].index('fcst_flag')
                                matched_idx = self.data[i]["subHeaders"][j].index('matched_flag')
                                simple_idx = self.data[i]["subHeaders"][j].index('simple_flag')
                                self.data[i]["nForecast"].append(sum([int(a[forecast_idx]) for a in self.data[i]["subData"][j]]))
                                self.data[i]["nMatched"].append(sum([int(a[matched_idx]) for a in self.data[i]["subData"][j]]))
                                self.data[i]["nSimple"].append(sum([int(a[simple_idx]) for a in self.data[i]["subData"][j]]))
                                self.data[i]["nTotal"].append(len([int(a[forecast_idx]) for a in self.data[i]["subData"][j]]))
                            except Exception as e:
                                self.data[i]["nForecast"].append(0)
                                self.data[i]["nMatched"].append(0)
                                self.data[i]["nSimple"].append(0)
                                self.data[i]["nTotal"].append(0)
                elif stat_line_type == 'ctc':
                    for j in range(len(self.data[i]["subData"])):
                        if self.data[i]["subHeaders"][j] == 'NaN' or len(self.data[i]["subHeaders"][j]) == 0:
                            self.data[i]["subHit"].append('NaN')
                            self.data[i]["subFa"].append('NaN')
                            self.data[i]["subMiss"].append('NaN')
                            self.data[i]["subCn"].append('NaN')
                        else:
                            try:
                                hit_idx = self.data[i]["subHeaders"][j].index('fy_oy')
                                fa_idx = self.data[i]["subHeaders"][j].index('fy_on')
                                miss_idx = self.data[i]["subHeaders"][j].index('fn_oy')
                                cn_idx = self.data[i]["subHeaders"][j].index('fn_on')
                                self.data[i]["subHit"].append([int(a[hit_idx]) for a in self.data[i]["subData"][j]])
                                self.data[i]["subFa"].append([int(a[fa_idx]) for a in self.data[i]["subData"][j]])
                                self.data[i]["subMiss"].append([int(a[miss_idx]) for a in self.data[i]["subData"][j]])
                                self.data[i]["subCn"].append([int(a[cn_idx]) for a in self.data[i]["subData"][j]])
                            except Exception as e:
                                self.data[i]["subHit"].append('NaN')
                                self.data[i]["subFa"].append('NaN')
                                self.data[i]["subMiss"].append('NaN')
                                self.data[i]["subCn"].append('NaN')

            self.data[i]["subHeaders"] = []
            self.data[i]["subData"] = []

        self.output_JSON = {
            "data": self.data,
            "n0": self.n0,
            "nTimes": self.nTimes,
            "error": self.error
        }
        self.output_JSON = json.dumps(self.output_JSON, cls=NpEncoder)


    def get_date_array(self, from_secs, to_secs, vts):
        date_array = list(range(math.floor(int(from_secs) / 3600) * 3600, (math.ceil(int(to_secs) / 3600) * 3600) + 3600, 3600))
        if date_array[0] < int(from_secs):
            date_array.pop(0)
        if date_array[len(date_array) - 1] > int(to_secs):
            date_array.pop()
        if len(vts):
            refined_date_array = []
            for date in date_array:
                add = False
                for vt in vts:
                    if (date % (24 * 3600)) / 3600 == int(vt):
                        add = True
                        break
                if add:
                    refined_date_array.append(date)
            date_array = refined_date_array
        return date_array


    def get_doc_IDs(self, doc_ID_template, versions, date_array, storms):
        these_doc_IDs = []
        for version in versions:
            versioned_doc_ID = copy.deepcopy(doc_ID_template)
            versioned_doc_ID = versioned_doc_ID.replace("{{version}}", version)
            for date in date_array:
                dated_doc_ID = copy.deepcopy(versioned_doc_ID)
                dated_doc_ID = dated_doc_ID.replace("{{date}}", str(date))
                if len(storms):
                    for storm in storms:
                        if (storm != "All storms"):
                            stormed_doc_ID = copy.deepcopy(dated_doc_ID)
                            stormed_doc_ID = stormed_doc_ID.replace("{{stormID}}", storm.split("-")[0])
                            stormed_doc_ID = stormed_doc_ID.replace("{{stormName}}", storm.split("-")[1])
                            stormed_doc_ID = stormed_doc_ID.replace("{{stormNumber}}", storm[2:4])
                            these_doc_IDs.append(stormed_doc_ID)
                else:
                    these_doc_IDs.append(dated_doc_ID)
                
        return these_doc_IDs


    def query_db(self, cluster, query_array):
        """function for querying the database and sending the returned data to the parser"""
        idx = 0
        return_obj = {"data": self.data, "error": self.error, "n0": self.n0, "nTimes": self.nTimes}
        for query in query_array:
            stat_field = query["statField"]
            statement = query["statement"]
            doc_ID_template = query["docIDTemplate"]
            from_secs = query["fromSecs"]
            to_secs = query["toSecs"]
            vts = query["vts"].replace("'", "").split(",")
            fcsts = query["fcsts"]
            levels = query["levels"]
            versions = query["versions"]
            storms = query["storms"]

            date_array = self.get_date_array(from_secs, to_secs, vts)
            doc_IDs = self.get_doc_IDs(doc_ID_template, versions, date_array, storms)
            statement = statement.replace("{{docIDTemplate}}", json.dumps(doc_IDs))

            try:
                result = cluster.query(statement, QueryOptions(metrics=True))
                rows = result.rows()
            except CouchbaseException as e:
                self.error[idx] = "Error executing query: " + str(e)
            else:
                parsed_rows = []
                for row in rows:
                    parsed_row = {
                        "avtime": row["avtime"],
                        "nTimes": 0,
                        "min_secs": sys.float_info.max,
                        "max_secs": sys.float_info.min,
                        "stat": "null",
                        "sub_data": np.nan,
                    }
                    sub_data = ""
                    sub_secs = set()
                    for datum in row["data"]:
                        for forecast in fcsts:
                            if forecast in datum[2] and datum[2][forecast]["level"] in levels and stat_field in datum[2][forecast]:
                                data_snippet = str(datum[2][forecast][stat_field]) + ";9999;" + str(datum[0]) + ";" + datum[1]
                                if len(sub_data):
                                    sub_data = sub_data + "," + data_snippet
                                else:
                                    sub_data = data_snippet
                                sub_secs.add(int(datum[0]))
                    
                    if len(sub_data):
                        parsed_row["nTimes"] = len(sub_secs)
                        parsed_row["min_secs"] = min(sub_secs)
                        parsed_row["max_secs"] = max(sub_secs)
                        parsed_row["stat"] = 0 # dummy value, change from null to number to show that we do have a result, though
                        parsed_row["sub_data"] = sub_data
                        parsed_rows.append(parsed_row)

                if len(parsed_rows):
                    if query["appParams"]["plotType"] == 'Histogram':
                        return_obj = parse_query_data_histogram(idx, parsed_rows, query["statLineType"], query["statistic"],
                                                        query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'Contour':
                        return_obj = parse_query_data_contour(idx, parsed_rows, query["statLineType"], query["statistic"],
                                                      query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'SimpleScatter':
                        return_obj = parse_query_data_simple_scatter(idx, parsed_rows, query["statLineType"], query["statistic"],
                                                             query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'Reliability' or query["appParams"]["plotType"] == 'ROC' or \
                            query["appParams"]["plotType"] == 'PerformanceDiagram':
                        return_obj = parse_query_data_ensemble(idx, parsed_rows, query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'EnsembleHistogram':
                        return_obj = parse_query_data_ensemble_histogram(idx, parsed_rows, query["statLineType"],
                                                                 query["statistic"], query["appParams"], return_obj)
                    else:
                        return_obj = parse_query_data_xy_curve(idx, parsed_rows, query["statLineType"], query["statistic"],
                                                       query["appParams"], query["fcsts"], query["vts"], return_obj)
                else:
                    self.error[idx] = "INFO:0 data records found"

            idx = idx + 1

        self.data = return_obj["data"]
        self.error = return_obj["error"]
        self.n0 = return_obj["n0"]
        self.nTimes = return_obj["nTimes"]

    def validate_options(self, options):
        """makes sure all expected options were indeed passed in"""
        assert True, options.host is not None and options.user is not None and options.password is not None \
                and options.bucket is not None and options.scope is not None and options.collection is not None \
                and options.query_array is not None

    def get_options(self, args):
        """process 'c' style options - using getopt - usage describes options"""
        usage = ["(h)ost=", "(u)ser=", "(p)assword=", "(b)ucket=", "(s)cope=", "(c)ollection=", "(q)uery_array="]
        host = None
        user = None
        password = None
        bucket = None
        scope = None
        collection = None
        query_array = None

        try:
            opts, args = getopt.getopt(args[1:], "h:u:p:b:s:c:q:", usage)
        except getopt.GetoptError as err:
            # print help information and exit:
            print(str(err))  # will print something like "option -a not recognized"
            print(usage)  # print usage from last param to getopt
            sys.exit(2)
        for o, a in opts:
            if o == "-?":
                print(usage)
                sys.exit(2)
            if o == "-h":
                host = a
            elif o == "-u":
                user = a
            elif o == "-p":
                password = a
            elif o == "-b":
                bucket = a
            elif o == "-s":
                scope = a
            elif o == "-c":
                collection = a
            elif o == "-q":
                query_array = json.loads(a)
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, host is not None and user is not None and password is not None \
                and bucket is not None and scope is not None and collection is not None \
                and query_array is not None
        options = {
            "host": host,
            "user": user,
            "password": password,
            "bucket": bucket,
            "scope": scope,
            "collection": collection,
            "query_array": query_array
        }
        return options

    def do_query(self, options):
        """function for validating options and passing them to the query function"""
        self.validate_options(options)
        pa = PasswordAuthenticator(options["user"], options["password"])
        timeout_opts = ClusterTimeoutOptions(kv_timeout=timedelta(seconds=3600),
                            query_timeout=timedelta(seconds=3600))
        cluster = Cluster(options["host"], ClusterOptions(pa, timeout_options=timeout_opts))
        self.query_db(cluster, options["query_array"])


if __name__ == '__main__':
    cbqutil = CBQueryUtil()
    options = cbqutil.get_options(sys.argv)
    cbqutil.set_up_output_fields(len(options["query_array"]))
    cbqutil.do_query(options)
    if options["query_array"][0]["appParams"]["matching"]:
        return_obj = do_matching(options, {"data": cbqutil.data, "error": cbqutil.error, "n0": cbqutil.n0, "nTimes": cbqutil.nTimes})
        cbqutil.data = return_obj["data"]
        cbqutil.error = return_obj["error"]
        cbqutil.n0 = return_obj["n0"]
        cbqutil.nTimes = return_obj["nTimes"]
    cbqutil.construct_output_json(options["query_array"][0]["appParams"]["plotType"], options["query_array"])
    print(cbqutil.output_JSON)
