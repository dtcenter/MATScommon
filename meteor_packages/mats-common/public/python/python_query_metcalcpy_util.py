import getopt
import sys
import pymysql
import pymysql.cursors
import math
import numpy as np
import re
import json
from contextlib import closing
from calc_stats import get_stat


"""class that contains all of the tools necessary for querying the db and calculating statistics from the 
returned data. In the future, we plan to split this into two classes, one for querying and one for statistics."""
class QueryUtil:
    error = []  # one of the four fields to return at the end -- records any error message
    n0 = []  # one of the four fields to return at the end -- number of sub_values for each independent variable
    n_times = []  # one of the four fields to return at the end -- number of sub_secs for each independent variable
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
                "error_x": [],
                "error_y": [],
                "subData": [],
                "subHeaders": [],
                "subVals": [],
                "subSecs": [],
                "subLevs": [],
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
            })
            self.n0.append([])
            self.n_times.append([])
            self.error.append("")

    def construct_output_json(self):
        """function for constructing and jsonifying a dictionary of the output variables"""
        for i in range(0, len(self.data)):
            self.data[i]["individualObjLookup"] = []
            self.data[i]["subPairFid"] = []
            self.data[i]["subPairOid"] = []
            self.data[i]["subModeHeaderId"] = []
            self.data[i]["subCentDist"] = []
        self.output_JSON = {
            "data": self.data,
            "N0": self.n0,
            "N_times": self.n_times,
            "error": self.error
        }
        self.output_JSON = json.dumps(self.output_JSON)

    def is_number(self, s):
        """function to check if a certain value is a float or int"""
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

    def get_ens_hist_stat(self, idx, row, has_levels):
        """function for processing the sub-values from the query and getting the overall ensemble histogram statistics"""
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
                    sub_levs.append(sub_datum[3])
            sub_values = np.asarray(sub_values)
            sub_secs = np.asarray(sub_secs)
            if len(sub_levs) == 0:
                sub_levs = np.empty(len(sub_secs))
            else:
                sub_levs = np.asarray(sub_levs)

        except KeyError as e:
            self.error[idx] = "Error parsing query data. The expected fields don't seem to be present " \
                         "in the results cache: " + str(e)
            # if we don't have the data we expect just stop now and return empty data objects
            return np.nan, np.empty(0), np.empty(0), np.empty(0)

        # if we do have the data we expect, return the requested statistic
        return stat, sub_levs, sub_secs, sub_values

    def get_ens_stat(self, plot_type, forecast_total, observed_total, on_all, oy_all, threshold_all, total_times,
                     total_values):
        """function for processing the sub-values from the query and getting the overall ensemble statistics"""
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

    def get_object_row(self, ind_var, object_data, object_row_idx, plot_type):
        object_row = object_data[object_row_idx]
        if plot_type == 'ValidTime':
            object_ind_var = float(object_row['hr_of_day'])
        elif plot_type == 'GridScale':
            object_ind_var = float(object_row['gridscale'])
        elif plot_type == 'Profile':
            object_ind_var = float(str(object_row['avVal']).replace('P', ''))
        elif plot_type == 'DailyModelCycle' or plot_type == 'TimeSeries':
            object_ind_var = int(object_row['avtime']) * 1000
        elif plot_type == 'DieOff':
            object_ind_var = int(object_row['fcst_lead'])
            object_ind_var = object_ind_var if object_ind_var % 10000 != 0 else object_ind_var / 10000
        elif plot_type == 'Threshold':
            object_ind_var = float(object_row['thresh'].replace('=', '').replace('<', '').replace('>', ''))
        elif plot_type == 'YearToYear':
            object_ind_var = float(object_row['year'])
        else:
            object_ind_var = int(object_row['avtime'])
        if ind_var > object_ind_var and object_row_idx < len(object_data) - 1:
            # the time from the object row is too small, meaning it has no data row.
            # move on with the magic of recursion.
            object_row_idx = object_row_idx + 1
            object_ind_var, object_row, object_row_idx = self.get_object_row(ind_var, object_data, object_row_idx, plot_type)
        return object_ind_var, object_row, object_row_idx

    def get_time_interval(self, curr_time, time_interval, vts):
        """function for calculating the interval between the current time and the next time for models with irregular vts"""
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

    def parse_query_data_timeseries(self, idx, cursor, stat_line_type, statistic, app_params, vts, object_data):
        """function for parsing the data returned by a timeseries query"""
        # initialize local variables
        has_levels = app_params["hasLevels"]
        completeness_qc_param = float(app_params["completeness"]) / 100
        xmax = float("-inf")
        xmin = float("inf")
        curve_times = []
        curve_stats = []
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []
        sub_data_all = []
        sub_headers_all = []

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
        row_idx = 0
        object_row_idx = 0
        for row in query_data:
            av_seconds = int(row['avtime'])
            av_time = av_seconds * 1000
            xmin = av_time if av_time < xmin else xmin
            xmax = av_time if av_time > xmax else xmax
            if stat_line_type == 'mode_pair' and (statistic == "OTS (Object Threat Score)" or statistic == "Model-obs centroid distance (unique pairs)"):
                # in case loading wend wrong and we don't have all our rows
                if object_row_idx >= len(object_data):
                    continue
                object_av_seconds, object_row, object_row_idx = \
                    self.get_object_row(av_seconds, object_data, object_row_idx, "Default")
                if av_seconds < object_av_seconds and row_idx < len(query_data) - 1:
                    # the time from the object row is too large, meaning we are missing the correct object row
                    # for this data row. Skip this cycle.
                    row_idx = row_idx + 1
                    continue
            else:
                object_row = []
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL"
            elif stat_line_type == 'mode_pair':
                data_exists = row['interest'] != "null" and row['interest'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            if hasattr(row, 'N0'):
                self.n0[idx].append(int(row['N0']))
            else:
                self.n0[idx].append(int(row['N_times']))
            self.n_times[idx].append(int(row['N_times']))

            if row_idx < len(query_data) - 1:  # make sure we have the smallest time interval for the while loop later
                time_diff = int(query_data[row_idx + 1]['avtime']) - int(row['avtime'])
                time_interval = time_diff if time_diff < time_interval else time_interval

            if data_exists:
                stat, sub_levs, sub_secs, sub_values, sub_data, sub_headers, self.error[idx] \
                    = get_stat(row, statistic, stat_line_type, app_params, object_row)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this time point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_secs = 'NaN'
                    sub_levs = 'NaN'
                    sub_data = 'NaN'
                    sub_headers = 'NaN'
            else:
                # there's no data at this time point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_secs = 'NaN'
                sub_levs = 'NaN'
                sub_data = 'NaN'
                sub_headers = 'NaN'

            # store parsed data for later
            curve_times.append(av_time)
            curve_stats.append(stat)
            sub_data_all.append(sub_data)
            sub_headers_all.append(sub_headers)
            sub_vals_all.append(sub_values)
            sub_secs_all.append(sub_secs)
            if has_levels:
                sub_levs_all.append(sub_levs)

            # we successfully processed a cycle, so increment both indices
            row_idx = row_idx + 1
            object_row_idx = object_row_idx + 1

        n0_max = max(self.n0[idx])
        n_times_max = max(self.n_times[idx])

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
                self.data[idx]['x'].append(loop_time)
                self.data[idx]['y'].append('null')
                self.data[idx]['error_y'].append('null')
                self.data[idx]['subData'].append('NaN')
                self.data[idx]['subHeaders'].append('NaN')
                self.data[idx]['subVals'].append('NaN')
                self.data[idx]['subSecs'].append('NaN')
                if has_levels:
                    self.data[idx]['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
            else:
                d_idx = curve_times.index(loop_time)
                this_n0 = self.n0[idx][d_idx]
                this_n_times = self.n_times[idx][d_idx]
                # add a null if there were too many missing sub-values
                if curve_stats[d_idx] == 'null' or this_n_times < completeness_qc_param * n_times_max:
                    self.data[idx]['x'].append(loop_time)
                    self.data[idx]['y'].append('null')
                    self.data[idx]['error_y'].append('null')
                    self.data[idx]['subData'].append('NaN')
                    self.data[idx]['subHeaders'].append('NaN')
                    self.data[idx]['subVals'].append('NaN')
                    self.data[idx]['subSecs'].append('NaN')
                    if has_levels:
                        self.data[idx]['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                else:
                    # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                    loop_sum += curve_stats[d_idx]
                    list_data = sub_data_all[d_idx].tolist()
                    list_headers = sub_headers_all[d_idx].tolist()
                    list_vals = sub_vals_all[d_idx].tolist()
                    list_secs = sub_secs_all[d_idx]
                    if has_levels:
                        list_levs = sub_levs_all[d_idx]
                    else:
                        list_levs = []
                    # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                    if stat_line_type != 'mode_pair':
                        bad_value_indices = [index for index, value in enumerate(list_vals) if
                                             not self.is_number(value)]
                        for bad_value_index in sorted(bad_value_indices, reverse=True):
                            del list_data[bad_value_index]
                            del list_headers[bad_value_index]
                            del list_vals[bad_value_index]
                            del list_secs[bad_value_index]
                            if has_levels:
                                del list_levs[bad_value_index]
                    # store data
                    self.data[idx]['x'].append(loop_time)
                    self.data[idx]['y'].append(curve_stats[d_idx])
                    self.data[idx]['error_y'].append('null')
                    self.data[idx]['subData'].append(list_data)
                    self.data[idx]['subHeaders'].append(list_headers)
                    self.data[idx]['subVals'].append(list_vals)
                    self.data[idx]['subSecs'].append(list_secs)
                    if has_levels:
                        self.data[idx]['subLevs'].append(list_levs)
                    ymin = curve_stats[d_idx] if curve_stats[d_idx] < ymin else ymin
                    ymax = curve_stats[d_idx] if curve_stats[d_idx] > ymax else ymax

            if not regular:
                # vts are giving us an irregular cadence, so the interval most likely will not be the one calculated above
                time_interval = self.get_time_interval(loop_time, time_interval, vts)
            loop_time = loop_time + time_interval

        self.data[idx]['xmin'] = xmin
        self.data[idx]['xmax'] = xmax
        self.data[idx]['ymin'] = ymin
        self.data[idx]['ymax'] = ymax
        self.data[idx]['sum'] = loop_sum

    def parse_query_data_specialty_curve(self, idx, cursor, stat_line_type, statistic, app_params, object_data):
        """function for parsing the data returned by a profile/dieoff/threshold/validtime/gridscale etc query"""
        # initialize local variables
        plot_type = app_params["plotType"]
        hide_gaps = app_params["hideGaps"]
        has_levels = app_params["hasLevels"]
        completeness_qc_param = float(app_params["completeness"]) / 100
        ind_var_min = sys.float_info.max
        ind_var_max = -1 * sys.float_info.max
        curve_ind_vars = []
        curve_stats = []
        sub_interests_all = []
        sub_pair_fids_all = []
        sub_pair_oids_all = []
        sub_mode_header_ids_all = []
        sub_cent_dists_all = []
        individual_obj_lookups_all = []
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        row_idx = 0
        object_row_idx = 0
        for row in query_data:
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

            if stat_line_type == 'mode_pair' and (statistic == "OTS (Object Threat Score)" or statistic == "Model-obs centroid distance (unique pairs)"):
                # in case loading wend wrong and we don't have all our rows
                if object_row_idx >= len(object_data):
                    continue
                object_ind_var, object_row, object_row_idx = \
                    self.get_object_row(ind_var, object_data, object_row_idx, plot_type)
                if ind_var < object_ind_var and row_idx < len(query_data) - 1:
                    # the time from the object row is too large, meaning we are missing the correct object row
                    # for this data row. Skip this cycle.
                    row_idx = row_idx + 1
                    continue
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
                self.n0[idx].append(int(row['N0']))
            else:
                self.n0[idx].append(int(row['N_times']))
            self.n_times[idx].append(int(row['N_times']))

            if data_exists:
                ind_var_min = ind_var if ind_var < ind_var_min else ind_var_min
                ind_var_max = ind_var if ind_var > ind_var_max else ind_var_max
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, \
                    sub_mode_header_ids, sub_cent_dists, individual_obj_lookup, self.error[idx] \
                    = get_stat(row, statistic, stat_line_type, app_params, object_row)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_interests = 'NaN'
                    sub_pair_fids = 'NaN'
                    sub_pair_oids = 'NaN'
                    sub_mode_header_ids = 'NaN'
                    sub_cent_dists = 'NaN'
                    individual_obj_lookup = 'NaN'
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
                sub_cent_dists = 'NaN'
                individual_obj_lookup = 'NaN'
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
                    if stat_line_type == 'mode_pair':
                        sub_interests_all.append('NaN')
                        sub_pair_fids_all.append('NaN')
                        sub_pair_oids_all.append('NaN')
                        sub_mode_header_ids_all.append('NaN')
                        sub_cent_dists_all.append('NaN')
                        individual_obj_lookups_all.append('NaN')
                    else:
                        sub_vals_all.append(sub_values)
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
                sub_cent_dists_all.append(sub_cent_dists)
                individual_obj_lookups_all.append(individual_obj_lookup)
            else:
                sub_vals_all.append(sub_values)
            sub_secs_all.append(sub_secs)
            if has_levels:
                sub_levs_all.append(sub_levs)

            # we successfully processed a cycle, so increment both indices
            row_idx = row_idx + 1
            object_row_idx = object_row_idx + 1

        # make sure lists are definitely sorted by the float ind_var values, instead of their former strings
        if stat_line_type == 'mode_pair':
            if has_levels:
                curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all, \
                    sub_mode_header_ids_all, sub_cent_dists_all, individual_obj_lookups_all, sub_secs_all, sub_levs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all,
                                sub_mode_header_ids_all, sub_cent_dists_all, individual_obj_lookups_all, sub_secs_all, sub_levs_all)))
            else:
                curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all, \
                    sub_mode_header_ids_all, sub_cent_dists_all, individual_obj_lookups_all, sub_secs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_interests_all, sub_pair_fids_all, sub_pair_oids_all,
                                sub_mode_header_ids_all, sub_cent_dists_all, individual_obj_lookups_all, sub_secs_all)))
        else:
            if has_levels:
                curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all)))
            else:
                curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all = zip(
                    *sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all)))

        n0_max = max(self.n0[idx])
        n_times_max = max(self.n_times[idx])
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
                sub_cent_dists_all = [x for _, x in sorted(zip(curve_ind_vars, sub_cent_dists_all))]
                individual_obj_lookups_all = [x for _, x in sorted(zip(curve_ind_vars, individual_obj_lookups_all))]
            else:
                sub_vals_all = [x for _, x in sorted(zip(curve_ind_vars, sub_vals_all))]
            sub_secs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_secs_all))]
            sub_levs_all = [x for _, x in sorted(zip(curve_ind_vars, sub_levs_all))]
            curve_ind_vars = sorted(curve_ind_vars)

        for ind_var in curve_ind_vars:
            # the reason we need to loop through everything again is to add in nulls
            # for any bad data points along the curve.
            d_idx = curve_ind_vars.index(ind_var)
            this_n0 = self.n0[idx][d_idx]
            this_n_times = self.n_times[idx][d_idx]
            # add a null if there were too many missing sub-values
            if curve_stats[d_idx] == 'null' or this_n_times < completeness_qc_param * n_times_max:
                if not hide_gaps:
                    if plot_type == 'Profile':
                        # profile has the stat first, and then the ind_var. The others have ind_var and then stat.
                        # this is in the pattern of x-plotted-variable, y-plotted-variable.
                        self.data[idx]['x'].append('null')
                        self.data[idx]['y'].append(ind_var)
                        self.data[idx]['error_x'].append('null')
                    else:
                        self.data[idx]['x'].append(ind_var)
                        self.data[idx]['y'].append('null')
                        self.data[idx]['error_y'].append('null')
                    if stat_line_type == 'mode_pair':
                        self.data[idx]['subInterest'].append('NaN')
                        self.data[idx]['subPairFid'].append('NaN')
                        self.data[idx]['subPairOid'].append('NaN')
                        self.data[idx]['subModeHeaderId'].append('NaN')
                        self.data[idx]['subCentDist'].append('NaN')
                        self.data[idx]['individualObjLookup'].append('NaN')
                    else:
                        self.data[idx]['subVals'].append('NaN')
                    self.data[idx]['subSecs'].append('NaN')
                    if has_levels:
                        self.data[idx]['subLevs'].append('NaN')
                        # We use string NaNs instead of numerical NaNs because the JSON encoder
                        # can't figure out what to do with np.nan or float('nan')
            else:
                # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                loop_sum += curve_stats[d_idx]
                if stat_line_type == 'mode_pair':
                    list_interests = sub_interests_all[d_idx]
                    list_pair_fids = sub_pair_fids_all[d_idx]
                    list_pair_oids = sub_pair_oids_all[d_idx]
                    list_sub_mode_header_ids = sub_mode_header_ids_all[d_idx]
                    list_sub_cent_dists_all = sub_cent_dists_all[d_idx]
                    list_vals = []
                else:
                    list_interests = []
                    list_pair_fids = []
                    list_pair_oids = []
                    list_sub_mode_header_ids = []
                    list_sub_cent_dists_all = []
                    list_vals = sub_vals_all[d_idx].tolist()
                list_secs = sub_secs_all[d_idx]
                if has_levels:
                    list_levs = sub_levs_all[d_idx]
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
                    self.data[idx]['x'].append(curve_stats[d_idx])
                    self.data[idx]['y'].append(ind_var)
                    self.data[idx]['error_x'].append('null')
                else:
                    self.data[idx]['x'].append(ind_var)
                    self.data[idx]['y'].append(curve_stats[d_idx])
                    self.data[idx]['error_y'].append('null')
                if stat_line_type == 'mode_pair':
                    self.data[idx]['subInterest'].append(list_interests)
                    self.data[idx]['subPairFid'].append(list_pair_fids)
                    self.data[idx]['subPairOid'].append(list_pair_oids)
                    self.data[idx]['subModeHeaderId'].append(list_sub_mode_header_ids)
                    self.data[idx]['subCentDist'].append(list_sub_cent_dists_all)
                    self.data[idx]['individualObjLookup'].append(individual_obj_lookups_all[d_idx])
                else:
                    self.data[idx]['subVals'].append(list_vals)
                self.data[idx]['subSecs'].append(list_secs)
                if has_levels:
                    self.data[idx]['subLevs'].append(list_levs)
                dep_var_min = curve_stats[d_idx] if curve_stats[d_idx] < dep_var_min else dep_var_min
                dep_var_max = curve_stats[d_idx] if curve_stats[d_idx] > dep_var_max else dep_var_max

        if plot_type == 'Profile':
            self.data[idx]['xmin'] = dep_var_min
            self.data[idx]['xmax'] = dep_var_max
            self.data[idx]['ymin'] = ind_var_min
            self.data[idx]['ymax'] = ind_var_max
        else:
            self.data[idx]['xmin'] = ind_var_min
            self.data[idx]['xmax'] = ind_var_max
            self.data[idx]['ymin'] = dep_var_min
            self.data[idx]['ymax'] = dep_var_max
        self.data[idx]['sum'] = loop_sum

    def parse_query_data_histogram(self, idx, cursor, stat_line_type, statistic, app_params, object_data):
        """function for parsing the data returned by a histogram query"""
        # initialize local variables
        has_levels = app_params["hasLevels"]
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data and calculate starting time interval of the returned data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        row_idx = 0
        object_row_idx = 0
        for row in query_data:
            av_seconds = int(row['avtime'])
            if 'mode_pair' in stat_line_type and (statistic == "OTS (Object Threat Score)" or statistic == "Model-obs centroid distance (unique pairs)"):
                # in case loading wend wrong and we don't have all our rows
                if object_row_idx >= len(object_data):
                    continue
                object_av_seconds, object_row, object_row_idx = \
                    self.get_object_row(av_seconds, object_data, object_row_idx, "Default")
                if av_seconds < object_av_seconds and row_idx < len(query_data) - 1:
                    # the time from the object row is too large, meaning we are missing the correct object row
                    # for this data row. Skip this cycle.
                    row_idx = row_idx + 1
                    continue
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
                self.n0[idx].append(int(row['N0']))
            else:
                self.n0[idx].append(int(row['N_times']))
            self.n_times[idx].append(int(row['N_times']))

            if data_exists:
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, \
                    sub_mode_header_ids, sub_cent_dists, individual_obj_lookup, self.error[idx] \
                    = get_stat(row, statistic, stat_line_type, app_params, object_row)
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
                list_secs = sub_secs
                sub_secs_all.append(list_secs)
                if has_levels:
                    list_levs = sub_levs
                    sub_levs_all.append(list_levs)

            # we successfully processed a cycle, so increment both indices
            row_idx = row_idx + 1
            object_row_idx = object_row_idx + 1

        # we don't have bins yet, so we want all of the data in one array
        self.data[idx]['subVals'] = [item for sublist in sub_vals_all for item in sublist]
        self.data[idx]['subSecs'] = [item for sublist in sub_secs_all for item in sublist]
        if has_levels:
            self.data[idx]['subLevs'] = [item for sublist in sub_levs_all for item in sublist]

    def parse_query_data_ensemble_histogram(self, idx, cursor, statistic, app_params):
        """function for parsing the data returned by an ensemble histogram query"""
        # initialize local variables
        has_levels = app_params["hasLevels"]
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
                    self.n0[idx].append(int(row['N0']))
                else:
                    self.n0[idx].append(int(row['N_times']))
                self.n_times[idx].append(int(row['N_times']))

                # this function deals with rhist/phist/relp and rhist_rank/phist_bin/relp_ens tables
                stat, sub_levs, sub_secs, sub_values = self.get_ens_hist_stat(idx, row, has_levels)
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
                    list_secs = sub_secs
                    if has_levels:
                        list_levs = sub_levs

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
            self.data[idx]['x'] = bins
            self.data[idx]['y'] = bin_counts
            self.data[idx]['subVals'] = sub_vals_all
            self.data[idx]['subSecs'] = sub_secs_all
            self.data[idx]['subLevs'] = sub_levs_all
            self.data[idx]['xmax'] = max(bins)
            self.data[idx]['xmin'] = min(bins)
            self.data[idx]['ymax'] = max(bin_counts)
            self.data[idx]['ymin'] = 0

    def parse_query_data_ensemble(self, idx, cursor, app_params):
        """function for parsing the data returned by an ensemble query"""
        # initialize local variables
        plot_type = app_params["plotType"]
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
        self.n0[idx] = total_values
        self.n_times[idx] = total_times
        self.data[idx]['x'] = ens_stats[ens_stats["x_var"]]
        self.data[idx]['y'] = ens_stats[ens_stats["y_var"]]
        self.data[idx]['sample_climo'] = ens_stats["sample_climo"]
        self.data[idx]['threshold_all'] = ens_stats["threshold_all"]
        self.data[idx]['oy_all'] = ens_stats["oy_all"]
        self.data[idx]['on_all'] = ens_stats["on_all"]
        self.data[idx]['n'] = total_values
        self.data[idx]['auc'] = ens_stats["auc"]
        self.data[idx]['xmax'] = 1.0
        self.data[idx]['xmin'] = 0.0
        self.data[idx]['ymax'] = 1.0
        self.data[idx]['ymin'] = 0.0

    def parse_query_data_contour(self, idx, cursor, stat_line_type, statistic, app_params):
        """function for parsing the data returned by a contour query"""
        # initialize local variables
        has_levels = app_params["hasLevels"]
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
                stat, sub_levs, sub_secs, sub_values, sub_interests, sub_pair_fids, sub_pair_oids, \
                    sub_mode_header_ids, sub_cent_dists, individual_obj_lookup, self.error[idx] \
                    = get_stat(row, statistic, stat_line_type, app_params, [])
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
            self.data[idx]['xTextOutput'].append(row_x_val)
            self.data[idx]['yTextOutput'].append(row_y_val)
            self.data[idx]['zTextOutput'].append(stat)
            self.data[idx]['nTextOutput'].append(n)
            self.data[idx]['minDateTextOutput'].append(min_date)
            self.data[idx]['maxDateTextOutput'].append(max_date)
            curve_stat_lookup[stat_key] = stat
            curve_n_lookup[stat_key] = n

        # get the unique x and y values and sort the stats into the 2D z array accordingly
        self.data[idx]['x'] = sorted(list(set(self.data[idx]['xTextOutput'])))
        self.data[idx]['y'] = sorted(list(set(self.data[idx]['yTextOutput'])))

        loop_sum = 0
        n_points = 0
        zmin = sys.float_info.max
        zmax = -1 * sys.float_info.max
        for curr_y in self.data[idx]['y']:
            curr_y_stat_array = []
            curr_y_n_array = []
            for curr_x in self.data[idx]['x']:
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
            self.data[idx]['z'].append(curr_y_stat_array)
            self.data[idx]['n'].append(curr_y_n_array)

        # calculate statistics
        self.data[idx]['xmin'] = self.data[idx]['x'][0]
        self.data[idx]['xmax'] = self.data[idx]['x'][len(self.data[idx]['x']) - 1]
        self.data[idx]['ymin'] = self.data[idx]['y'][0]
        self.data[idx]['ymax'] = self.data[idx]['y'][len(self.data[idx]['y']) - 1]
        self.data[idx]['zmin'] = zmin
        self.data[idx]['zmax'] = zmax
        self.data[idx]['sum'] = loop_sum
        self.data[idx]['glob_stats']['mean'] = loop_sum / n_points
        self.data[idx]['glob_stats']['minDate'] = min(m for m in self.data[idx]['minDateTextOutput'] if m != 'null')
        self.data[idx]['glob_stats']['maxDate'] = max(m for m in self.data[idx]['maxDateTextOutput'] if m != 'null')
        self.data[idx]['glob_stats']['n'] = n_points

    def removePoint(self, data, di, plot_type, stat_var_name, has_levels):
        """utility to remove a point on a graph"""
        del (data["x"][di])
        del (data["y"][di])
        if plot_type == "PerformanceDiagram" or plot_type == "ROC":
            del (data["oy_all"][di])
            del (data["on_all"][di])
        if len(data['error_' + stat_var_name]) > 0:
            del (data['error_' + stat_var_name][di])
        if 0 <= di < len(data["subInterest"]):
            del (data["subInterest"][di])
            del (data["subPairFid"][di])
            del (data["subPairOid"][di])
            del (data["subModeHeaderId"][di])
            del (data["subCentDist"][di])
            if 0 <= di < len(data["individualObjLookup"]):
                # only OTS actually has anything in this array
                del (data["individualObjLookup"][di])
        else:
            del (data["subVals"][di])
        del (data["subSecs"][di])
        if has_levels:
            del (data["subLevs"][di])

    def nullPoint(self, data, di, stat_var_name, has_levels):
        """utility to make null a point on a graph"""
        data[stat_var_name][di] = 'null'
        if 0 <= di < len(data["subInterest"]):
            data["subInterest"][di] = 'NaN'
            data["subPairFid"][di] = 'NaN'
            data["subPairOid"][di] = 'NaN'
            data["subModeHeaderId"][di] = 'NaN'
            data["subCentDist"][di] = 'NaN'
            if 0 <= di < len(data["individualObjLookup"]):
                # only OTS actually has anything in this array
                data["individualObjLookup"][di] = 'NaN'
        else:
            data["subVals"][di] = 'NaN'
        data["subSecs"][di] = 'NaN'
        if has_levels:
            data["subLevs"][di] = 'NaN'

    def do_matching(self, options):
        """function for matching data in the output object"""
        sub_secs_raw = {}
        sub_levs_raw = {}
        sub_interest = []
        sub_pair_fid = []
        sub_pair_oid = []
        sub_mode_header_id = []
        sub_cent_dist = []
        sub_values = []
        sub_secs = []
        sub_levs = []
        independent_var_groups = []
        independent_var_has_point = []
        sub_intersections_object = {}
        sub_intersections_array = []
        sub_sec_intersection_object = {}
        sub_sec_intersection_array = []

        plot_type = options["query_array"][0]["appParams"]["plotType"]
        has_levels = options["query_array"][0]["appParams"]["hasLevels"]
        curves_length = len(self.data)

        if plot_type in ["EnsembleHistogram"]:
            remove_non_matching_ind_vars = False
        elif plot_type in ["TimeSeries", "Profile", "DieOff", "Threshold", "ValidTime", "GridScale", "DailyModelCycle",
                           "YearToYear", "Scatter2d", "Contour", "ContourDiff"]:
            remove_non_matching_ind_vars = True
        else:
            # Either matching is not supported for this pot type, or it's a histogram and we do the matching later
            # ["Reliability", "ROC", "PerformanceDiagram", "Histogram", "Map"]
            return

        # matching in this function is based on a curve's independent variable. For a timeseries, the independentVar
        # is epoch, for a profile, it's level, for a dieoff, it's forecast hour, for a threshold plot, it's threshold,
        # and for a valid time plot, it's hour of day. This function identifies the the independentVar values common
        # across all of the curves, and then the common sub times / levels / values for those independentVar values.

        # determine whether data.x or data.y is the independent variable, and which is the stat value
        if plot_type != "Profile":
            independent_var_name = 'x'
            stat_var_name = 'y'
        else:
            independent_var_name = 'y'
            stat_var_name = 'x'

        # find the matching independentVars shared across all curves
        for curve_index in range(0, curves_length):
            independent_var_groups.append([])  # array for the independentVars for each curve that are not null
            independent_var_has_point.append([])  # array for the * all * of the independentVars for each curve
            sub_secs.append(
                {})  # map of the individual record times (subSecs) going into each independentVar for each curve
            if has_levels:
                sub_levs.append(
                    {})  # map of the individual record levels (subLevs) going into each independentVar for each curve
            data = self.data[curve_index]

            # loop over every independentVar value in this curve
            for di in range(len(data[independent_var_name])):
                curr_independent_var = data[independent_var_name][di]
                if data[stat_var_name][di] != 'null':
                    # store raw secs for this independentVar value, since it's not a null point
                    sub_secs[curve_index][curr_independent_var] = data["subSecs"][di]
                    if has_levels:
                        # store raw levs for this independentVar value, since it's not a null point
                        sub_levs[curve_index][curr_independent_var] = data["subLevs"][di]
                    # store this independentVar value, since it's not a null point
                    independent_var_groups[curve_index].append(curr_independent_var)
                # store all the independentVar values, regardless of whether they're null
                independent_var_has_point[curve_index].append(curr_independent_var)

        matching_independent_vars = list(set.intersection(*map(set,
                                                               independent_var_groups)))  # all of the non-null independentVar values common across all the curves
        matching_independent_has_point = list(set.intersection(*map(set,
                                                                    independent_var_has_point)))  # all of the independentVar values common across all the curves, regardless of whether or not they're null

        if remove_non_matching_ind_vars:
            if has_levels:
                # loop over each common non-null independentVar value
                for fi in range(0, len(matching_independent_vars)):
                    curr_independent_var = matching_independent_vars[fi]
                    sub_intersections_object[curr_independent_var] = []
                    curr_sub_intersections = []
                    for si in range(0, len(sub_secs[0][curr_independent_var])):
                        # fill current intersection array with sec-lev pairs from the first curve
                        curr_sub_intersections.append(
                            [sub_secs[0][curr_independent_var][si], sub_levs[0][curr_independent_var][si]])
                    # loop over every curve after the first
                    for curve_index in range(1, curves_length):
                        temp_sub_intersections = []
                        for si in range(0, len(sub_secs[curve_index][curr_independent_var])):
                            # create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                            temp_pair = [sub_secs[curve_index][curr_independent_var][si],
                                         sub_levs[curve_index][curr_independent_var][si]]
                            # see if the individual sec-lev pair matches a pair from the current intersection array
                            if temp_pair in curr_sub_intersections:
                                # store matching pairs
                                temp_sub_intersections.append(temp_pair)
                        # replace current intersection array with array of only pairs that matched from this loop through.
                        curr_sub_intersections = temp_sub_intersections
                    # store the final intersecting subSecs array for this common non-null independentVar value
                    sub_intersections_object[curr_independent_var] = curr_sub_intersections
            else:
                # loop over each common non - null independentVar value
                for fi in range(0, len(matching_independent_vars)):
                    curr_independent_var = matching_independent_vars[fi]
                    # fill current subSecs intersection array with subSecs from the first curve
                    curr_sub_sec_intersection = sub_secs[0][curr_independent_var]
                    # loop over every curve after the first
                    for curve_index in range(1, curves_length):
                        # keep taking the intersection of the current subSecs intersection array with each curve's subSecs array for this independentVar value
                        curr_sub_sec_intersection = list(
                            set.intersection(set(curr_sub_sec_intersection),
                                             set(sub_secs[curve_index][curr_independent_var])))
                    # store the final intersecting subSecs array for this common non-null independentVar value
                    sub_sec_intersection_object[curr_independent_var] = curr_sub_sec_intersection
        else:
            # pull all subSecs and subLevs out of their bins, and back into one main array
            for curve_index in range(0, curves_length):
                data = self.data[curve_index]
                sub_secs_raw[curve_index] = []
                sub_secs[curve_index] = []
                if has_levels:
                    sub_levs_raw[curve_index] = []
                    sub_levs[curve_index] = []
                for di in range(0, len(data["x"])):
                    sub_secs_raw[curve_index].append(data["subSecs"][di])
                    if has_levels:
                        sub_levs_raw[curve_index].append(data["subLevs"][di])
                sub_secs[curve_index] = [item for sublist in sub_secs_raw[curve_index] for item in sublist]
                if has_levels:
                    sub_levs[curve_index] = [item for sublist in sub_levs_raw[curve_index] for item in sublist]

            if has_levels:
                # determine which seconds and levels are present in all curves
                for si in range(0, len(sub_secs[0])):
                    # fill current intersection array with sec-lev pairs from the first curve
                    sub_intersections_array.append([sub_secs[0][si], sub_levs[0][si]])
                # loop over every curve after the first
                for curve_index in range(1, curves_length):
                    temp_sub_intersections = []
                    for si in range(0, len(sub_secs[curve_index])):
                        # create an individual sec-lev pair for each index in the subSecs and subLevs arrays
                        temp_pair = [sub_secs[curve_index][si], sub_levs[curve_index][si]]
                        # see if the individual sec-lev pair matches a pair from the current intersection array
                        if temp_pair in sub_intersections_array:
                            # store matching pairs
                            temp_sub_intersections.append(temp_pair)
                    # replace current intersection array with array of only pairs that matched from this loop through
                    sub_intersections_array = temp_sub_intersections
            else:
                # determine which seconds are present in all curves
                # fill current subSecs intersection array with subSecs from the first curve
                sub_sec_intersection_array = sub_secs[0]
                # loop over every curve after the first
                for curve_index in range(1, curves_length):
                    # keep taking the intersection of the current subSecs intersection array with each curve's subSecs array
                    sub_sec_intersection_array = list(
                        set.intersection(set(sub_sec_intersection_array), set(sub_secs[curve_index])))

        # remove non-matching independentVars and subSecs
        for curve_index in range(0, curves_length):
            data = self.data[curve_index]
            # need to loop backwards through the data array so that we can splice non-matching indices
            # while still having the remaining indices in the correct order
            data_length = len(data[independent_var_name])
            for di in range(data_length - 1, -1, -1):
                if remove_non_matching_ind_vars:
                    if data[independent_var_name][di] not in matching_independent_vars:
                        # if this is not a common non-null independentVar value, we'll have to remove some data
                        if data[independent_var_name][di] not in matching_independent_has_point:
                            # if at least one curve doesn't even have a null here, much less a matching value (because of the cadence), just drop this independentVar
                            self.removePoint(data, di, plot_type, stat_var_name, has_levels)
                        else:
                            # if all of the curves have either data or nulls at this independentVar, and there is at least one null, ensure all of the curves are null
                            self.nullPoint(data, di, stat_var_name, has_levels)
                        # then move on to the next independentVar. There's no need to mess with the subSecs or subLevs
                        continue
                if 0 <= di < len(data["subInterest"]):
                    sub_interest = data["subInterest"][di]
                    sub_pair_fid = data["subPairFid"][di]
                    sub_pair_oid = data["subPairOid"][di]
                    sub_mode_header_id = data["subModeHeaderId"][di]
                    sub_cent_dist = data["subCentDist"][di]
                else:
                    sub_values = data["subVals"][di]
                sub_secs = data["subSecs"][di]
                if has_levels:
                    sub_levs = data["subLevs"][di]

                if (not has_levels and len(sub_secs) > 0) or (has_levels and len(sub_secs) > 0 and len(sub_levs) > 0):
                    curr_independent_var = data[independent_var_name][di]
                    new_sub_interest = []
                    new_sub_pair_fid = []
                    new_sub_pair_oid = []
                    new_sub_mode_header_id = []
                    new_sub_cent_dist = []
                    new_sub_values = []
                    new_sub_secs = []
                    if has_levels:
                        new_sub_levs = []

                    # loop over all subSecs for this independentVar
                    for si in range(0, len(sub_secs)):
                        if has_levels:
                            # create sec-lev pair for each sub value
                            temp_pair = [sub_secs[si], sub_levs[si]]
                        # keep the subValue only if its associated subSec / subLev is common to all curves for this independentVar
                        if (not remove_non_matching_ind_vars and
                            ((not has_levels and sub_secs[si] in sub_sec_intersection_array)
                             or (has_levels and temp_pair in sub_intersections_array))) or \
                                (remove_non_matching_ind_vars and
                                 ((not has_levels and sub_secs[si] in sub_sec_intersection_object[curr_independent_var])
                                  or (has_levels and temp_pair in sub_intersections_object[curr_independent_var]))):
                            if 0 <= di < len(data["subInterest"]):
                                new_sub_interest.append(sub_interest[si])
                                new_sub_pair_fid.append(sub_pair_fid[si])
                                new_sub_pair_oid.append(sub_pair_oid[si])
                                new_sub_mode_header_id.append(sub_mode_header_id[si])
                                new_sub_cent_dist.append(sub_cent_dist[si])
                            else:
                                new_sub_values.append(sub_values[si])
                            new_sub_secs.append(sub_secs[si])
                            if has_levels:
                                new_sub_levs.append(sub_levs[si])

                    if len(new_sub_secs) == 0:
                        # no matching sub-values, so null the point
                        self.nullPoint(data, di, stat_var_name, has_levels)
                    else:
                        # store the filtered data
                        if 0 <= di < len(data["subInterest"]):
                            data["subInterest"][di] = new_sub_interest
                            data["subPairFid"][di] = new_sub_pair_fid
                            data["subPairOid"][di] = new_sub_pair_oid
                            data["subModeHeaderId"][di] = new_sub_mode_header_id
                            data["subCentDist"][di] = new_sub_cent_dist
                        else:
                            data["subVals"][di] = new_sub_values
                        data["subSecs"][di] = new_sub_secs
                        if has_levels:
                            data["subLevs"][di] = new_sub_levs
                else:
                    # no sub-values to begin with, so null the point
                    self.nullPoint(data, di, stat_var_name, has_levels)

            data_length = len(data[independent_var_name])
            for di in range(0, data_length):
                if data[stat_var_name][di] != 'null':
                    if len(data["subInterest"]) > 0:
                        # Need to recalculate the MODE stat
                        new_stat, new_error = calculate_mode_stat(options["query_array"][curve_index]["statistic"],
                                                                  np.asarray(data["subInterest"][di]),
                                                                  np.asarray(data["subPairFid"][di]),
                                                                  np.asarray(data["subPairOid"][di]),
                                                                  np.asarray(data["subModeHeaderId"][di]),
                                                                  np.asarray(data["subCentDist"][di]),
                                                                  data["individualObjLookup"][di])
                        data[stat_var_name][di] = new_stat
                        if len(new_error) > 0:
                            self.error[curve_index] = new_error
                    else:
                        data[stat_var_name][di] = sum(data["subVals"][di]) / len(data["subVals"][di])

                    if self.is_number(data["x"][di]) and data["x"][di] < data["xmin"]:
                        data["xmin"] = data["x"][di]
                    if self.is_number(data["x"][di]) and data["x"][di] > data["xmax"]:
                        data["xmax"] = data["x"][di]
                    if self.is_number(data["y"][di]) and data["y"][di] < data["ymin"]:
                        data["ymin"] = data["y"][di]
                    if self.is_number(data["y"][di]) and data["y"][di] > data["ymax"]:
                        data["ymax"] = data["y"][di]

            self.data[curve_index] = data

    def query_db(self, cursor, query_array):
        """function for querying the database and sending the returned data to the parser"""
        for query in query_array:
            idx = query_array.index(query)
            object_data = []
            if query["statLineType"] == 'mode_pair':
                # there are two queries in this statement
                statements = query["statement"].split(" ||| ")
                if query["statistic"] == "OTS (Object Threat Score)" or query["statistic"] == "Model-obs centroid distance (unique pairs)":
                    # only the mode statistic OTS needs the additional object information provided by the first query.
                    # we can ignore it for other stats
                    try:
                        cursor.execute(statements[1])
                    except pymysql.Error as e:
                        self.error[idx] = "Error executing query: " + str(e)
                    else:
                        if cursor.rowcount == 0:
                            self.error[idx] = "INFO:0 data records found"
                        else:
                            # get object data
                            object_data = cursor.fetchall()
                statement = statements[0]
            else:
                statement = query["statement"]

            try:
                cursor.execute(statement)
            except pymysql.Error as e:
                self.error[idx] = "Error executing query: " + str(e)
            else:
                if cursor.rowcount == 0:
                    self.error[idx] = "INFO:0 data records found"
                else:
                    if query["appParams"]["plotType"] == 'TimeSeries' and not query["appParams"]["hideGaps"]:
                        self.parse_query_data_timeseries(idx, cursor, query["statLineType"], query["statistic"],
                                                         query["appParams"], query["vts"], object_data)
                    elif query["appParams"]["plotType"] == 'Histogram':
                        self.parse_query_data_histogram(idx, cursor, query["statLineType"], query["statistic"],
                                                        query["appParams"], object_data)
                    elif query["appParams"]["plotType"] == 'Contour':
                        self.parse_query_data_contour(idx, cursor, query["statLineType"], query["statistic"],
                                                      query["appParams"])
                    elif query["appParams"]["plotType"] == 'Reliability' or query["appParams"]["plotType"] == 'ROC' or \
                            query["appParams"]["plotType"] == 'PerformanceDiagram':
                        self.parse_query_data_ensemble(idx, cursor, query["appParams"])
                    elif query["appParams"]["plotType"] == 'EnsembleHistogram':
                        self.parse_query_data_ensemble_histogram(idx, cursor, query["statistic"], query["appParams"])
                    else:
                        self.parse_query_data_specialty_curve(idx, cursor, query["statLineType"], query["statistic"],
                                                              query["appParams"], object_data)

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
        qutil.do_matching(options)
    qutil.construct_output_json()
    print(qutil.output_JSON)
