import numpy as np
import metcalcpy.util.vl1l2_statistics as calc_vl1l2
import metcalcpy.util.val1l2_statistics as calc_val1l2


def calculate_vacc(numpy_data, column_headers, data_length):
    """function for calculating vector anomaly correlation from MET partial sums"""
    error = ""
    acc = np.empty([data_length])
    try:
        for idx in range(data_length):
            acc[idx] = calc_val1l2.calculate_val1l2_anom_corr(numpy_data[[idx], :], column_headers)
    except TypeError as e:
        error = "Error calculating ACC: " + str(e)
    except ValueError as e:
        error = "Error calculating ACC: " + str(e)
    return acc, error


def calculate_fbar(f_speed_bar):
    """function for calculating forecast mean of wind vector length from MET partial sums"""
    return f_speed_bar, ""


def calculate_obar(o_speed_bar):
    """function for calculating observed mean of wind vector length from MET partial sums"""
    return o_speed_bar, ""


def calculate_fbar_m_obar(f_speed_bar, o_speed_bar):
    """function for calculating forecast - observed mean of wind vector length from MET partial sums"""
    error = ""
    try:
        fbar_m_obar = f_speed_bar - o_speed_bar
    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar = np.empty(len(f_speed_bar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar = np.empty(len(f_speed_bar))
    return fbar_m_obar, error


def calculate_fbar_m_obar_abs(f_speed_bar, o_speed_bar):
    """function for calculating abs(forecast - observed mean of wind vector length) from MET partial sums"""
    try:
        stat, error = calculate_fbar_m_obar(f_speed_bar, o_speed_bar)
        fbar_m_obar_abs = np.absolute(stat)
    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar_abs = np.empty(len(f_speed_bar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
        fbar_m_obar_abs = np.empty(len(f_speed_bar))
    return fbar_m_obar_abs, error


def calculate_fdir(ufbar, vfbar):
    """function for calculating forecast mean of wind vector direction from MET partial sums"""
    fdir, error = calculate_wind_vector_dir(ufbar, vfbar)
    return fdir, error


def calculate_odir(uobar, vobar):
    """function for calculating observed mean of wind vector direction from MET partial sums"""
    odir, error = calculate_wind_vector_dir(uobar, vobar)
    return odir, error


def calculate_dir_err(ufbar, vfbar, uobar, vobar):
    """function for calculating forecast - observed mean of wind vector direction from MET partial sums"""
    try:
        dir_err = np.empty(len(ufbar))
        dir_err[:] = np.nan

        f_len, error = calculate_fbar_speed(ufbar, vfbar)
        uf = ufbar / f_len
        vf = vfbar / f_len

        o_len, error = calculate_obar_speed(uobar, vobar)
        uo = uobar / o_len
        vo = vobar / o_len

        a = vf * uo - uf * vo
        b = uf * uo + vf * vo
        dir_err, error = calculate_wind_vector_dir(a, b)

    except TypeError as e:
        error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
        dir_err = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
        dir_err = np.empty(len(ufbar))
    return dir_err, error


def calculate_dir_err_abs(ufbar, vfbar, uobar, vobar):
    """function for calculating abs(forecast - observed mean of wind vector direction) from MET partial sums"""
    try:
        dir_err, error = calculate_dir_err(ufbar, vfbar, uobar, vobar)
        dir_err_abs = np.absolute(dir_err)
    except TypeError as e:
        error = "Error calculating abs(forecast - observed mean of wind vector direction): " + str(e)
        dir_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abd(forecast - observed mean of wind vector direction): " + str(e)
        dir_err_abs = np.empty(len(ufbar))
    return dir_err_abs, error


def calculate_fs_rms(uvffbar):
    """function for calculating RMSE of forecast wind vector length from MET partial sums"""
    error = ""
    try:
        fs_rms = np.sqrt(uvffbar)
    except TypeError as e:
        error = "Error calculating RMSE of forecast wind vector length: " + str(e)
        fs_rms = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating RMSE of forecast wind vector length: " + str(e)
        fs_rms = np.empty(len(uvffbar))
    return fs_rms, error


def calculate_os_rms(uvoobar):
    """function for calculating RMSE of observed wind vector length from MET partial sums"""
    error = ""
    try:
        os_rms = np.sqrt(uvoobar)
    except TypeError as e:
        error = "Error calculating RMSE of observed wind vector length: " + str(e)
        os_rms = np.empty(len(uvoobar))
    except ValueError as e:
        error = "Error calculating RMSE of observed wind vector length: " + str(e)
        os_rms = np.empty(len(uvoobar))
    return os_rms, error


def calculate_msve(uvffbar, uvfobar, uvoobar):
    """function for calculating vector wind speed MSVE from MET partial sums"""
    error = ""
    try:
        msve = uvffbar - 2.0 * uvfobar + uvoobar
    except TypeError as e:
        error = "Error calculating vector wind speed MSVE: " + str(e)
        msve = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating vector wind speed MSVE: " + str(e)
        msve = np.empty(len(uvffbar))
    return msve, error


def calculate_rmsve(uvffbar, uvfobar, uvoobar):
    """function for calculating vector wind speed RMSVE from MET partial sums"""
    error = ""
    try:
        rmsve = np.sqrt(uvffbar - 2.0 * uvfobar + uvoobar)
    except TypeError as e:
        error = "Error calculating vector wind speed RMSVE: " + str(e)
        rmsve = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating vector wind speed RMSVE: " + str(e)
        rmsve = np.empty(len(uvffbar))
    return rmsve, error


def calculate_fstdev(uvffbar, f_speed_bar):
    """function for calculating forecast stdev of wind vector length from MET partial sums"""
    error = ""
    try:
        fstdev = np.sqrt(uvffbar - f_speed_bar ** 2)
    except TypeError as e:
        error = "Error calculating forecast stdev of wind vector length: " + str(e)
        fstdev = np.empty(len(uvffbar))
    except ValueError as e:
        error = "Error calculating forecast stdev of wind vector length: " + str(e)
        fstdev = np.empty(len(uvffbar))
    return fstdev, error


def calculate_ostdev(uvoobar, o_speed_bar):
    """function for calculating observed stdev of wind vector length from MET partial sums"""
    error = ""
    try:
        ostdev = np.sqrt(uvoobar - o_speed_bar ** 2)
    except TypeError as e:
        error = "Error calculating observed stdev of wind vector length: " + str(e)
        ostdev = np.empty(len(uvoobar))
    except ValueError as e:
        error = "Error calculating observed stdev of wind vector length: " + str(e)
        ostdev = np.empty(len(uvoobar))
    return ostdev, error


def calculate_fbar_speed(ufbar, vfbar):
    """function for calculating forecast length of mean wind vector from MET partial sums"""
    fspeed, error = calculate_wind_vector_speed(ufbar, vfbar)
    return fspeed, error


def calculate_obar_speed(uobar, vobar):
    """function for calculating observed length of mean wind vector from MET partial sums"""
    ospeed, error = calculate_wind_vector_speed(uobar, vobar)
    return ospeed, error


def calculate_speed_err(ufbar, vfbar, uobar, vobar):
    """function for calculating forecast - observed length of mean wind vector from MET partial sums"""
    try:
        speed1, error = calculate_fbar_speed(ufbar, vfbar)
        speed2, error = calculate_obar_speed(uobar, vobar)
        speed_err = speed1-speed2
    except TypeError as e:
        error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
        speed_err = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
        speed_err = np.empty(len(ufbar))
    return speed_err, error


def calculate_speed_err_abs(ufbar, vfbar, uobar, vobar):
    """function for calculating abs(forecast - observed length of mean wind vector) from MET partial sums"""
    try:
        speed_err, error = calculate_speed_err(ufbar, vfbar, uobar, vobar)
        speed_err_abs = np.absolute(speed_err)
    except TypeError as e:
        error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    return speed_err_abs, error


def calculate_vdiff_speed(ufbar, vfbar, uobar, vobar):
    """function for calculating length of forecast - observed mean wind vector from MET partial sums"""
    try:
        vdiff_speed, error = calculate_wind_vector_speed(ufbar - uobar, vfbar - vobar)
    except TypeError as e:
        error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
        vdiff_speed = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
        vdiff_speed = np.empty(len(ufbar))
    return vdiff_speed, error


def calculate_vdiff_speed_abs(ufbar, vfbar, uobar, vobar):
    """function for calculating abs(length of forecast - observed mean wind vector) from MET partial sums"""
    try:
        speed_err, error = calculate_vdiff_speed(ufbar, vfbar, uobar, vobar)
        speed_err_abs = np.absolute(speed_err)
    except TypeError as e:
        error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
        speed_err_abs = np.empty(len(ufbar))
    return speed_err_abs, error


def calculate_vdiff_dir(ufbar, vfbar, uobar, vobar):
    """function for calculating direction of forecast - observed mean wind vector from MET partial sums"""
    try:
        vdiff_dir, error = calculate_wind_vector_dir(-(ufbar - uobar), -(vfbar - vobar))
    except TypeError as e:
        error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
        vdiff_dir = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
        vdiff_dir = np.empty(len(ufbar))
    return vdiff_dir, error


def calculate_vdiff_dir_abs(ufbar, vfbar, uobar, vobar):
    """function for calculating abs(direction of forecast - observed mean wind vector) from MET partial sums"""
    try:
        vdiff_dir, error = calculate_vdiff_dir(ufbar, vfbar, uobar, vobar)
        vdiff_dir_abs = np.absolute(vdiff_dir)
    except TypeError as e:
        error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
        vdiff_dir_abs = np.empty(len(ufbar))
    except ValueError as e:
        error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
        vdiff_dir_abs = np.empty(len(ufbar))
    return vdiff_dir_abs, error


def calculate_wind_vector_dir(ucomp, vcomp):
    """function for calculating wind direction from two vector components"""
    error = ""
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
    return dirs, error


def calculate_wind_vector_speed(ucomp, vcomp):
    """function for calculating wind speed from two vector components"""
    error = ""
    try:
        speeds = np.sqrt(ucomp ** 2 + vcomp ** 2)
    except TypeError as e:
        error = "Error calculating wind vector speed: " + str(e)
        speeds = np.empty(len(ucomp))
    except ValueError as e:
        error = "Error calculating wind vector speed: " + str(e)
        speeds = np.empty(len(ucomp))
    return speeds, error


def calculate_vector_stat(statistic, numpy_data, column_headers):
    """function for determining and calling the appropriate vector statistical calculation function"""
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
    try:
        data_length = numpy_data.shape[0]
        sub_stats, error = stat_switch[statistic](numpy_data, column_headers, data_length)  # call stat function
        stat = np.nanmean(sub_stats)  # calculate overall stat
    except KeyError as e:
        error = "Error choosing statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    except ValueError as e:
        error = "Error calculating statistic: " + str(e)
        sub_stats = np.nan
        stat = 'null'
    return sub_stats, stat, error
