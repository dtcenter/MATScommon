import numpy as np

error = ""


# helper function for MODE calculations
def get_interest2d(sub_interest, sub_mode_header_id, sub_pair_fid, sub_pair_oid):
    # set up 2-dimensional interest arrays for calculating MODE stats
    # need a separate 2d array for each mode_header_id
    unique_mode_headers = list(set(sub_mode_header_id))
    mode_header_lookup = {}
    mode_index_lookup = {}
    interest_2d_arrays = {}
    for unique_header in unique_mode_headers:
        mode_header_lookup[str(unique_header)] = {
            "lookup_f_index": 0,
            "lookup_o_index": 0
        }
    for i in range(0, len(sub_interest)):
        # create indices for different mode_header_ids
        this_mode_header_id = str(sub_mode_header_id[i])
        if this_mode_header_id not in mode_index_lookup.keys():
            mode_index_lookup[this_mode_header_id] = {}
        this_fid = sub_pair_fid[i]
        this_oid = sub_pair_oid[i]
        if this_fid not in mode_index_lookup[this_mode_header_id].keys():
            mode_index_lookup[this_mode_header_id][this_fid] = \
                mode_header_lookup[this_mode_header_id]["lookup_f_index"]
            mode_header_lookup[this_mode_header_id]["lookup_f_index"] = \
                mode_header_lookup[this_mode_header_id]["lookup_f_index"] + 1
        if this_oid not in mode_index_lookup[this_mode_header_id].keys():
            mode_index_lookup[this_mode_header_id][this_oid] = \
                mode_header_lookup[this_mode_header_id]["lookup_o_index"]
            mode_header_lookup[this_mode_header_id]["lookup_o_index"] = \
                mode_header_lookup[this_mode_header_id]["lookup_o_index"] + 1
    for unique_header in unique_mode_headers:
        this_mode_header_id = str(unique_header)
        interest_2d_arrays[this_mode_header_id] = \
            np.zeros((mode_header_lookup[this_mode_header_id]["lookup_f_index"],
                      mode_header_lookup[this_mode_header_id]["lookup_o_index"]), dtype=np.float)
    for i in range(0, len(sub_interest)):
        this_mode_header_id = str(sub_mode_header_id[i])
        this_fid = sub_pair_fid[i]
        this_oid = sub_pair_oid[i]
        interest_2d_arrays[this_mode_header_id][mode_index_lookup[this_mode_header_id][this_fid],
                                                mode_index_lookup[this_mode_header_id][this_oid]] = sub_interest[i]
    return interest_2d_arrays, mode_header_lookup


# function for calculating object threat score from MET MODE output
def calculate_ots(sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id, sub_f_areas, sub_o_areas):
    global error
    try:
        ots_sum = 0.0
        if len(sub_pair_fid) > 0 and len(sub_pair_oid) > 0:
            # Sort the pair_interest array but keep that sorted interest linked with the pair object IDs
            indices = np.argsort(sub_interest)
            # reverse the indices array so that it goes descending from maximum
            indices = indices[::-1]
            sorted_int = sub_interest[indices]
            sorted_fid = sub_pair_fid[indices]
            sorted_oid = sub_pair_oid[indices]
            sorted_mode_header = sub_mode_header_id[indices]
            sorted_f_areas = sub_f_areas[indices]
            sorted_o_areas = sub_o_areas[indices]

            matched_fid = {}
            matched_oid = {}
            all_f_areas = []
            all_o_areas = []
            for i in range(0, len(sub_interest)):
                this_mode_header_id = str(sorted_mode_header[i])
                this_fid = sorted_fid[i]
                this_oid = sorted_oid[i]
                f_area = sorted_f_areas[i]
                o_area = sorted_o_areas[i]
                if this_mode_header_id not in matched_fid.keys():
                    matched_fid[this_mode_header_id] = []
                    matched_oid[this_mode_header_id] = []
                if (this_fid not in matched_fid[this_mode_header_id]) and (
                        this_oid not in matched_oid[this_mode_header_id]):
                    ots_sum += sorted_int[i] * (f_area + o_area)
                    matched_fid[this_mode_header_id].append(this_fid)
                    matched_oid[this_mode_header_id].append(this_oid)
                    all_f_areas.append(f_area)
                    all_o_areas.append(o_area)
            ots = ots_sum / (sum(all_f_areas) + sum(all_o_areas))
        else:
            ots = 'null'
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        ots = 'null'
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        ots = 'null'
    return ots


