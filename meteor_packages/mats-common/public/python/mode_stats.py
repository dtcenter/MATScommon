import numpy as np


def _get_interest2d(sub_interest, sub_mode_header_id, sub_pair_fid, sub_pair_oid):
    """helper function for MODE calculations"""
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


def _gc_dist(lon1, lat1, lon2, lat2):
    """helper function for MODE calculations"""
    r_e = 6.371e6  # [m]
    # Convert to radians
    lon1 = np.deg2rad(lon1)
    lon2 = np.deg2rad(lon2)
    lat1 = np.deg2rad(lat1)
    lat2 = np.deg2rad(lat2)
    theta = np.arccos(np.sin(lat1) * np.sin(lat2) + np.cos(lat1) * np.cos(lat2) * np.cos(lon1 - lon2))
    distance = r_e * theta
    return distance


def _calculate_mode_ctc(statistic, numpy_data, column_headers):
    """function for calculating contingency table stats from MET MODE output"""
    error = ""
    try:
        interest_idx = np.where(column_headers == 'interest')[0]
        pair_fid_idx = np.where(column_headers == 'object_f_id')[0]
        pair_oid_idx = np.where(column_headers == 'object_o_id')[0]
        mode_header_id_idx = np.where(column_headers == 'mode_header_id')[0]

        if numpy_data.shape[0] > 0:
            interest_2d_arrays, mode_header_lookup = _get_interest2d(numpy_data[:, interest_idx].flatten().astype(float),
                                                                     numpy_data[:, mode_header_id_idx].flatten(),
                                                                     numpy_data[:, pair_fid_idx].flatten(),
                                                                     numpy_data[:, pair_oid_idx].flatten())
            # Populate contingency table for matched objects
            n_hit = 0
            n_miss = 0
            n_fa = 0
            match_int = 0.70  # default interest threshold in METplus MODE
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
        error = "Error calculating ctc: " + str(e)
        ctc = 'null'
    except ValueError as e:
        error = "Error calculating ctc: " + str(e)
        ctc = 'null'
    return ctc, error


def calculate_ots(numpy_data, column_headers):
    """function for calculating object threat score from MET MODE output"""
    error = ""
    try:
        interest_idx = np.where(column_headers == 'interest')[0]
        pair_fid_idx = np.where(column_headers == 'object_f_id')[0]
        pair_oid_idx = np.where(column_headers == 'object_o_id')[0]
        mode_header_id_idx = np.where(column_headers == 'mode_header_id')[0]
        f_area_idx = np.where(column_headers == 'f_area')[0]
        o_area_idx = np.where(column_headers == 'o_area')[0]

        sub_interest = numpy_data[:, interest_idx].flatten().astype(float)
        sub_pair_fid = numpy_data[:, pair_fid_idx].flatten()
        sub_pair_oid = numpy_data[:, pair_oid_idx].flatten()
        sub_mode_header_id = numpy_data[:, mode_header_id_idx].flatten()
        sub_f_area = numpy_data[:, f_area_idx].flatten().astype(float)
        sub_o_area = numpy_data[:, o_area_idx].flatten().astype(float)

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
            sorted_f_area = sub_f_area[indices]
            sorted_o_area = sub_o_area[indices]
            matched_fid = {}
            matched_oid = {}
            all_f_areas = []
            all_o_areas = []
            for i in range(0, len(sub_interest)):
                this_mode_header_id = str(sorted_mode_header[i])
                this_fid = sorted_fid[i]
                this_oid = sorted_oid[i]
                f_area = sorted_f_area[i]
                o_area = sorted_o_area[i]
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
        error = "Error calculating ots: " + str(e)
        ots = 'null'
    except ValueError as e:
        error = "Error calculating ots: " + str(e)
        ots = 'null'
    return ots


def calculate_mmi(numpy_data, column_headers):
    """function for calculating median of maximum interest from MET MODE output"""
    error = ""
    try:
        interest_idx = np.where(column_headers == 'interest')[0]
        pair_fid_idx = np.where(column_headers == 'object_f_id')[0]
        pair_oid_idx = np.where(column_headers == 'object_o_id')[0]
        mode_header_id_idx = np.where(column_headers == 'mode_header_id')[0]

        if numpy_data.shape[0] > 0:
            interest_2d_arrays, mode_header_lookup = _get_interest2d(numpy_data[:, interest_idx].flatten().astype(float),
                                                                     numpy_data[:, mode_header_id_idx].flatten(),
                                                                     numpy_data[:, pair_fid_idx].flatten(),
                                                                     numpy_data[:, pair_oid_idx].flatten())
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
        error = "Error calculating mmi: " + str(e)
        mmi = 'null'
    except ValueError as e:
        error = "Error calculating mmi: " + str(e)
        mmi = 'null'
    return mmi


