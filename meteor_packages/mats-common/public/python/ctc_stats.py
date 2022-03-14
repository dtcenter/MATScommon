import numpy as np

error = ""


# function for calculating critical skill index from MET contingency table counts
def calculate_csi(fy_oy, fy_on, fn_oy):
    global error
    try:
        csi = fy_oy / (fy_oy + fy_on + fn_oy)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        csi = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        csi = np.empty(len(fy_oy))
    return csi


# function for calculating false alarm rate from MET contingency table counts
def calculate_far(fy_oy, fy_on):
    global error
    try:
        far = fy_on / (fy_oy + fy_on)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        far = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        far = np.empty(len(fy_oy))
    return far


# function for calculating frequency bias from MET contingency table counts
def calculate_fbias(fy_oy, fy_on, fn_oy):
    global error
    try:
        fbias = (fy_oy + fy_on) / (fy_oy + fn_oy)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        fbias = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        fbias = np.empty(len(fy_oy))
    return fbias


# function for calculating Gilbert skill score from MET contingency table counts
def calculate_gss(fy_oy, fy_on, fn_oy, total):
    global error
    try:
        gss = (fy_oy - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy)) / (
                fy_oy + fy_on + fn_oy - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        gss = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        gss = np.empty(len(fy_oy))
    return gss


# function for calculating Heidke skill score from MET contingency table counts
def calculate_hss(fy_oy, fy_on, fn_oy, fn_on, total):
    global error
    try:
        hss = (fy_oy + fn_on - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy) + ((fn_oy + fn_on) / total) *
               (fy_on + fn_on)) / (total - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy) + ((fn_oy + fn_on) / total)
                                   * (fy_on + fn_on))
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        hss = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        hss = np.empty(len(fy_oy))
    return hss


# function for calculating probability of detection (yes) from MET contingency table counts
def calculate_pody(fy_oy, fn_oy):
    global error
    try:
        pody = fy_oy / (fy_oy + fn_oy)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        pody = np.empty(len(fy_oy))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        pody = np.empty(len(fy_oy))
    return pody


# function for calculating probability of detection (no) from MET contingency table counts
def calculate_podn(fy_on, fn_on):
    global error
    try:
        podn = fn_on / (fy_on + fn_on)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        podn = np.empty(len(fy_on))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        podn = np.empty(len(fy_on))
    return podn


# function for calculating probability of false detection from MET contingency table counts
def calculate_pofd(fy_on, fn_on):
    global error
    try:
        pofd = fy_on / (fy_on + fn_on)
    except TypeError as e:
        error = "Error calculating bias: " + str(e)
        pofd = np.empty(len(fy_on))
    except ValueError as e:
        error = "Error calculating bias: " + str(e)
        pofd = np.empty(len(fy_on))
    return pofd


# function for determining and calling the appropriate contigency table count statistical calculation function
def calculate_ctc_stat(statistic, fy_oy, fy_on, fn_oy, fn_on, total):
    global error
    stat_switch = {  # dispatcher of statistical calculation functions
        'CSI (Critical Success Index)': calculate_csi,
        'FAR (False Alarm Ratio)': calculate_far,
        'FBIAS (Frequency Bias)': calculate_fbias,
        'GSS (Gilbert Skill Score)': calculate_gss,
        'HSS (Heidke Skill Score)': calculate_hss,
        'PODy (Probability of positive detection)': calculate_pody,
        'PODn (Probability of negative detection)': calculate_podn,
        'POFD (Probability of false detection)': calculate_pofd
    }
    args_switch = {  # dispatcher of arguments for statistical calculation functions
        'CSI (Critical Success Index)': (fy_oy, fy_on, fn_oy),
        'FAR (False Alarm Ratio)': (fy_oy, fy_on),
        'FBIAS (Frequency Bias)': (fy_oy, fy_on, fn_oy),
        'GSS (Gilbert Skill Score)': (fy_oy, fy_on, fn_oy, total),
        'HSS (Heidke Skill Score)': (fy_oy, fy_on, fn_oy, fn_on, total),
        'PODy (Probability of positive detection)': (fy_oy, fn_oy),
        'PODn (Probability of negative detection)': (fy_on, fn_on),
        'POFD (Probability of false detection)': (fy_on, fn_on)
    }
    try:
        stat_args = args_switch[statistic]  # get args
        sub_stats = stat_switch[statistic](*stat_args)  # call stat function
        stat = np.nanmean(sub_stats)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.empty(len(fy_oy))
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.empty(len(fy_oy))
        stat = 'null'
    return sub_stats, stat, error