# function for calculating median of maximum interest from MET MODE output
def calculate_mmi(sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id):
    global error
    try:
        if len(sub_pair_fid) > 0 and len(sub_pair_oid) > 0:
            interest_2d_arrays, mode_header_lookup = get_interest2d(sub_interest, sub_mode_header_id,
                                                                    sub_pair_fid, sub_pair_oid)
            # Compute standard MMI first
            max_int_array = np.empty(0, dtype=np.float)
            for key in interest_2d_arrays:
                interest_2d = interest_2d_arrays[key]
                max_int = np.amax(interest_2d, axis=1)
                max_interest = np.append(max_int, np.amax(interest_2d, axis=0))
                max_int_array = np.append(max_int_array, max_interest)
            mmi = np.median(max_int_array)
        else:
            mmi = 'null'
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        mmi = 'null'
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        mmi = 'null'
    return mmi


# function for calculating median of maximum interest from MET MODE output
def calculate_mode_ctc(statistic, sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id):
    global error
    try:
        if len(sub_pair_fid) > 0 and len(sub_pair_oid) > 0:
            interest_2d_arrays, mode_header_lookup = get_interest2d(sub_interest, sub_mode_header_id,
                                                                    sub_pair_fid, sub_pair_oid)
            # Populate contingency table for matched objects
            n_hit = 0
            n_miss = 0
            n_fa = 0
            match_int = 0.70
            for key in interest_2d_arrays:
                interest_2d = interest_2d_arrays[key]
                max_f_index = mode_header_lookup[key]["lookup_f_index"]
                max_o_index = mode_header_lookup[key]["lookup_o_index"]
                for o in range(0, max_o_index):
                    found_hit = False
                    for f in range(0, max_f_index):
                        # hit
                        if interest_2d[f, o] >= match_int:
                            n_hit += 1
                            found_hit = True
                            break  # stop looking for other forecast objects that match to this observation one
                    if not found_hit:  # if we made it all the way through the f-loop without getting a hit, count a miss
                        n_miss += 1
                # Now search through the forecast objects to see if there were any false alarms
                for f in range(0, max_f_index):
                    found_hit = False
                    for o in range(0, max_o_index):
                        if interest_2d[f, o] > match_int:
                            found_hit = True
                            break
                    # If, after searching through all observation objects, we didn't get a match,
                    # then the forecast object is a false alarm
                    if not found_hit:
                        n_fa += 1

            if statistic == "CSI (Critical Success Index)":
                if n_hit + n_miss + n_fa > 0:
                    ctc = n_hit / (n_hit + n_fa + n_miss)
                else:
                    ctc = 'null'
            elif statistic == "PODy (Probability of positive detection)":
                if n_hit + n_miss > 0:
                    ctc = n_hit / (n_hit + n_miss)
                else:
                    ctc = 'null'
            elif statistic == "FAR (False Alarm Ratio)":
                if n_hit + n_fa > 0:
                    ctc = n_fa / (n_hit + n_fa)
                else:
                    ctc = 'null'
            else:
                ctc = 'null'
        else:
            ctc = 'null'
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        ctc = 'null'
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        ctc = 'null'
    return ctc


# function for determining and calling the appropriate contigency table count statistical calculation function
def calculate_mode_stat(statistic, sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id,
                        sub_f_areas, sub_o_areas):
    global error
    stat_switch = {  # dispatcher of statistical calculation functions
        'OTS (Object Threat Score)': calculate_ots,
        'MMI (Median of Maximum Interest)': calculate_mmi,
        'CSI (Critical Success Index)': calculate_mode_ctc,
        'FAR (False Alarm Ratio)': calculate_mode_ctc,
        'PODy (Probability of positive detection)': calculate_mode_ctc
    }
    args_switch = {  # dispatcher of arguments for statistical calculation functions
        'OTS (Object Threat Score)': (
            sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id, sub_f_areas, sub_o_areas),
        'MMI (Median of Maximum Interest)': (sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id),
        'CSI (Critical Success Index)': (statistic, sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id),
        'FAR (False Alarm Ratio)': (statistic, sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id),
        'PODy (Probability of positive detection)': (
            statistic, sub_interest, sub_pair_fid, sub_pair_oid, sub_mode_header_id)
    }
    try:
        stat_args = args_switch[statistic]  # get args
        stat = stat_switch[statistic](*stat_args)  # call stat function
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        stat = 'null'
    return stat, error