def calculate_ofb(numpy_data, column_headers):
    """function for calculating object frequency bias from MET MODE output"""
    error = ""
    try:
        interest_idx = np.where(column_headers == 'interest')[0]
        pair_fid_idx = np.where(column_headers == 'object_f_id')[0]
        pair_oid_idx = np.where(column_headers == 'object_o_id')[0]
        mode_header_id_idx = np.where(column_headers == 'mode_header_id')[0]

        if numpy_data.shape[0] > 0:
            interest_2d_arrays, mode_header_lookup = _get_interest2d(numpy_data[:, interest_idx].flatten().astype(float),
                                                                     numpy_data[:, mode_header_id_idx].flatten(),
                                                                     numpy_data[:, pair_fid_idx].flatten(),
                                                                     numpy_data[:, pair_oid_idx].flatten())
            # Sum the numbers of forecast and observed objects
            n_f = 0
            n_o = 0
            for key in mode_header_lookup:
                n_f = n_f + mode_header_lookup[key]["lookup_f_index"]
                n_o = n_o + mode_header_lookup[key]["lookup_o_index"]
            ofb = n_f / n_o
        else:
            ofb = 'null'
    except TypeError as e:
        error = "Error calculating ofb: " + str(e)
        ofb = 'null'
    except ValueError as e:
        error = "Error calculating ofb: " + str(e)
        ofb = 'null'
    return ofb


def calculate_mcd(numpy_data, column_headers):
    """function for calculating mean centroid distance from MET MODE output"""
    error = ""
    total_error_array = []
    try:
        interest_idx = np.where(column_headers == 'interest')[0]
        pair_fid_idx = np.where(column_headers == 'object_f_id')[0]
        pair_oid_idx = np.where(column_headers == 'object_o_id')[0]
        mode_header_id_idx = np.where(column_headers == 'mode_header_id')[0]
        cent_dist_idx = np.where(column_headers == 'centroid_dist')[0]

        sub_interest = numpy_data[:, interest_idx].flatten().astype(float)
        sub_pair_fid = numpy_data[:, pair_fid_idx].flatten()
        sub_pair_oid = numpy_data[:, pair_oid_idx].flatten()
        sub_mode_header_id = numpy_data[:, mode_header_id_idx].flatten()
        sub_cent_dist = numpy_data[:, cent_dist_idx].flatten().astype(float)

        if len(sub_pair_fid) > 0 and len(sub_pair_oid) > 0:
            # Mean distance calculated in a general sense using the same method as for OTS
            # this method does not require object "matches"
            # Sort the pair_interest array but keep that sorted interest linked with the pair object IDs
            indices = np.argsort(sub_interest)
            # reverse the indices array so that it goes descending from maximum
            indices = indices[::-1]
            sorted_fid = sub_pair_fid[indices]
            sorted_oid = sub_pair_oid[indices]
            sorted_mode_header = sub_mode_header_id[indices]
            sorted_cent_dist = sub_cent_dist[indices]

            matched_fid = {}
            matched_oid = {}
            for i in range(0, len(sub_interest)):
                this_mode_header_id = str(sorted_mode_header[i])
                this_fid = sorted_fid[i]
                this_oid = sorted_oid[i]
                this_cent_dist = sorted_cent_dist[i]
                if this_mode_header_id not in matched_fid.keys():
                    matched_fid[this_mode_header_id] = []
                    matched_oid[this_mode_header_id] = []
                if (this_fid not in matched_fid[this_mode_header_id]) and (this_oid not in matched_oid[this_mode_header_id]):
                    matched_fid[this_mode_header_id].append(this_fid)
                    matched_oid[this_mode_header_id].append(this_oid)
                    total_error_array.append(float(this_cent_dist))
            mcd = sum(total_error_array) / len(total_error_array)
        else:
            mcd = 'null'
    except TypeError as e:
        error = "Error calculating ofb: " + str(e)
        mcd = 'null'
    except ValueError as e:
        error = "Error calculating ofb: " + str(e)
        mcd = 'null'
    return mcd


def calculate_mode_csi(numpy_data, column_headers):
    """function for calculating CSI from MET MODE output"""
    try:
        csi, error = _calculate_mode_ctc("CSI (Critical Success Index)", numpy_data, column_headers)
    except TypeError as e:
        error = "Error calculating mode csi: " + str(e)
        csi = 'null'
    except ValueError as e:
        error = "Error calculating mode csi: " + str(e)
        csi = 'null'
    return csi


def calculate_mode_far(numpy_data, column_headers):
    """function for calculating FAR from MET MODE output"""
    try:
        far, error = _calculate_mode_ctc("FAR (False Alarm Ratio)", numpy_data, column_headers)
    except TypeError as e:
        error = "Error calculating mode far: " + str(e)
        far = 'null'
    except ValueError as e:
        error = "Error calculating mode far: " + str(e)
        far = 'null'
    return far


def calculate_mode_pody(numpy_data, column_headers):
    """function for calculating PODy from MET MODE output"""
    try:
        pody, error = _calculate_mode_ctc("PODy (Probability of positive detection)", numpy_data, column_headers)
    except TypeError as e:
        error = "Error calculating mode pody: " + str(e)
        pody = 'null'
    except ValueError as e:
        error = "Error calculating mode pody: " + str(e)
        pody = 'null'
    return pody


