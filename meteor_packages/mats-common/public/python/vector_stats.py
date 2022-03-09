import numpy as np

error = ""


# function for calculating vector anomaly correlation from MET partial sums
def calculate_vacc(ufbar, vfbar, uobar, vobar, uvfobar, uvffbar, uvoobar):
    global error
    try:
        acc = (uvfobar - ufbar * uobar - vfbar * vobar) / (np.sqrt(uvffbar - ufbar * ufbar - vfbar * vfbar)
                                                           * np.sqrt(uvoobar - uobar * uobar - vobar * vobar))
    except TypeError as e:
        error = "Error calculating ACC: " + str(e)
        acc = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating ACC: " + str(e)
        acc = np.empty(len(ufbar))
    return acc


# function for calculating forecast mean of wind vector length from MET partial sums
def calculate_fbar(f_speed_bar):
    return f_speed_bar


# function for calculating observed mean of wind vector length from MET partial sums
def calculate_obar(o_speed_bar):
    return o_speed_bar


# function for calculating forecast - observed mean of wind vector length from MET partial sums
def calculate_fbar_m_obar(f_speed_bar, o_speed_bar):
    global error
    try:
        fbar_m_obar = f_speed_bar - o_speed_bar
    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar = np.empty(len(f_speed_bar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar = np.empty(len(f_speed_bar))
    return fbar_m_obar


# function for calculating abs(forecast - observed mean of wind vector length) from MET partial sums
def calculate_fbar_m_obar_abs(f_speed_bar, o_speed_bar):
    global error
    try:
        fbar_m_obar_abs = np.absolute(calculate_fbar_m_obar(f_speed_bar, o_speed_bar))
    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar_abs = np.empty(len(f_speed_bar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar_abs = np.empty(len(f_speed_bar))
    return fbar_m_obar_abs


# function for calculating forecast mean of wind vector direction from MET partial sums
def calculate_fdir(ufbar, vfbar):
    fdir = calculate_wind_vector_dir(ufbar, vfbar)
    return fdir


# function for calculating observed mean of wind vector direction from MET partial sums
def calculate_odir(uobar, vobar):
    odir = calculate_wind_vector_dir(uobar, vobar)
    return odir


# function for calculating forecast - observed mean of wind vector direction from MET partial sums
def calculate_dir_err(ufbar, vfbar, uobar, vobar):
    global error
    try:
        dir_err = np.empty(len(ufbar))
        dir_err[:] = np.nan

        f_len = calculate_fbar_speed(ufbar, vfbar)
        uf = ufbar / f_len
        vf = vfbar / f_len

        o_len = calculate_obar_speed(uobar, vobar)
        uo = uobar / o_len
        vo = vobar / o_len

        a = vf * uo - uf * vo
        b = uf * uo + vf * vo
        dir_err = calculate_wind_vector_dir(a, b)

    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
        dir_err = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
        dir_err = np.empty(len(ufbar))
    return dir_err


# function for calculating abs(forecast - observed mean of wind vector direction) from MET partial sums
def calculate_dir_err_abs(ufbar, vfbar, uobar, vobar):
    global error
    try:
        dir_err_abs = np.absolute(calculate_dir_err(ufbar, vfbar, uobar, vobar))
    except TypeError as e:
        error = "Error calculating abs(forecast - observed mean of wind vector direction): " + str(e)
        dir_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abd(forecast - observed mean of wind vector direction): " + str(e)
        dir_err_abs = np.empty(len(ufbar))
    return dir_err_abs


# function for calculating RMSE of forecast wind vector length from MET partial sums
def calculate_fs_rms(uvffbar):
    global error
    try:
        fs_rms = np.sqrt(uvffbar)
    except TypeError as e:
        error = "Error calculating RMSE of forecast wind vector length: " + str(e)
        fs_rms = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating RMSE of forecast wind vector length: " + str(e)
        fs_rms = np.empty(len(uvffbar))
    return fs_rms


# function for calculating RMSE of observed wind vector length from MET partial sums
def calculate_os_rms(uvoobar):
    global error
    try:
        os_rms = np.sqrt(uvoobar)
    except TypeError as e:
        error = "Error calculating RMSE of observed wind vector length: " + str(e)
        os_rms = np.empty(len(uvoobar))
    except ValueError as e:
        error = "Error calculating RMSE of observed wind vector length: " + str(e)
        os_rms = np.empty(len(uvoobar))
    return os_rms


# function for calculating vector wind speed MSVE from MET partial sums
def calculate_msve(uvffbar, uvfobar, uvoobar):
    global error
    try:
        msve = uvffbar - 2.0 * uvfobar + uvoobar
    except TypeError as e:
        error = "Error calculating vector wind speed MSVE: " + str(e)
        msve = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating vector wind speed MSVE: " + str(e)
        msve = np.empty(len(uvffbar))
    return msve


# function for calculating vector wind speed RMSVE from MET partial sums
def calculate_rmsve(uvffbar, uvfobar, uvoobar):
    global error
    try:
        rmsve = np.sqrt(uvffbar - 2.0 * uvfobar + uvoobar)
    except TypeError as e:
        error = "Error calculating vector wind speed RMSVE: " + str(e)
        rmsve = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating vector wind speed RMSVE: " + str(e)
        rmsve = np.empty(len(uvffbar))
    return rmsve


# function for calculating forecast stdev of wind vector length from MET partial sums
def calculate_fstdev(uvffbar, f_speed_bar):
    global error
    try:
        fstdev = np.sqrt(uvffbar - f_speed_bar ** 2)
    except TypeError as e:
        error = "Error calculating forecast stdev of wind vector length: " + str(e)
        fstdev = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating forecast stdev of wind vector length: " + str(e)
        fstdev = np.empty(len(uvffbar))
    return fstdev


# function for calculating observed stdev of wind vector length from MET partial sums
def calculate_ostdev(uvoobar, o_speed_bar):
    global error
    try:
        ostdev = np.sqrt(uvoobar - o_speed_bar ** 2)
    except TypeError as e:
        error = "Error calculating observed stdev of wind vector length: " + str(e)
        ostdev = np.empty(len(uvoobar))
    except ValueError as e:
        error = "Error calculating observed stdev of wind vector length: " + str(e)
        ostdev = np.empty(len(uvoobar))
    return ostdev


# function for calculating forecast length of mean wind vector from MET partial sums
def calculate_fbar_speed(ufbar, vfbar):
    fspeed = calculate_wind_vector_speed(ufbar, vfbar)
    return fspeed


# function for calculating observed length of mean wind vector from MET partial sums
def calculate_obar_speed(uobar, vobar):
    ospeed = calculate_wind_vector_speed(uobar, vobar)
    return ospeed


# function for calculating forecast - observed length of mean wind vector from MET partial sums
def calculate_speed_err(ufbar, vfbar, uobar, vobar):
    global error
    try:
        speed_err = calculate_fbar_speed(ufbar, vfbar) - calculate_obar_speed(uobar, vobar)
    except TypeError as e:
        error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
        speed_err = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
        speed_err = np.empty(len(ufbar))
    return speed_err


# function for calculating abs(forecast - observed length of mean wind vector) from MET partial sums
def calculate_speed_err_abs(ufbar, vfbar, uobar, vobar):
    global error
    try:
        speed_err_abs = np.absolute(calculate_speed_err(ufbar, vfbar, uobar, vobar))
    except TypeError as e:
        error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    return speed_err_abs


# function for calculating length of forecast - observed mean wind vector from MET partial sums
def calculate_vdiff_speed(ufbar, vfbar, uobar, vobar):
    global error
    try:
        vdiff_speed = calculate_wind_vector_speed(ufbar - uobar, vfbar - vobar)
    except TypeError as e:
        error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
        vdiff_speed = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
        vdiff_speed = np.empty(len(ufbar))
    return vdiff_speed


# function for calculating abs(length of forecast - observed mean wind vector) from MET partial sums
def calculate_vdiff_speed_abs(ufbar, vfbar, uobar, vobar):
    global error
    try:
        speed_err_abs = np.absolute(calculate_vdiff_speed(ufbar, vfbar, uobar, vobar))
    except TypeError as e:
        error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    return speed_err_abs


# function for calculating direction of forecast - observed mean wind vector from MET partial sums
def calculate_vdiff_dir(ufbar, vfbar, uobar, vobar):
    global error
    try:
        vdiff_dir = calculate_wind_vector_dir(-(ufbar - uobar), -(vfbar - vobar))
    except TypeError as e:
        error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
        vdiff_dir = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
        vdiff_dir = np.empty(len(ufbar))
    return vdiff_dir


# function for calculating abs(direction of forecast - observed mean wind vector) from MET partial sums
def calculate_vdiff_dir_abs(ufbar, vfbar, uobar, vobar):
    global error
    try:
        vdiff_dir_abs = np.absolute(calculate_vdiff_dir(ufbar, vfbar, uobar, vobar))
    except TypeError as e:
        error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
        vdiff_dir_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
        vdiff_dir_abs = np.empty(len(ufbar))
    return vdiff_dir_abs


# function for calculating wind direction from two vector components
def calculate_wind_vector_dir(ucomp, vcomp):
    global error
    dirs = np.empty(len(ucomp))
    dirs[:] = np.nan
    try:
        tolerance = 0.00001
        np.arctan2(ucomp, vcomp, out=dirs, where=abs(ucomp) >= tolerance or abs(vcomp) >= tolerance)
        dirs = dirs - 360 * np.floor(dirs / 360)
    except TypeError as e:
        error = "Error calculating wind vector direction: " + str(e)
        dirs = np.empty(len(ucomp))
    except ValueError as e:
        error = "Error calculating wind vector direction: " + str(e)
        dirs = np.empty(len(ucomp))
    return dirs


# function for calculating wind speed from two vector components
def calculate_wind_vector_speed(ucomp, vcomp):
    global error
    try:
        speeds = np.sqrt(ucomp ** 2 + vcomp ** 2)
    except TypeError as e:
        error = "Error calculating wind vector speed: " + str(e)
        speeds = np.empty(len(ucomp))
    except ValueError as e:
        error = "Error calculating wind vector speed: " + str(e)
        speeds = np.empty(len(ucomp))
    return speeds


# function for determining and calling the appropriate vector statistical calculation function
def calculate_vector_stat(statistic, ufbar, vfbar, uobar, vobar, uvfobar, uvffbar, uvoobar, f_speed_bar,
                          o_speed_bar, total):
    global error
    stat_switch = {  # dispatcher of statistical calculation functions
        'Vector ACC': calculate_vacc,
        'Forecast length of mean wind vector': calculate_fbar_speed,
        'Observed length of mean wind vector': calculate_obar_speed,
        'Forecast length - observed length of mean wind vector': calculate_speed_err,
        'abs(Forecast length - observed length of mean wind vector)': calculate_speed_err_abs,
        'Length of forecast - observed mean wind vector': calculate_vdiff_speed,
        'abs(Length of forecast - observed mean wind vector)': calculate_vdiff_speed_abs,
        'Forecast direction of mean wind vector': calculate_fdir,
        'Observed direction of mean wind vector': calculate_odir,
        'Angle between mean forecast and mean observed wind vectors': calculate_dir_err,  # Fix this
        'abs(Angle between mean forecast and mean observed wind vectors)': calculate_dir_err_abs,  # Fix this
        'Direction of forecast - observed mean wind vector': calculate_vdiff_dir,  # Fix this
        'abs(Direction of forecast - observed mean wind vector)': calculate_vdiff_dir_abs,  # Fix this
        'RMSE of forecast wind vector length': calculate_fs_rms,
        'RMSE of observed wind vector length': calculate_os_rms,
        'Vector wind speed MSVE': calculate_msve,
        'Vector wind speed RMSVE': calculate_rmsve,
        'Forecast mean of wind vector length': calculate_fbar,
        'Observed mean of wind vector length': calculate_obar,
        'Forecast mean - observed mean of wind vector length': calculate_fbar_m_obar,
        'abs(Forecast mean - observed mean of wind vector length)': calculate_fbar_m_obar_abs,
        'Forecast stdev of wind vector length': calculate_fstdev,
        'Observed stdev of wind vector length': calculate_ostdev
    }
    args_switch = {  # dispatcher of arguments for statistical calculation functions
        'Vector ACC': (ufbar, vfbar, uobar, vobar, uvfobar, uvffbar, uvoobar),
        'Forecast length of mean wind vector': (ufbar, vfbar),
        'Observed length of mean wind vector': (uobar, vobar),
        'Forecast length - observed length of mean wind vector': (ufbar, vfbar, uobar, vobar),
        'abs(Forecast length - observed length of mean wind vector)': (ufbar, vfbar, uobar, vobar),
        'Length of forecast - observed mean wind vector': (ufbar, vfbar, uobar, vobar),
        'abs(Length of forecast - observed mean wind vector)': (ufbar, vfbar, uobar, vobar),
        'Forecast direction of mean wind vector': (ufbar, vfbar),
        'Observed direction of mean wind vector': (uobar, vobar),
        'Angle between mean forecast and mean observed wind vectors': (ufbar, vfbar, uobar, vobar),
        'abs(Angle between mean forecast and mean observed wind vectors)': (ufbar, vfbar, uobar, vobar),
        'Direction of forecast - observed mean wind vector': (ufbar, vfbar, uobar, vobar),
        'abs(Direction of forecast - observed mean wind vector)': (ufbar, vfbar, uobar, vobar),
        'RMSE of forecast wind vector length': (uvffbar,),
        'RMSE of observed wind vector length': (uvoobar,),
        'Vector wind speed MSVE': (uvffbar, uvfobar, uvoobar),
        'Vector wind speed RMSVE': (uvffbar, uvfobar, uvoobar),
        'Forecast mean of wind vector length': (f_speed_bar,),
        'Observed mean of wind vector length': (o_speed_bar,),
        'Forecast mean - observed mean of wind vector length': (f_speed_bar, o_speed_bar),
        'abs(Forecast mean - observed mean of wind vector length)': (f_speed_bar, o_speed_bar),
        'Forecast stdev of wind vector length': (uvffbar, f_speed_bar),
        'Observed stdev of wind vector length': (uvoobar, o_speed_bar)
    }
    try:
        stat_args = args_switch[statistic]  # get args
        sub_stats = stat_switch[statistic](*stat_args)  # call stat function
        stat = np.nanmean(sub_stats)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.empty(len(ufbar))
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.empty(len(ufbar))
        stat = 'null'
    return sub_stats, stat, error
