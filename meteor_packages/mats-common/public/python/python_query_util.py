import getopt
import sys
import pymysql
import pymysql.cursors
import math
import numpy as np
import re
import json
from contextlib import closing
from scalar_stats import calculate_scalar_stat
from vector_stats import calculate_vector_stat
from ctc_stats import calculate_ctc_stat
from mode_stats import calculate_mode_stat


# class that contains all of the tools necessary for querying the db and calculating statistics from the
# returned data. In the future, we plan to split this into two classes, one for querying and one for statistics.
class QueryUtil:
    error = ""  # one of the four fields to return at the end -- records any error message
    n0 = []  # one of the four fields to return at the end -- number of sub_values for each independent variable
    n_times = []  # one of the four fields to return at the end -- number of sub_secs for each independent variable
    data = {  # one of the four fields to return at the end -- the parsed data structure
        "x": [],
        "y": [],
        "z": [],
        "n": [],
        "error_x": [],
        "error_y": [],
        "subHit": [],
        "subFa": [],
        "subMiss": [],
        "subCn": [],
        "subVals": [],
        "subSecs": [],
        "subLevs": [],
        "subInterest": [],
        "subPairFid": [],
        "subPairOid": [],
        "subModeHeaderId": [],
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
        "sample_climo": 0,
        "auc": 0,
        "glob_stats": {
            "mean": 0,
            "minDate": 0,
            "maxDate": 0,
            "n": 0
        },
        "bin_stats": [],
        "individualObjLookup": [],
        "xmin": sys.float_info.max,
        "xmax": -1 * sys.float_info.max,
        "ymin": sys.float_info.max,
        "ymax": -1 * sys.float_info.max,
        "zmin": sys.float_info.max,
        "zmax": -1 * sys.float_info.max,
        "sum": 0
    }
    output_JSON = {}  # JSON structure to pass the five output fields back to the MATS JS

    # function for constructing and jsonifying a dictionary of the output variables
    def construct_output_json(self):
        self.output_JSON = {
            "data": self.data,
            "N0": self.n0,
            "N_times": self.n_times,
            "error": self.error
        }
        self.output_JSON = json.dumps(self.output_JSON)

    # function to check if a certain value is a float or int
    def is_number(self, s):
        try:
            if np.isnan(s) or np.isinf(s):
                return False
        except TypeError:
            return False
        try:
            float(s)
            return True
        except ValueError:
            return False

    # function for processing the sub-values from the query and calling a calculate_stat function
    def get_stat(self, has_levels, row, statistic, stat_line_type, object_row):
        # these are the sub-fields that are returned in the end
        sub_levs = []
        sub_secs = []
        sub_values = np.empty(0)
        sub_interests = np.empty(0)
        sub_pair_fids = np.empty(0)
        sub_pair_oids = np.empty(0)
        sub_mode_header_ids = np.empty(0)
        try:
            # get all of the sub-values for each time
            if stat_line_type == 'scalar':
                sub_data = str(row['sub_data']).split(',')
                # these are the sub-fields specific to scalar stats
                sub_fbar = []
                sub_obar = []
                sub_ffbar = []
                sub_oobar = []
                sub_fobar = []
                sub_total = []
                for sub_datum in sub_data:
                    sub_datum = sub_datum.split(';')
                    sub_fbar.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                    sub_obar.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                    sub_ffbar.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                    sub_oobar.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                    sub_fobar.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                    sub_total.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                    sub_secs.append(float(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                    if has_levels:
                        if self.is_number(sub_datum[7]):
                            sub_levs.append(int(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                        else:
                            sub_levs.append(sub_datum[7])
                sub_fbar = np.asarray(sub_fbar)
                sub_obar = np.asarray(sub_obar)
                sub_ffbar = np.asarray(sub_ffbar)
                sub_oobar = np.asarray(sub_oobar)
                sub_fobar = np.asarray(sub_fobar)
                sub_total = np.asarray(sub_total)
                sub_secs = np.asarray(sub_secs)
                if len(sub_levs) == 0:
                    sub_levs = np.empty(len(sub_secs))
                else:
                    sub_levs = np.asarray(sub_levs)
                # calculate the scalar statistic
                sub_values, stat, stat_error = calculate_scalar_stat(statistic, sub_fbar, sub_obar, sub_ffbar,
                                                                     sub_oobar, sub_fobar, sub_total)
                if stat_error != '':
                    self.error = stat_error

            elif stat_line_type == 'vector':
                sub_data = str(row['sub_data']).split(',')
                # these are the sub-fields specific to vector stats
                sub_ufbar = []
                sub_vfbar = []
                sub_uobar = []
                sub_vobar = []
                sub_uvfobar = []
                sub_uvffbar = []
                sub_uvoobar = []
                sub_f_speed_bar = []
                sub_o_speed_bar = []
                sub_total = []
                for sub_datum in sub_data:
                    sub_datum = sub_datum.split(';')
                    sub_ufbar.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                    sub_vfbar.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                    sub_uobar.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                    sub_vobar.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                    sub_uvfobar.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                    sub_uvffbar.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                    sub_uvoobar.append(float(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                    if "ACC" not in statistic:
                        sub_f_speed_bar.append(float(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                        sub_o_speed_bar.append(float(sub_datum[8]) if float(sub_datum[8]) != -9999 else np.nan)
                        sub_total.append(float(sub_datum[9]) if float(sub_datum[9]) != -9999 else np.nan)
                        sub_secs.append(float(sub_datum[10]) if float(sub_datum[10]) != -9999 else np.nan)
                        if has_levels:
                            if self.is_number(sub_datum[11]):
                                sub_levs.append(int(sub_datum[11]) if float(sub_datum[11]) != -9999 else np.nan)
                            else:
                                sub_levs.append(sub_datum[11])
                    else:
                        sub_total.append(float(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                        sub_secs.append(float(sub_datum[8]) if float(sub_datum[8]) != -9999 else np.nan)
                        if has_levels:
                            if self.is_number(sub_datum[9]):
                                sub_levs.append(int(sub_datum[9]) if float(sub_datum[9]) != -9999 else np.nan)
                            else:
                                sub_levs.append(sub_datum[9])
                sub_ufbar = np.asarray(sub_ufbar)
                sub_vfbar = np.asarray(sub_vfbar)
                sub_uobar = np.asarray(sub_uobar)
                sub_vobar = np.asarray(sub_vobar)
                sub_uvfobar = np.asarray(sub_uvfobar)
                sub_uvffbar = np.asarray(sub_uvffbar)
                sub_uvoobar = np.asarray(sub_uvoobar)
                sub_f_speed_bar = np.asarray(sub_f_speed_bar)
                sub_o_speed_bar = np.asarray(sub_o_speed_bar)
                sub_total = np.asarray(sub_total)
                sub_secs = np.asarray(sub_secs)
                if len(sub_levs) == 0:
                    sub_levs = np.empty(len(sub_secs))
                else:
                    sub_levs = np.asarray(sub_levs)
                # calculate the scalar statistic
                sub_values, stat, stat_error = calculate_vector_stat(statistic, sub_ufbar, sub_vfbar, sub_uobar,
                                                                     sub_vobar, sub_uvfobar, sub_uvffbar, sub_uvoobar,
                                                                     sub_f_speed_bar, sub_o_speed_bar, sub_total)
                if stat_error != '':
                    self.error = stat_error

            elif stat_line_type == 'ctc':
                sub_data = str(row['sub_data']).split(',')
                # these are the sub-fields specific to ctc stats
                sub_fy_oy = []
                sub_fy_on = []
                sub_fn_oy = []
                sub_fn_on = []
                sub_total = []
                for sub_datum in sub_data:
                    sub_datum = sub_datum.split(';')
                    sub_fy_oy.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                    sub_fy_on.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                    sub_fn_oy.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                    sub_fn_on.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                    sub_total.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                    sub_secs.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                    if has_levels:
                        if self.is_number(sub_datum[6]):
                            sub_levs.append(int(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                        else:
                            sub_levs.append(sub_datum[6])
                sub_fy_oy = np.asarray(sub_fy_oy)
                sub_fy_on = np.asarray(sub_fy_on)
                sub_fn_oy = np.asarray(sub_fn_oy)
                sub_fn_on = np.asarray(sub_fn_on)
                sub_total = np.asarray(sub_total)
                sub_secs = np.asarray(sub_secs)
                if len(sub_levs) == 0:
                    sub_levs = np.empty(len(sub_secs))
                else:
                    sub_levs = np.asarray(sub_levs)
                # calculate the ctc statistic
                sub_values, stat, stat_error = calculate_ctc_stat(statistic, sub_fy_oy, sub_fy_on, sub_fn_oy, sub_fn_on,
                                                                  sub_total)
                if stat_error != '':
                    self.error = stat_error

            elif 'mode_pair' in stat_line_type:  # histograms will pass in 'mode_pair_histogram', but we still want to use this code here.
                individual_obj_lookup = {}
                if statistic == "OTS (Object Threat Score)":
                    object_sub_data = str(object_row['sub_data2']).split(',')
                    for sub_datum2 in object_sub_data:
                        sub_datum2 = sub_datum2.split(';')
                        obj_id = sub_datum2[0]
                        mode_header_id = sub_datum2[1]
                        area = sub_datum2[2]
                        if obj_id[0:1] == "C":
                            continue
                        if mode_header_id not in individual_obj_lookup.keys():
                            individual_obj_lookup[mode_header_id] = {}
                        individual_obj_lookup[mode_header_id][obj_id] = {
                            "area": float(area)
                        }
                self.data["individualObjLookup"].append(individual_obj_lookup)
                sub_data = str(row['sub_data']).split(',')
                # these are the sub-fields specific to mode stats
                sub_interests = []
                sub_pair_fids = []
                sub_pair_oids = []
                sub_mode_header_ids = []
                sub_secs = []
                sub_levs = []
                for sub_datum in sub_data:
                    sub_datum = sub_datum.split(';')
                    obj_id = sub_datum[1]
                    if obj_id[0:1] == "F" and obj_id.find("_") >= 0:
                        sub_interests.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                        sub_pair_fids.append(obj_id.split("_")[0])
                        sub_pair_oids.append(obj_id.split("_")[1])
                        sub_mode_header_ids.append(int(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                        sub_secs.append(int(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                        if self.is_number(sub_datum[3]):
                            sub_levs.append(int(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                        else:
                            sub_levs.append(sub_datum[4])

                if 'histogram' in stat_line_type:
                    # need to get an array of sub-values, one for each unique mode_header_id
                    sub_interest_map = {}
                    sub_pair_fid_map = {}
                    sub_pair_oid_map = {}
                    sub_mode_header_id_map = {}
                    sub_secs_map = {}
                    sub_levs_map = {}
                    for i in range(0, len(sub_mode_header_ids)):
                        this_mode_header_id = str(sub_mode_header_ids[i])
                        if this_mode_header_id not in sub_interest_map.keys():
                            sub_interest_map[this_mode_header_id] = []
                            sub_pair_fid_map[this_mode_header_id] = []
                            sub_pair_oid_map[this_mode_header_id] = []
                            sub_mode_header_id_map[this_mode_header_id] = []
                            sub_secs_map[this_mode_header_id] = []
                            sub_levs_map[this_mode_header_id] = []
                        sub_interest_map[this_mode_header_id].append(sub_interests[i])
                        sub_pair_fid_map[this_mode_header_id].append(sub_pair_fids[i])
                        sub_pair_oid_map[this_mode_header_id].append(sub_pair_oids[i])
                        sub_mode_header_id_map[this_mode_header_id].append(sub_mode_header_ids[i])
                        sub_secs_map[this_mode_header_id].append(sub_secs[i])
                        sub_levs_map[this_mode_header_id].append(sub_levs[i])
                    sub_values = []
                    sub_secs = []
                    sub_levs = []
                    all_header_ids = sub_mode_header_id_map.keys()
                    for header_id in all_header_ids:
                        stat, stat_error = calculate_mode_stat(statistic, np.asarray(sub_interest_map[header_id]),
                                                               np.asarray(sub_pair_fid_map[header_id]),
                                                               np.asarray(sub_pair_oid_map[header_id]),
                                                               np.asarray(sub_mode_header_id_map[header_id]),
                                                               individual_obj_lookup)
                        if stat_error != '':
                            self.error = stat_error
                        if stat == 'null':
                            sub_values.append(np.nan)
                        else:
                            sub_values.append(stat)
                        # time and level are consistent for each header_id, so just take the first one
                        sub_secs.append(sub_secs_map[header_id][0])
                        sub_levs.append(sub_levs_map[header_id][0])
                    sub_values = np.asarray(sub_values)
                    sub_secs = np.asarray(sub_secs)
                    sub_levs = np.asarray(sub_levs)
                else:
                    sub_interests = np.asarray(sub_interests)
                    sub_pair_fids = np.asarray(sub_pair_fids)
                    sub_pair_oids = np.asarray(sub_pair_oids)
                    sub_mode_header_ids = np.asarray(sub_mode_header_ids)
                    sub_secs = np.asarray(sub_secs)
                    if len(sub_levs) == 0:
                        sub_levs = np.empty(len(sub_secs))
                    else:
                        sub_levs = np.asarray(sub_levs)

                    # calculate the mode statistic
                    stat, stat_error = calculate_mode_stat(statistic, sub_interests, sub_pair_fids, sub_pair_oids,
                                                           sub_mode_header_ids, individual_obj_lookup)
                    if stat_error != '':
                        self.error = stat_error

            elif stat_line_type == 'precalculated':
                stat = float(row['stat']) if float(row['stat']) != -9999 else 'null'
                sub_data = str(row['sub_data']).split(',')
                # these are the sub-fields specific to precalculated stats
                sub_values = []
                for sub_datum in sub_data:
                    sub_datum = sub_datum.split(';')
                    sub_values.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                    sub_secs.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                    if has_levels:
                        if self.is_number(sub_datum[3]):
                            sub_levs.append(int(sub_datum[3]) if float(sub_datum[0]) != -9999 else np.nan)
                        else:
                            sub_levs.append(sub_datum[3])
                sub_values = np.asarray(sub_values)
                sub_secs = np.asarray(sub_secs)
                if len(sub_levs) == 0:
                    sub_levs = np.empty(len(sub_secs))
                else:
                    sub_levs = np.asarray(sub_levs)

            else:
                stat = 'null'
                sub_secs = np.empty(0)
                sub_levs = np.empty(0)

        except KeyError as e:
            self.error = "Error parsing query data. The expected fields don't seem to be present " \
                         "in the results cache: " + str(e)
            # if we don't have the data we expect just stop now and return empty data objects
            return np.nan, np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0), np.empty(0)

        # if we do have the data we expect, return the requested statistic
        return stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids

    def get_ens_hist_stat(self, row, has_levels):
        try:
            # get all of the sub-values for each time
            stat = float(row['bin_count']) if float(row['bin_count']) > -1 else 'null'
            sub_data = str(row['sub_data']).split(',')
            sub_values = []
            sub_secs = []
            sub_levs = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_values.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_secs.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                if len(sub_datum) > 3:
                    if self.is_number(sub_datum[3]):
                        sub_levs.append(int(sub_datum[3]) if float(sub_datum[0]) != -9999 else np.nan)
                    else:
                        sub_levs.append(sub_datum[3])
            sub_values = np.asarray(sub_values)
            sub_secs = np.asarray(sub_secs)
            if len(sub_levs) == 0:
                sub_levs = np.empty(len(sub_secs))
            else:
                sub_levs = np.asarray(sub_levs)

        except KeyError as e:
            self.error = "Error parsing query data. The expected fields don't seem to be present " \
                         "in the results cache: " + str(e)
            # if we don't have the data we expect just stop now and return empty data objects
            return np.nan, np.empty(0), np.empty(0), np.empty(0)

        # if we do have the data we expect, return the requested statistic
        return stat, sub_levs, sub_secs, sub_values

    def get_ens_stat(self, plot_type, forecast_total, observed_total, on_all, oy_all, threshold_all, total_times,
                     total_values):
        # initialize return variables
        hit_rate = []
        pody = []
        far = []
        sample_climo = 0
        auc = 0
        x_var = 'threshold_all'  # variable that appears pn a plot's x-axis -- change with plot type
        y_var = 'hit_rate'  # variable that appears pn a plot's y-axis -- change with plot type

        if plot_type == 'Reliability':
            # determine the hit rate for each probability bin
            for i in range(0, len(threshold_all)):
                try:
                    hr = float(oy_all[i]) / (float(oy_all[i]) + float(on_all[i]))
                except ZeroDivisionError:
                    hr = None
                hit_rate.append(hr)
            # calculate the sample climatology
            sample_climo = float(observed_total) / float(forecast_total)
            x_var = 'threshold_all'
            y_var = 'hit_rate'

        elif plot_type == 'ROC' or plot_type == "PerformanceDiagram":
            # determine the probability of detection (hit rate) and probability of false detection (false alarm ratio) for each probability bin
            for i in range(0, len(threshold_all)):
                hit = 0
                miss = 0
                fa = 0
                cn = 0
                for index, value in enumerate(oy_all):
                    if index > i:
                        hit += value
                    if index <= i:
                        miss += value
                for index, value in enumerate(on_all):
                    if index > i:
                        fa += value
                    if index <= i:
                        cn += value

                # POD
                try:
                    hr = hit / (hit + miss)
                except ZeroDivisionError:
                    hr = None
                pody.append(hr)

                if plot_type == 'ROC':
                    # POFD
                    try:
                        pofd = fa / (fa + cn)
                    except ZeroDivisionError:
                        pofd = None
                    far.append(pofd)
                else:
                    # 1- FAR for success ratio
                    try:
                        far1 = 1 - (fa / (fa + hit))
                    except ZeroDivisionError:
                        far1 = None
                    far.append(far1)

            # Reverse all of the lists (easier to graph)
            pody = pody[::-1]
            far = far[::-1]
            threshold_all = threshold_all[::-1]
            oy_all = oy_all[::-1]
            on_all = on_all[::-1]
            total_values = total_values[::-1]
            total_times = total_times[::-1]

            if plot_type == 'ROC':
                # Add one final point to allow for the AUC score to be calculated
                pody.append(1)
                far.append(1)
                threshold_all.append(-999)
                oy_all.append(-999)
                on_all.append(-999)
                total_values.append(-999)
                total_times.append(-999)

                # Calculate AUC
                auc_sum = 0
                for i in range(1, len(threshold_all)):
                    auc_sum = ((pody[i] + pody[i - 1]) * (far[i] - far[i - 1])) + auc_sum
                auc = auc_sum / 2
            x_var = 'far'
            y_var = 'pody'

        return {
            "hit_rate": hit_rate,
            "sample_climo": sample_climo,
            "auc": auc,
            "far": far,
            "pody": pody,
            "on_all": on_all,
            "oy_all": oy_all,
            "threshold_all": threshold_all,
            "total_times": total_times,
            "total_values": total_values,
            "x_var": x_var,
            "y_var": y_var
        }

    #  function for calculating the interval between the current time and the next time for models with irregular vts
    def get_time_interval(self, curr_time, time_interval, vts):
        full_day = 24 * 3600 * 1000
        first_vt = min(vts)
        this_vt = curr_time % full_day  # current time we're on

        if this_vt in vts:
            # find our where the current time is in the vt array
            this_vt_idx = vts.index(this_vt)
            # choose the next vt
            next_vt_idx = this_vt_idx + 1
            if next_vt_idx >= len(vts):
                # if we were at the last vt, wrap back around to the first vt
                ti = (full_day - this_vt) + first_vt
            else:
                # otherwise take the difference between the current and next vts.
                ti = vts[next_vt_idx] - vts[this_vt_idx]
        else:
            # if for some reason the current vt isn't in the vts array, default to the regular interval
            ti = time_interval

        return ti

    # function for parsing the data returned by a timeseries query
    def parse_query_data_timeseries(self, cursor, stat_line_type, statistic, has_levels, completeness_qc_param, vts,
                                    object_data):
        # initialize local variables
        xmax = float("-inf")
        xmin = float("inf")
        curve_times = []
        curve_stats = []
        sub_interests_all = []
        sub_pair_fids_all = []
        sub_pair_oids_all = []
        sub_mode_header_ids_all = []
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data and calculate starting time interval of the returned data
        query_data = cursor.fetchall()

        # default the time interval to an hour. It won't matter since it won't be used for only 0 or 1 data points.
        time_interval = int(query_data[1]['avtime']) - int(query_data[0]['avtime']) if len(query_data) > 1 else 3600
        if len(vts) > 0:
            # selecting valid_times makes the cadence irregular
            vts = vts.replace("'", "")
            vts = vts.split(',')
            vts = [(int(vt)) * 3600 * 1000 for vt in vts]
            # make sure no vts are negative
            vts = list(map((lambda vt: vt if vt >= 0 else vt + 24 * 3600 * 1000), vts))
            # sort 'em
            vts = sorted(vts)
            regular = False
        else:
            vts = []
            regular = True

        # loop through the query results and store the returned values
        for row in query_data:
            row_idx = query_data.index(row)
            av_seconds = int(row['avtime'])
            av_time = av_seconds * 1000
            xmin = av_time if av_time < xmin else xmin
            xmax = av_time if av_time > xmax else xmax
            if stat_line_type == 'mode_pair' and statistic == "OTS (Object Threat Score)":
                object_row = object_data[row_idx]
            else:
                object_row = []
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row[
                    'obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row[
                    'vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row[
                                  'vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row[
                    'fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row[
                                  'fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'mode_pair':
                data_exists = row['interest'] != "null" and row['interest'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            if hasattr(row, 'N0'):
                self.n0.append(int(row['N0']))
            else:
                self.n0.append(int(row['N_times']))
            self.n_times.append(int(row['N_times']))

            if row_idx < len(query_data) - 1:  # make sure we have the smallest time interval for the while loop later
                time_diff = int(query_data[row_idx + 1]['avtime']) - int(row['avtime'])
                time_interval = time_diff if time_diff < time_interval else time_interval

            if data_exists:
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids \
                    = self.get_stat(has_levels, row, statistic, stat_line_type, object_row)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this time point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_interests = 'NaN'
                    sub_pair_fids = 'NaN'
                    sub_pair_oids = 'NaN'
                    sub_mode_header_ids = 'NaN'
                    sub_secs = 'NaN'
                    sub_levs = 'NaN'
            else:
                # there's no data at this time point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_interests = 'NaN'
                sub_pair_fids = 'NaN'
                sub_pair_oids = 'NaN'
                sub_mode_header_ids = 'NaN'
                sub_secs = 'NaN'
                sub_levs = 'NaN'

            # store parsed data for later
            curve_times.append(av_time)
            curve_stats.append(stat)
            if stat_line_type == 'mode_pair':
                sub_interests_all.append(sub_interests)
                sub_pair_fids_all.append(sub_pair_fids)
                sub_pair_oids_all.append(sub_pair_oids)
                sub_mode_header_ids_all.append(sub_mode_header_ids)
            else:
                sub_vals_all.append(sub_values)
            sub_secs_all.append(sub_secs)
            if has_levels:
                sub_levs_all.append(sub_levs)

        n0_max = max(self.n0)
        n_times_max = max(self.n_times)

        xmin = query_data[0]['avtime'] * 1000 if xmin < query_data[0]['avtime'] * 1000 else xmin

        time_interval = time_interval * 1000
        loop_time = xmin
        loop_sum = 0
        ymin = sys.float_info.max
        ymax = -1 * sys.float_info.max

        while loop_time <= xmax:
            # the reason we need to loop through everything again is to add in nulls for any missing points along the
            # timeseries. The query only returns the data that it actually has.
            if loop_time not in curve_times:
                self.data['x'].append(loop_time)
                self.data['y'].append('null')
                self.data['error_y'].append('null')
                if stat_line_type == 'mode_pair':
                    self.data['subInterest'].append('NaN')
                    self.data['subPairFid'].append('NaN')
                    self.data['subPairOid'].append('NaN')
                    self.data['subModeHeaderId'].append('NaN')
                else:
                    self.data['subVals'].append('NaN')
                self.data['subSecs'].append('NaN')
                if has_levels:
                    self.data['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
            else:
                d_idx = curve_times.index(loop_time)
                this_n0 = self.n0[d_idx]
                this_n_times = self.n_times[d_idx]
                # add a null if there were too many missing sub-values
                if curve_stats[d_idx] == 'null' or this_n_times < completeness_qc_param * n_times_max:
                    self.data['x'].append(loop_time)
                    self.data['y'].append('null')
                    self.data['error_y'].append('null')
                    if stat_line_type == 'mode_pair':
                        self.data['subInterest'].append('NaN')
                        self.data['subPairFid'].append('NaN')
                        self.data['subPairOid'].append('NaN')
                        self.data['subModeHeaderId'].append('NaN')
                    else:
                        self.data['subVals'].append('NaN')
                    self.data['subSecs'].append('NaN')
                    if has_levels:
                        self.data['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                else:
                    # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                    loop_sum += curve_stats[d_idx]
                    if stat_line_type == 'mode_pair':
                        list_interests = sub_interests_all[d_idx].tolist()
                        list_pair_fids = sub_pair_fids_all[d_idx].tolist()
                        list_pair_oids = sub_pair_oids_all[d_idx].tolist()
                        list_sub_mode_header_ids = sub_mode_header_ids_all[d_idx].tolist()
                        list_vals = []
                    else:
                        list_interests = []
                        list_pair_fids = []
                        list_pair_oids = []
                        list_sub_mode_header_ids = []
                        list_vals = sub_vals_all[d_idx].tolist()
                    list_secs = sub_secs_all[d_idx].tolist()
                    if has_levels:
                        list_levs = sub_levs_all[d_idx].tolist()
                    else:
                        list_levs = []
                    # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                    if stat_line_type != 'mode_pair':
                        bad_value_indices = [index for index, value in enumerate(list_vals) if
                                             not self.is_number(value)]
                        for bad_value_index in sorted(bad_value_indices, reverse=True):
                            del list_vals[bad_value_index]
                            del list_secs[bad_value_index]
                            if has_levels:
                                del list_levs[bad_value_index]
                    # store data
                    self.data['x'].append(loop_time)
                    self.data['y'].append(curve_stats[d_idx])
                    self.data['error_y'].append('null')
                    if stat_line_type == 'mode_pair':
                        self.data['subInterest'].append(list_interests)
                        self.data['subPairFid'].append(list_pair_fids)
                        self.data['subPairOid'].append(list_pair_oids)
                        self.data['subModeHeaderId'].append(list_sub_mode_header_ids)
                    else:
                        self.data['subVals'].append(list_vals)
                    self.data['subSecs'].append(list_secs)
                    if has_levels:
                        self.data['subLevs'].append(list_levs)
                    ymin = curve_stats[d_idx] if curve_stats[d_idx] < ymin else ymin
                    ymax = curve_stats[d_idx] if curve_stats[d_idx] > ymax else ymax

            if not regular:
                # vts are giving us an irregular cadence, so the interval most likely will not be the one calculated above
                time_interval = self.get_time_interval(loop_time, time_interval, vts)
            loop_time = loop_time + time_interval

        self.data['xmin'] = xmin
        self.data['xmax'] = xmax
        self.data['ymin'] = ymin
        self.data['ymax'] = ymax
        self.data['sum'] = loop_sum

    # function for parsing the data returned by a profile/dieoff/threshold/validtime/gridscale etc query
    def parse_query_data_specialty_curve(self, cursor, stat_line_type, statistic, plot_type, has_levels, hide_gaps,
                                         completeness_qc_param, object_data):
        # initialize local variables
        ind_var_min = sys.float_info.max
        ind_var_max = -1 * sys.float_info.max
        curve_ind_vars = []
        curve_stats = []
        sub_interests_all = []
        sub_pair_fids_all = []
        sub_pair_oids_all = []
        sub_mode_header_ids_all = []
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            row_idx = query_data.index(row)
            if plot_type == 'ValidTime':
                ind_var = float(row['hr_of_day'])
            elif plot_type == 'GridScale':
                ind_var = float(row['gridscale'])
            elif plot_type == 'Profile':
                ind_var = float(str(row['avVal']).replace('P', ''))
            elif plot_type == 'DailyModelCycle' or plot_type == 'TimeSeries':
                ind_var = int(row['avtime']) * 1000
            elif plot_type == 'DieOff':
                ind_var = int(row['fcst_lead'])
                ind_var = ind_var if ind_var % 10000 != 0 else ind_var / 10000
            elif plot_type == 'Threshold':
                ind_var = float(row['thresh'].replace('=', '').replace('<', '').replace('>', ''))
            elif plot_type == 'YearToYear':
                ind_var = float(row['year'])
            else:
                ind_var = int(row['avtime'])

            if stat_line_type == 'mode_pair' and statistic == "OTS (Object Threat Score)":
                object_row = object_data[row_idx]
            else:
                object_row = []
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row[
                    'obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row[
                    'vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row[
                                  'vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row[
                    'fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row[
                                  'fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'mode_pair':
                data_exists = row['interest'] != "null" and row['interest'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            if hasattr(row, 'N0'):
                self.n0.append(int(row['N0']))
            else:
                self.n0.append(int(row['N_times']))
            self.n_times.append(int(row['N_times']))

            if data_exists:
                ind_var_min = ind_var if ind_var < ind_var_min else ind_var_min
                ind_var_max = ind_var if ind_var > ind_var_max else ind_var_max
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids \
                    = self.get_stat(has_levels, row, statistic, stat_line_type, object_row)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_interests = 'NaN'
                    sub_pair_fids = 'NaN'
                    sub_pair_oids = 'NaN'
                    sub_mode_header_ids = 'NaN'
                    sub_secs = 'NaN'
                    sub_levs = 'NaN'
            else:
                # there's no data at this point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_interests = 'NaN'
                sub_pair_fids = 'NaN'
                sub_pair_oids = 'NaN'
                sub_mode_header_ids = 'NaN'
                sub_secs = 'NaN'
                sub_levs = 'NaN'

            # deal with missing forecast cycles for dailyModelCycle plot type
            if plot_type == 'DailyModelCycle' and row_idx > 0 and (
                    int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000)) > 3600 * 24 * 1000:
                cycles_missing = math.ceil(
                    int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000) / (3600 * 24 * 1000)) - 1
                for missing_cycle in reversed(range(1, cycles_missing + 1)):
                    curve_ind_vars.append(ind_var - 3600 * 24 * 1000 * missing_cycle)
                    curve_stats.append('null')
                    sub_vals_all.append('NaN')
                    sub_secs_all.append('NaN')
                    if has_levels:
                        sub_levs_all.append('NaN')

            # store parsed data for later
            curve_ind_vars.append(ind_var)
            curve_stats.append(stat)
            if stat_line_type == 'mode_pair':
                sub_interests_all.append(sub_interests)
                sub_pair_fids_all.append(sub_pair_fids)
                sub_pair_oids_all.append(sub_pair_oids)
                sub_mode_header_ids_all.append(sub_mode_header_ids)
            else:
                sub_vals_all.append(sub_values)
            sub_secs_all.append(sub_secs)
            if has_levels:
                sub_levs_all.append(sub_levs)

        # make sure lists are definitely sorted by the float ind_var values, instead of their former strings
        if stat_line_type == 'mode_pair':
            if has_levels:
                curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all, sub_mode_header_ids_all, sub_secs_all, sub_levs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all,
                                sub_mode_header_ids_all, sub_secs_all, sub_levs_all)))
            else:
                curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all, sub_mode_header_ids_all, sub_secs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all,
                                sub_mode_header_ids_all, sub_secs_all)))
        else:
            if has_levels:
                curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all)))
            else:
                curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all)))

        n0_max = max(self.n0)
        n_times_max = max(self.n_times)
        loop_sum = 0
        dep_var_min = sys.float_info.max
        dep_var_max = -1 * sys.float_info.max

        # profiles have the levels sorted as strings, not numbers. Need to fix that
        if plot_type == 'Profile':
            curve_stats = [x for _, x in sorted(zip(curve_ind_vars, curve_stats))]
            if stat_line_type == 'mode_pair':
                sub_interests_all = [x for _, x in sorted(zip(curve_ind_vars, sub_interests_all))]
                sub_pair_fids_all = [x for _, x in sorted(zip(curve_ind_vars, sub_pair_fids_all))]
                sub_pair_oids_all = [x for _, x in sorted(zip(curve_ind_vars, sub_pair_oids_all))]
                sub_mode_header_ids_all = [x for _, x in sorted(zip(curve_ind_vars, sub_mode_header_ids_all))]
            else:
                sub_vals_all = [x for _, x in sorted(zip(curve_ind_vars, sub_vals_all))]
            sub_secs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_secs_all))]
            sub_levs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_levs_all))]
            curve_ind_vars = sorted(curve_ind_vars)

        for ind_var in curve_ind_vars:
            # the reason we need to loop through everything again is to add in nulls
            # for any bad data points along the curve.
            d_idx = curve_ind_vars.index(ind_var)
            this_n0 = self.n0[d_idx]
            this_n_times = self.n_times[d_idx]
            # add a null if there were too many missing sub-values
            if curve_stats[d_idx] == 'null' or this_n_times < completeness_qc_param * n_times_max:
                if not hide_gaps:
                    if plot_type == 'Profile':
                        # profile has the stat first, and then the ind_var. The others have ind_var and then stat.
                        # this is in the pattern of x-plotted-variable, y-plotted-variable.
                        self.data['x'].append('null')
                        self.data['y'].append(ind_var)
                        self.data['error_x'].append('null')
                        if stat_line_type == 'mode_pair':
                            self.data['subInterest'].append('NaN')
                            self.data['subPairFid'].append('NaN')
                            self.data['subPairOid'].append('NaN')
                            self.data['subModeHeaderId'].append('NaN')
                        else:
                            self.data['subVals'].append('NaN')
                        self.data['subSecs'].append('NaN')
                        if has_levels:
                            self.data['subLevs'].append('NaN')
                        # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    else:
                        self.data['x'].append(ind_var)
                        self.data['y'].append('null')
                        self.data['error_y'].append('null')
                        if stat_line_type == 'mode_pair':
                            self.data['subInterest'].append('NaN')
                            self.data['subPairFid'].append('NaN')
                            self.data['subPairOid'].append('NaN')
                            self.data['subModeHeaderId'].append('NaN')
                        else:
                            self.data['subVals'].append('NaN')
                        self.data['subSecs'].append('NaN')
                        if has_levels:
                            self.data['subLevs'].append('NaN')
                        # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
            else:
                # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                loop_sum += curve_stats[d_idx]
                if stat_line_type == 'mode_pair':
                    list_interests = sub_interests_all[d_idx].tolist()
                    list_pair_fids = sub_pair_fids_all[d_idx].tolist()
                    list_pair_oids = sub_pair_oids_all[d_idx].tolist()
                    list_sub_mode_header_ids = sub_mode_header_ids_all[d_idx].tolist()
                    list_vals = []
                else:
                    list_interests = []
                    list_pair_fids = []
                    list_pair_oids = []
                    list_sub_mode_header_ids = []
                    list_vals = sub_vals_all[d_idx].tolist()
                list_secs = sub_secs_all[d_idx].tolist()
                if has_levels:
                    list_levs = sub_levs_all[d_idx].tolist()
                else:
                    list_levs = []
                # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                if stat_line_type != 'mode_pair':
                    bad_value_indices = [index for index, value in enumerate(list_vals) if not self.is_number(value)]
                    for bad_value_index in sorted(bad_value_indices, reverse=True):
                        del list_vals[bad_value_index]
                        del list_secs[bad_value_index]
                        if has_levels:
                            del list_levs[bad_value_index]
                # store data
                if plot_type == 'Profile':
                    # profile has the stat first, and then the ind_var. The others have ind_var and then stat.
                    # this is in the pattern of x-plotted-variable, y-plotted-variable.
                    self.data['x'].append(curve_stats[d_idx])
                    self.data['y'].append(ind_var)
                    self.data['error_x'].append('null')
                    if stat_line_type == 'mode_pair':
                        self.data['subInterest'].append(list_interests)
                        self.data['subPairFid'].append(list_pair_fids)
                        self.data['subPairOid'].append(list_pair_oids)
                        self.data['subModeHeaderId'].append(list_sub_mode_header_ids)
                    else:
                        self.data['subVals'].append(list_vals)
                    self.data['subSecs'].append(list_secs)
                    self.data['subLevs'].append(list_levs)
                else:
                    self.data['x'].append(ind_var)
                    self.data['y'].append(curve_stats[d_idx])
                    self.data['error_y'].append('null')
                    if stat_line_type == 'mode_pair':
                        self.data['subInterest'].append(list_interests)
                        self.data['subPairFid'].append(list_pair_fids)
                        self.data['subPairOid'].append(list_pair_oids)
                        self.data['subModeHeaderId'].append(list_sub_mode_header_ids)
                    else:
                        self.data['subVals'].append(list_vals)
                    self.data['subSecs'].append(list_secs)
                    if has_levels:
                        self.data['subLevs'].append(list_levs)
                dep_var_min = curve_stats[d_idx] if curve_stats[d_idx] < dep_var_min else dep_var_min
                dep_var_max = curve_stats[d_idx] if curve_stats[d_idx] > dep_var_max else dep_var_max

        if plot_type == 'Profile':
            self.data['xmin'] = dep_var_min
            self.data['xmax'] = dep_var_max
            self.data['ymin'] = ind_var_min
            self.data['ymax'] = ind_var_max
        else:
            self.data['xmin'] = ind_var_min
            self.data['xmax'] = ind_var_max
            self.data['ymin'] = dep_var_min
            self.data['ymax'] = dep_var_max
        self.data['sum'] = loop_sum

    # function for parsing the data returned by a histogram query
    def parse_query_data_histogram(self, cursor, stat_line_type, statistic, has_levels, object_data):
        # initialize local variables
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data and calculate starting time interval of the returned data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            row_idx = query_data.index(row)
            if 'mode_pair' in stat_line_type and statistic == "OTS (Object Threat Score)":
                object_row = object_data[row_idx]
            else:
                object_row = []
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row[
                    'obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row[
                    'vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row[
                                  'vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row[
                    'fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row[
                                  'fn_on'] != "null" and row['fn_on'] != "NULL"
            elif 'mode_pair' in stat_line_type:
                # the word histogram might have already been appended, so look for the sub-string
                data_exists = row['interest'] != "null" and row['interest'] != "NULL"
                stat_line_type = 'mode_pair_histogram'  # let the get_stat function know that this is a histogram
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            if hasattr(row, 'N0'):
                self.n0.append(int(row['N0']))
            else:
                self.n0.append(int(row['N_times']))
            self.n_times.append(int(row['N_times']))

            if data_exists:
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids \
                    = self.get_stat(has_levels, row, statistic, stat_line_type, object_row)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    continue
                # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                if np.isnan(sub_values).any() or np.isinf(sub_values).any():
                    nan_value_indices = np.argwhere(np.isnan(sub_values))
                    inf_value_indices = np.argwhere(np.isinf(sub_values))
                    bad_value_indices = np.union1d(nan_value_indices, inf_value_indices)
                    sub_values = np.delete(sub_values, bad_value_indices)
                    sub_secs = np.delete(sub_secs, bad_value_indices)
                    if has_levels:
                        sub_levs = np.delete(sub_levs, bad_value_indices)

                # store parsed data for later
                list_vals = sub_values.tolist()
                sub_vals_all.append(list_vals)
                list_secs = sub_secs.tolist()
                sub_secs_all.append(list_secs)
                if has_levels:
                    list_levs = sub_levs.tolist()
                    sub_levs_all.append(list_levs)

        # we don't have bins yet, so we want all of the data in one array
        self.data['subVals'] = [item for sublist in sub_vals_all for item in sublist]
        self.data['subSecs'] = [item for sublist in sub_secs_all for item in sublist]
        if has_levels:
            self.data['subLevs'] = [item for sublist in sub_levs_all for item in sublist]

    # function for parsing the data returned by an ensemble histogram query
    def parse_query_data_ensemble_histogram(self, cursor, statistic, has_levels):
        # initialize local variables
        bins = []
        bin_counts = []
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            data_exists = row['bin'] != "null" and row['bin'] != "NULL" and row['bin_count'] != "null" and row[
                'bin_count'] != "NULL"

            if data_exists:
                bin_number = int(row['bin'])
                bin_count = int(row['bin_count'])
                if hasattr(row, 'N0'):
                    self.n0.append(int(row['N0']))
                else:
                    self.n0.append(int(row['N_times']))
                self.n_times.append(int(row['N_times']))

                # this function deals with rhist/phist/relp and rhist_rank/phist_bin/relp_ens tables
                stat, sub_levs, sub_secs, sub_values = self.get_ens_hist_stat(row, has_levels)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    bins.append(bin_number)
                    bin_counts.append(0)
                    sub_vals_all.append([])
                    sub_secs_all.append([])
                    if has_levels:
                        sub_levs_all.append([])

                else:
                    list_vals = sub_values.tolist()
                    list_secs = sub_secs.tolist()
                    if has_levels:
                        list_levs = sub_levs.tolist()

                    # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                    bad_value_indices = [index for index, value in enumerate(list_vals) if not self.is_number(value)]
                    for bad_value_index in sorted(bad_value_indices, reverse=True):
                        del list_vals[bad_value_index]
                        del list_secs[bad_value_index]
                        if has_levels:
                            del list_levs[bad_value_index]

                    # store parsed data
                    bins.append(bin_number)
                    bin_counts.append(bin_count)
                    sub_vals_all.append(list_vals)
                    sub_secs_all.append(list_secs)
                    if has_levels:
                        sub_levs_all.append(list_levs)

        if statistic == "Probability Integral Transform Histogram":
            bin_num = len(bins)
            bins[:] = [x / bin_num for x in bins]

        # Finalize data structure
        if len(bins) > 0:
            self.data['x'] = bins
            self.data['y'] = bin_counts
            self.data['subVals'] = sub_vals_all
            self.data['subSecs'] = sub_secs_all
            self.data['subLevs'] = sub_levs_all
            self.data['xmax'] = max(bins)
            self.data['xmin'] = min(bins)
            self.data['ymax'] = max(bin_counts)
            self.data['ymin'] = 0

    # function for parsing the data returned by an ensemble query
    def parse_query_data_ensemble(self, cursor, plot_type):
        # initialize local variables
        threshold_all = []
        oy_all = []
        on_all = []
        total_times = []
        total_values = []
        observed_total = 0
        forecast_total = 0

        # get query data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            data_exists = row['bin_number'] != "null" and row['bin_number'] != "NULL" and row['oy_i'] != "null" and row[
                'oy_i'] != "NULL" and row['on_i'] != "null" and row['on_i'] != "NULL"

            if data_exists:
                bin_number = int(row['bin_number'])
                threshold = row['threshold']
                oy = int(row['oy_i'])
                on = int(row['on_i'])
                number_times = int(row['N_times'])
                if hasattr(row, 'N0'):
                    number_values = int(row['N0'])
                else:
                    number_values = int(row['N_times'])

                # we must add up all of the observed and not-observed values for each probability bin
                observed_total = observed_total + oy
                forecast_total = forecast_total + oy + on

                if len(oy_all) < bin_number:
                    oy_all.append(oy)
                else:
                    oy_all[bin_number - 1] = oy_all[bin_number - 1] + oy
                if len(on_all) < bin_number:
                    on_all.append(on)
                else:
                    on_all[bin_number - 1] = on_all[bin_number - 1] + on
                if len(total_times) < bin_number:
                    total_times.append(on)
                else:
                    total_times[bin_number - 1] = total_times[bin_number - 1] + number_times
                if len(total_values) < bin_number:
                    total_values.append(on)
                else:
                    total_values[bin_number - 1] = total_values[bin_number - 1] + number_values
                if len(threshold_all) < bin_number:
                    threshold_all.append(threshold)
                else:
                    continue

        # this function deals with pct and pct_thresh tables
        ens_stats = self.get_ens_stat(plot_type, forecast_total, observed_total, on_all, oy_all, threshold_all,
                                      total_times, total_values)

        # Since everything is combined already, put it into the data structure
        self.n0 = total_values
        self.n_times = total_times
        self.data['x'] = ens_stats[ens_stats["x_var"]]
        self.data['y'] = ens_stats[ens_stats["y_var"]]
        self.data['sample_climo'] = ens_stats["sample_climo"]
        self.data['threshold_all'] = ens_stats["threshold_all"]
        self.data['oy_all'] = ens_stats["oy_all"]
        self.data['on_all'] = ens_stats["on_all"]
        self.data['n'] = total_values
        self.data['auc'] = ens_stats["auc"]
        self.data['xmax'] = 1.0
        self.data['xmin'] = 0.0
        self.data['ymax'] = 1.0
        self.data['ymin'] = 0.0

    # function for parsing the data returned by a contour query
    def parse_query_data_contour(self, cursor, stat_line_type, statistic, has_levels):
        # initialize local variables
        curve_stat_lookup = {}
        curve_n_lookup = {}

        # get query data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            # get rid of any non-numeric characters
            non_float = re.compile(r'[^\d.]+')
            row_x_val = float(non_float.sub('', str(row['xVal']))) if str(row['xVal']) != 'NA' else 0.
            row_y_val = float(non_float.sub('', str(row['yVal']))) if str(row['yVal']) != 'NA' else 0.
            stat_key = str(row_x_val) + '_' + str(row_y_val)
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row[
                    'obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row[
                    'vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row[
                                  'vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row[
                    'fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row[
                                  'fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"

            if data_exists:
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, sub_mode_header_ids \
                    = self.get_stat(has_levels, row, statistic, stat_line_type, [])
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    continue
                n = row['n']
                min_date = row['min_secs']
                max_date = row['max_secs']
            else:
                # there's no data at this point
                stat = 'null'
                n = 0
                min_date = 'null'
                max_date = 'null'
            # store flat arrays of all the parsed data, used by the text output and for some calculations later
            self.data['xTextOutput'].append(row_x_val)
            self.data['yTextOutput'].append(row_y_val)
            self.data['zTextOutput'].append(stat)
            self.data['nTextOutput'].append(n)
            self.data['minDateTextOutput'].append(min_date)
            self.data['maxDateTextOutput'].append(max_date)
            curve_stat_lookup[stat_key] = stat
            curve_n_lookup[stat_key] = n

        # get the unique x and y values and sort the stats into the 2D z array accordingly
        self.data['x'] = sorted(list(set(self.data['xTextOutput'])))
        self.data['y'] = sorted(list(set(self.data['yTextOutput'])))

        loop_sum = 0
        n_points = 0
        zmin = sys.float_info.max
        zmax = -1 * sys.float_info.max
        for curr_y in self.data['y']:
            curr_y_stat_array = []
            curr_y_n_array = []
            for curr_x in self.data['x']:
                curr_stat_key = str(curr_x) + '_' + str(curr_y)
                if curr_stat_key in curve_stat_lookup:
                    curr_stat = curve_stat_lookup[curr_stat_key]
                    curr_n = curve_n_lookup[curr_stat_key]
                    loop_sum = loop_sum + curr_stat
                    n_points = n_points + 1
                    curr_y_stat_array.append(curr_stat)
                    curr_y_n_array.append(curr_n)
                    zmin = curr_stat if curr_stat < zmin else zmin
                    zmax = curr_stat if curr_stat > zmax else zmax
                else:
                    curr_y_stat_array.append('null')
                    curr_y_n_array.append(0)
            self.data['z'].append(curr_y_stat_array)
            self.data['n'].append(curr_y_n_array)

        # calculate statistics
        self.data['xmin'] = self.data['x'][0]
        self.data['xmax'] = self.data['x'][len(self.data['x']) - 1]
        self.data['ymin'] = self.data['y'][0]
        self.data['ymax'] = self.data['y'][len(self.data['y']) - 1]
        self.data['zmin'] = zmin
        self.data['zmax'] = zmax
        self.data['sum'] = loop_sum
        self.data['glob_stats']['mean'] = loop_sum / n_points
        self.data['glob_stats']['minDate'] = min(m for m in self.data['minDateTextOutput'] if m != 'null')
        self.data['glob_stats']['maxDate'] = max(m for m in self.data['maxDateTextOutput'] if m != 'null')
        self.data['glob_stats']['n'] = n_points

    # function for querying the database and sending the returned data to the parser
    def query_db(self, cursor, statement, stat_line_type, statistic, plot_type, has_levels, hide_gaps,
                 completeness_qc_param, vts):
        object_data = []
        if stat_line_type == 'mode_pair':
            # there are two queries in this statement
            statements = statement.split(" ||| ")
            if statistic == "OTS (Object Threat Score)":
                # only the mode statistic OTS needs the additional object information provided by the first query.
                # we can ignore it for other stats
                try:
                    cursor.execute(statements[1])
                except pymysql.Error as e:
                    self.error = "Error executing query: " + str(e)
                else:
                    if cursor.rowcount == 0:
                        self.error = "INFO:0 data records found"
                    else:
                        # get object data
                        object_data = cursor.fetchall()
            statement = statements[0]

        try:
            cursor.execute(statement)
        except pymysql.Error as e:
            self.error = "Error executing query: " + str(e)
        else:
            if cursor.rowcount == 0:
                self.error = "INFO:0 data records found"
            else:
                if plot_type == 'TimeSeries' and not hide_gaps:
                    self.parse_query_data_timeseries(cursor, stat_line_type, statistic, has_levels,
                                                     completeness_qc_param, vts, object_data)
                elif plot_type == 'Histogram':
                    self.parse_query_data_histogram(cursor, stat_line_type, statistic, has_levels, object_data)
                elif plot_type == 'Contour':
                    self.parse_query_data_contour(cursor, stat_line_type, statistic, has_levels)
                elif plot_type == 'Reliability' or plot_type == 'ROC' or plot_type == 'PerformanceDiagram':
                    self.parse_query_data_ensemble(cursor, plot_type)
                elif plot_type == 'EnsembleHistogram':
                    self.parse_query_data_ensemble_histogram(cursor, statistic, has_levels)
                else:
                    self.parse_query_data_specialty_curve(cursor, stat_line_type, statistic, plot_type, has_levels,
                                                          hide_gaps, completeness_qc_param, object_data)

    # makes sure all expected options were indeed passed in
    def validate_options(self, options):
        assert True, options.host is not None and options.port is not None and options.user is not None \
                     and options.password is not None and options.database is not None \
                     and options.statement is not None and options.stat_line_type is not None \
                     and options.statistic is not None and options.plot_type is not None \
                     and options.has_levels is not None and options.hide_gaps is not None \
                     and options.completeness_qc_param is not None and options.vts is not None

    # process 'c' style options - using getopt - usage describes options
    def get_options(self, args):
        usage = ["(h)ost=", "(P)ort=", "(u)ser=", "(p)assword=", "(d)atabase=", "(q)uery=",
                 "stat_(L)ine_type=", "(s)tatistic=", "plot_(t)ype=", "has_(l)evels=", "hide_(g)aps=",
                 "(c)ompleteness_qc_param=", "(v)ts="]
        host = None
        port = None
        user = None
        password = None
        database = None
        statement = None
        stat_line_type = None
        statistic = None
        plot_type = None
        has_levels = None
        hide_gaps = None
        completeness_qc_param = None
        vts = None

        try:
            opts, args = getopt.getopt(args[1:], "h:p:u:P:d:q:L:s:t:l:g:c:v:", usage)
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
            elif o == "-q":
                statement = a
            elif o == "-L":
                stat_line_type = a
            elif o == "-s":
                statistic = a
            elif o == "-t":
                plot_type = a
            elif o == "-l":
                has_levels = a
            elif o == "-g":
                hide_gaps = a
            elif o == "-c":
                completeness_qc_param = a
            elif o == "-v":
                vts = a
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, host is not None and port is not None and user is not None and password is not None \
                     and database is not None and statement is not None and stat_line_type is not None \
                     and statistic is not None and plot_type is not None and has_levels is not None \
                     and hide_gaps is not None and completeness_qc_param is not None and vts is not None
        options = {
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "database": database,
            "statement": statement,
            "stat_line_type": stat_line_type,
            "statistic": statistic,
            "plot_type": plot_type,
            "has_levels": True if has_levels == 'true' else False,
            "hide_gaps": True if hide_gaps == 'true' else False,
            "completeness_qc_param": float(completeness_qc_param),
            "vts": vts
        }
        return options

    def do_query(self, options):
        self.validate_options(options)
        cnx = pymysql.Connect(host=options["host"], port=options["port"], user=options["user"],
                              passwd=options["password"],
                              db=options["database"], charset='utf8',
                              cursorclass=pymysql.cursors.DictCursor)
        with closing(cnx.cursor()) as cursor:
            cursor.execute('set group_concat_max_len = 4294967295')
            self.query_db(cursor, options["statement"], options["stat_line_type"], options["statistic"],
                          options["plot_type"], options["has_levels"], options["hide_gaps"],
                          options["completeness_qc_param"], options["vts"])
        cnx.close()


if __name__ == '__main__':
    qutil = QueryUtil()
    options = qutil.get_options(sys.argv)
    qutil.do_query(options)
    qutil.construct_output_json()
    print(qutil.output_JSON)
