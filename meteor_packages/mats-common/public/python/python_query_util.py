import getopt
import sys
import pymysql
import pymysql.cursors
import numpy as np
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


class QueryUtil:
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

    def query_db(self, cursor, query_array):
        """function for querying the database and sending the returned data to the parser"""
        idx = 0
        return_obj = {"data": self.data, "error": self.error, "n0": self.n0, "nTimes": self.nTimes}
        for query in query_array:
            statement = query["statement"]
            results_full = []
            try:
                if query["appParams"]["plotType"] == 'SimpleScatter':
                    # there are two queries
                    cursor.execute(statement[0])
                    results_x = cursor.fetchall()
                    cursor.execute(statement[1])
                    results_y = cursor.fetchall()

                    #combine the results
                    current_y = 0
                    for result_x in results_x:
                        bin_val = result_x["binVal"]
                        for idx_y in range(current_y, len(results_y)):
                            result_y = results_y[idx_y]
                            if bin_val == result_y["binVal"]:
                                result_full = copy.deepcopy(result_x)
                                result_full["nY"] = result_y["nY"]
                                result_full["fbarY"] = result_y["fbarY"]
                                result_full["obarY"] = result_y["obarY"]
                                result_full["sub_dataY"] = result_y["sub_dataY"]
                                results_full.append(result_full)
                                current_y = idx_y + 1
                                break
                else:
                    cursor.execute(statement)
            except pymysql.Error as e:
                self.error[idx] = "Error executing query: " + str(e)
            else:
                if cursor.rowcount == 0:
                    self.error[idx] = "INFO:0 data records found"
                else:
                    if query["appParams"]["plotType"] == 'Histogram':
                        return_obj = parse_query_data_histogram(idx, cursor.fetchall(), query["statLineType"], query["statistic"],
                                                        query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'Contour':
                        return_obj = parse_query_data_contour(idx, cursor.fetchall(), query["statLineType"], query["statistic"],
                                                      query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'SimpleScatter':
                        return_obj = parse_query_data_simple_scatter(idx, results_full, query["statLineType"], query["statistic"],
                                                             query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'Reliability' or query["appParams"]["plotType"] == 'ROC' or \
                            query["appParams"]["plotType"] == 'PerformanceDiagram':
                        return_obj = parse_query_data_ensemble(idx, cursor.fetchall(), query["appParams"], return_obj)
                    elif query["appParams"]["plotType"] == 'EnsembleHistogram':
                        return_obj = parse_query_data_ensemble_histogram(idx, cursor.fetchall(), query["statLineType"],
                                                                 query["statistic"], query["appParams"], return_obj)
                    else:
                        return_obj = parse_query_data_xy_curve(idx, cursor.fetchall(), query["statLineType"], query["statistic"],
                                                       query["appParams"], query["fcstOffset"], query["vts"], return_obj)
            idx = idx + 1

        self.data = return_obj["data"]
        self.error = return_obj["error"]
        self.n0 = return_obj["n0"]
        self.nTimes = return_obj["nTimes"]

    def validate_options(self, options):
        """makes sure all expected options were indeed passed in"""
        assert True, options.host is not None and options.port is not None and options.user is not None \
                     and options.password is not None and options.database is not None \
                     and options.query_array is not None

    def get_options(self, args):
        """process 'c' style options - using getopt - usage describes options"""
        usage = ["(h)ost=", "(P)ort=", "(u)ser=", "(p)assword=", "(d)atabase=", "(t)imeout=", "(q)uery_array="]
        host = None
        port = None
        user = None
        password = None
        database = None
        timeout = 300
        query_array = None

        try:
            opts, args = getopt.getopt(args[1:], "h:p:u:P:d:t:q:", usage)
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
            elif o == "-P":
                port = int(a)
            elif o == "-u":
                user = a
            elif o == "-p":
                password = a
            elif o == "-d":
                database = a
            elif o == "-t":
                timeout = int(a)
            elif o == "-q":
                query_array = json.loads(a)
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, host is not None and port is not None and user is not None and password is not None \
                     and database is not None and query_array is not None
        options = {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database,
            "timeout": timeout,
            "query_array": query_array
        }
        return options

    def do_query(self, options):
        """function for validating options and passing them to the query function"""
        self.validate_options(options)
        cnx = pymysql.Connect(host=options["host"], port=options["port"], user=options["user"],
                              passwd=options["password"],
                              db=options["database"], charset='utf8',
                              cursorclass=pymysql.cursors.DictCursor)
        with closing(cnx.cursor()) as cursor:
            cursor.execute('set group_concat_max_len = 4294967295')
            cursor.execute('set session wait_timeout = ' + str(options["timeout"]))
            self.query_db(cursor, options["query_array"])
        cnx.close()


if __name__ == '__main__':
    qutil = QueryUtil()
    options = qutil.get_options(sys.argv)
    qutil.set_up_output_fields(len(options["query_array"]))
    qutil.do_query(options)
    if options["query_array"][0]["appParams"]["matching"]:
        return_obj = do_matching(options, {"data": qutil.data, "error": qutil.error, "n0": qutil.n0, "nTimes": qutil.nTimes})
        qutil.data = return_obj["data"]
        qutil.error = return_obj["error"]
        qutil.n0 = return_obj["n0"]
        qutil.nTimes = return_obj["nTimes"]
    qutil.construct_output_json(options["query_array"][0]["appParams"]["plotType"], options["query_array"])
    print(qutil.output_JSON)
