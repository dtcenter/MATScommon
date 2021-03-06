import getopt
import sys
import pymysql
import pymysql.cursors
import math
import numpy as np
import re
import json
from contextlib import closing


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
        "subVals": [],
        "subSecs": [],
        "subLevs": [],
        "stats": [],
        "text": [],
        "xTextOutput": [],
        "yTextOutput": [],
        "zTextOutput": [],
        "nTextOutput": [],
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

    # function for calculating anomaly correlation from MET partial sums
    def calculate_acc(self, fbar, obar, ffbar, oobar, fobar, total):
        try:
            denom = (np.power(total, 2) * ffbar - np.power(total, 2) * np.power(fbar, 2)) \
                    * (np.power(total, 2) * oobar - np.power(total, 2) * np.power(obar, 2))
            acc = (np.power(total, 2) * fobar - np.power(total, 2) * fbar * obar) / np.sqrt(denom)
        except TypeError as e:
            self.error = "Error calculating ACC: " + str(e)
            acc = np.empty(len(ffbar))
        except ValueError as e:
            self.error = "Error calculating ACC: " + str(e)
            acc = np.empty(len(ffbar))
        return acc

    # function for calculating vector anomaly correlation from MET partial sums
    def calculate_vacc(self, ufbar, vfbar, uobar, vobar, uvfobar, uvffbar, uvoobar):
        try:
            acc = (uvfobar - ufbar * uobar - vfbar * vobar) / (np.sqrt(uvffbar - ufbar * ufbar - vfbar * vfbar)
                            * np.sqrt(uvoobar - uobar * uobar - vobar * vobar))
        except TypeError as e:
            self.error = "Error calculating ACC: " + str(e)
            acc = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating ACC: " + str(e)
            acc = np.empty(len(ufbar))
        return acc

    # function for calculating RMSE from MET partial sums
    def calculate_rmse(self, ffbar, oobar, fobar):
        try:
            rmse = np.sqrt(ffbar + oobar - 2 * fobar)
        except TypeError as e:
            self.error = "Error calculating RMS: " + str(e)
            rmse = np.empty(len(ffbar))
        except ValueError as e:
            self.error = "Error calculating RMS: " + str(e)
            rmse = np.empty(len(ffbar))
        return rmse

    # function for calculating bias-corrected RMSE from MET partial sums
    def calculate_bcrmse(self, fbar, obar, ffbar, oobar, fobar):
        try:
            bcrmse = np.sqrt((ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2)
        except TypeError as e:
            self.error = "Error calculating RMS: " + str(e)
            bcrmse = np.empty(len(ffbar))
        except ValueError as e:
            self.error = "Error calculating RMS: " + str(e)
            bcrmse = np.empty(len(ffbar))
        return bcrmse

    # function for calculating MSE from MET partial sums
    def calculate_mse(self, ffbar, oobar, fobar):
        try:
            mse = ffbar + oobar - 2 * fobar
        except TypeError as e:
            self.error = "Error calculating RMS: " + str(e)
            mse = np.empty(len(ffbar))
        except ValueError as e:
            self.error = "Error calculating RMS: " + str(e)
            mse = np.empty(len(ffbar))
        return mse

    # function for calculating bias-corrected MSE from MET partial sums
    def calculate_bcmse(self, fbar, obar, ffbar, oobar, fobar):
        try:
            bcmse = (ffbar + oobar - 2 * fobar) - (fbar - obar) ** 2
        except TypeError as e:
            self.error = "Error calculating RMS: " + str(e)
            bcmse = np.empty(len(ffbar))
        except ValueError as e:
            self.error = "Error calculating RMS: " + str(e)
            bcmse = np.empty(len(ffbar))
        return bcmse

    # function for calculating additive bias from MET partial sums
    def calculate_me(self, fbar, obar):
        try:
            me = fbar - obar
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            me = np.empty(len(fbar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            me = np.empty(len(fbar))
        return me

    # function for calculating multiplicative bias from MET partial sums
    def calculate_mbias(self, fbar, obar):
        try:
            mbias = fbar / obar
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            mbias = np.empty(len(fbar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            mbias = np.empty(len(fbar))
        return mbias

    # function for calculating N from MET partial sums
    def calculate_n(self, total):
        return total

    # function for calculating forecast mean from MET partial sums
    def calculate_f_mean(self, fbar):
        return fbar

    # function for calculating observed mean from MET partial sums
    def calculate_o_mean(self, obar):
        return obar

    # function for calculating forecast stdev from MET partial sums
    def calculate_f_stdev(self, fbar, ffbar, total):
        try:
            fstdev = np.sqrt(((ffbar * total) - (fbar * total) * (fbar * total) / total) / (total - 1))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            fstdev = np.empty(len(fbar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            fstdev = np.empty(len(fbar))
        return fstdev

    # function for calculating observed stdev from MET partial sums
    def calculate_o_stdev(self, obar, oobar, total):
        try:
            ostdev = np.sqrt(((oobar * total) - (obar * total) * (obar * total) / total) / (total - 1))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            ostdev = np.empty(len(obar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            ostdev = np.empty(len(obar))
        return ostdev

    # function for calculating error stdev from MET partial sums
    def calculate_e_stdev(self, fbar, obar, ffbar, oobar, fobar, total):
        try:
            estdev = np.sqrt((((ffbar + oobar - 2 * fobar) * total) - ((fbar - obar) * total) * ((fbar - obar) * total) / total) / (total - 1))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            estdev = np.empty(len(fbar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            estdev = np.empty(len(fbar))
        return estdev

    # function for calculating pearson correlation from MET partial sums
    def calculate_pcc(self, fbar, obar, ffbar, oobar, fobar, total):
        try:
            pcc = (total ** 2 * fobar - total ** 2 * fbar * obar) / np.sqrt((total ** 2 * ffbar - total ** 2 * fbar ** 2) * (total ** 2 * oobar - total ** 2 * obar ** 2))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            pcc = np.empty(len(fbar))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            pcc = np.empty(len(fbar))
        return pcc

    # function for calculating forecast mean of wind vector length from MET partial sums
    def calculate_fbar(self, f_speed_bar):
        return f_speed_bar

    # function for calculating observed mean of wind vector length from MET partial sums
    def calculate_obar(self, o_speed_bar):
        return o_speed_bar

    # function for calculating forecast - observed mean of wind vector length from MET partial sums
    def calculate_fbar_m_obar(self, f_speed_bar, o_speed_bar):
        try:
            fbar_m_obar = f_speed_bar - o_speed_bar
        except TypeError as e:
            self.error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
            fbar_m_obar = np.empty(len(f_speed_bar))
        except ValueError as e:
            self.error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
            fbar_m_obar = np.empty(len(f_speed_bar))
        return fbar_m_obar

    # function for calculating abs(forecast - observed mean of wind vector length) from MET partial sums
    def calculate_fbar_m_obar_abs(self, f_speed_bar, o_speed_bar):
        try:
            fbar_m_obar_abs = np.absolute(self.calculate_fbar_m_obar(f_speed_bar, o_speed_bar))
        except TypeError as e:
            self.error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
            fbar_m_obar_abs = np.empty(len(f_speed_bar))
        except ValueError as e:
            self.error = "Error calculating forecast - observed mean of wind vector length: " + str(e)
            fbar_m_obar_abs = np.empty(len(f_speed_bar))
        return fbar_m_obar_abs

    # function for calculating forecast mean of wind vector direction from MET partial sums
    def calculate_fdir(self, ufbar, vfbar):
        fdir = self.calculate_wind_vector_dir(ufbar, vfbar)
        return fdir

    # function for calculating observed mean of wind vector direction from MET partial sums
    def calculate_odir(self, uobar, vobar):
        odir = self.calculate_wind_vector_dir(uobar, vobar)
        return odir

    # function for calculating forecast - observed mean of wind vector direction from MET partial sums
    def calculate_dir_err(self, ufbar, vfbar, uobar, vobar):
        try:
            dir_err = np.empty(len(ufbar))
            dir_err[:] = np.nan

            f_len = self.calculate_fbar_speed(ufbar, vfbar)
            uf = ufbar / f_len
            vf = vfbar / f_len

            o_len = self.calculate_obar_speed(uobar, vobar)
            uo = uobar / o_len
            vo = vobar / o_len

            a = vf * uo - uf * vo
            b = uf * uo + vf * vo
            dir_err = self.calculate_wind_vector_dir(a, b)

        except TypeError as e:
            self.error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
            dir_err = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating forecast - observed mean of wind vector direction: " + str(e)
            dir_err = np.empty(len(ufbar))
        return dir_err

    # function for calculating abs(forecast - observed mean of wind vector direction) from MET partial sums
    def calculate_dir_err_abs(self, ufbar, vfbar, uobar, vobar):
        try:
            dir_err_abs = np.absolute(self.calculate_dir_err(ufbar, vfbar, uobar, vobar))
        except TypeError as e:
            self.error = "Error calculating abs(forecast - observed mean of wind vector direction): " + str(e)
            dir_err_abs = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating abd(forecast - observed mean of wind vector direction): " + str(e)
            dir_err_abs = np.empty(len(ufbar))
        return dir_err_abs

    # function for calculating RMSE of forecast wind vector length from MET partial sums
    def calculate_fs_rms(self, uvffbar):
        try:
            fs_rms = np.sqrt(uvffbar)
        except TypeError as e:
            self.error = "Error calculating RMSE of forecast wind vector length: " + str(e)
            fs_rms = np.empty(len(uvffbar))
        except ValueError as e:
            self.error = "Error calculating RMSE of forecast wind vector length: " + str(e)
            fs_rms = np.empty(len(uvffbar))
        return fs_rms

    # function for calculating RMSE of observed wind vector length from MET partial sums
    def calculate_os_rms(self, uvoobar):
        try:
            os_rms = np.sqrt(uvoobar)
        except TypeError as e:
            self.error = "Error calculating RMSE of observed wind vector length: " + str(e)
            os_rms = np.empty(len(uvoobar))
        except ValueError as e:
            self.error = "Error calculating RMSE of observed wind vector length: " + str(e)
            os_rms = np.empty(len(uvoobar))
        return os_rms

    # function for calculating vector wind speed MSVE from MET partial sums
    def calculate_msve(self, uvffbar, uvfobar, uvoobar):
        try:
            msve = uvffbar - 2.0 * uvfobar + uvoobar
        except TypeError as e:
            self.error = "Error calculating vector wind speed MSVE: " + str(e)
            msve = np.empty(len(uvffbar))
        except ValueError as e:
            self.error = "Error calculating vector wind speed MSVE: " + str(e)
            msve = np.empty(len(uvffbar))
        return msve

    # function for calculating vector wind speed RMSVE from MET partial sums
    def calculate_rmsve(self, uvffbar, uvfobar, uvoobar):
        try:
            rmsve = np.sqrt(uvffbar - 2.0 * uvfobar + uvoobar)
        except TypeError as e:
            self.error = "Error calculating vector wind speed RMSVE: " + str(e)
            rmsve = np.empty(len(uvffbar))
        except ValueError as e:
            self.error = "Error calculating vector wind speed RMSVE: " + str(e)
            rmsve = np.empty(len(uvffbar))
        return rmsve

    # function for calculating forecast stdev of wind vector length from MET partial sums
    def calculate_fstdev(self, uvffbar, f_speed_bar):
        try:
            fstdev = np.sqrt(uvffbar - f_speed_bar**2)
        except TypeError as e:
            self.error = "Error calculating forecast stdev of wind vector length: " + str(e)
            fstdev = np.empty(len(uvffbar))
        except ValueError as e:
            self.error = "Error calculating forecast stdev of wind vector length: " + str(e)
            fstdev = np.empty(len(uvffbar))
        return fstdev

    # function for calculating observed stdev of wind vector length from MET partial sums
    def calculate_ostdev(self, uvoobar, o_speed_bar):
        try:
            ostdev = np.sqrt(uvoobar - o_speed_bar**2)
        except TypeError as e:
            self.error = "Error calculating observed stdev of wind vector length: " + str(e)
            ostdev = np.empty(len(uvoobar))
        except ValueError as e:
            self.error = "Error calculating observed stdev of wind vector length: " + str(e)
            ostdev = np.empty(len(uvoobar))
        return ostdev

    # function for calculating forecast length of mean wind vector from MET partial sums
    def calculate_fbar_speed(self, ufbar, vfbar):
        fspeed = self.calculate_wind_vector_speed(ufbar, vfbar)
        return fspeed

    # function for calculating observed length of mean wind vector from MET partial sums
    def calculate_obar_speed(self, uobar, vobar):
        ospeed = self.calculate_wind_vector_speed(uobar, vobar)
        return ospeed

    # function for calculating forecast - observed length of mean wind vector from MET partial sums
    def calculate_speed_err(self, ufbar, vfbar, uobar, vobar):
        try:
            speed_err = self.calculate_fbar_speed(ufbar, vfbar) - self.calculate_obar_speed(uobar, vobar)
        except TypeError as e:
            self.error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
            speed_err = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating forecast - observed length of mean wind vector: " + str(e)
            speed_err = np.empty(len(ufbar))
        return speed_err

    # function for calculating abs(forecast - observed length of mean wind vector) from MET partial sums
    def calculate_speed_err_abs(self, ufbar, vfbar, uobar, vobar):
        try:
            speed_err_abs = np.absolute(self.calculate_speed_err(ufbar, vfbar, uobar, vobar))
        except TypeError as e:
            self.error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
            speed_err_abs = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating abs(forecast - observed length of mean wind vector): " + str(e)
            speed_err_abs = np.empty(len(ufbar))
        return speed_err_abs

    # function for calculating length of forecast - observed mean wind vector from MET partial sums
    def calculate_vdiff_speed(self, ufbar, vfbar, uobar, vobar):
        try:
            vdiff_speed = self.calculate_wind_vector_speed(ufbar-uobar, vfbar-vobar)
        except TypeError as e:
            self.error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
            vdiff_speed = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating length of forecast - observed mean wind vector: " + str(e)
            vdiff_speed = np.empty(len(ufbar))
        return vdiff_speed

    # function for calculating abs(length of forecast - observed mean wind vector) from MET partial sums
    def calculate_vdiff_speed_abs(self, ufbar, vfbar, uobar, vobar):
        try:
            speed_err_abs = np.absolute(self.calculate_vdiff_speed(ufbar, vfbar, uobar, vobar))
        except TypeError as e:
            self.error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
            speed_err_abs = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating abs(length of forecast - observed mean wind vector): " + str(e)
            speed_err_abs = np.empty(len(ufbar))
        return speed_err_abs

    # function for calculating direction of forecast - observed mean wind vector from MET partial sums
    def calculate_vdiff_dir(self, ufbar, vfbar, uobar, vobar):
        try:
            vdiff_dir = self.calculate_wind_vector_dir(-(ufbar-uobar), -(vfbar-vobar))
        except TypeError as e:
            self.error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
            vdiff_dir = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating direction of forecast - observed mean wind vector: " + str(e)
            vdiff_dir = np.empty(len(ufbar))
        return vdiff_dir

    # function for calculating abs(direction of forecast - observed mean wind vector) from MET partial sums
    def calculate_vdiff_dir_abs(self, ufbar, vfbar, uobar, vobar):
        try:
            vdiff_dir_abs = np.absolute(self.calculate_vdiff_dir(ufbar, vfbar, uobar, vobar))
        except TypeError as e:
            self.error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
            vdiff_dir_abs = np.empty(len(ufbar))
        except ValueError as e:
            self.error = "Error calculating abs(direction of forecast - observed mean wind vector): " + str(e)
            vdiff_dir_abs = np.empty(len(ufbar))
        return vdiff_dir_abs

    # function for calculating wind direction from two vector components
    def calculate_wind_vector_dir(self, ucomp, vcomp):
        dirs = np.empty(len(ucomp))
        dirs[:] = np.nan
        try:
            tolerance = 0.00001
            np.arctan2(ucomp, vcomp, out=dirs, where=abs(ucomp) >= tolerance or abs(vcomp) >= tolerance)
            dirs = dirs - 360 * np.floor(dirs / 360)
        except TypeError as e:
            self.error = "Error calculating wind vector direction: " + str(e)
            dirs = np.empty(len(ucomp))
        except ValueError as e:
            self.error = "Error calculating wind vector direction: " + str(e)
            dirs = np.empty(len(ucomp))
        return dirs

    # function for calculating wind speed from two vector components
    def calculate_wind_vector_speed(self, ucomp, vcomp):
        try:
            speeds = np.sqrt(ucomp**2 + vcomp**2)
        except TypeError as e:
            self.error = "Error calculating wind vector speed: " + str(e)
            speeds = np.empty(len(ucomp))
        except ValueError as e:
            self.error = "Error calculating wind vector speed: " + str(e)
            speeds = np.empty(len(ucomp))
        return speeds

    # function for calculating critical skill index from MET contingency table counts
    def calculate_csi(self, fy_oy, fy_on, fn_oy):
        try:
            csi = fy_oy / (fy_oy + fy_on + fn_oy)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            csi = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            csi = np.empty(len(fy_oy))
        return csi

    # function for calculating false alarm rate from MET contingency table counts
    def calculate_far(self, fy_oy, fy_on):
        try:
            far = fy_on / (fy_oy + fy_on)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            far = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            far = np.empty(len(fy_oy))
        return far

    # function for calculating frequency bias from MET contingency table counts
    def calculate_fbias(self, fy_oy, fy_on, fn_oy):
        try:
            fbias = (fy_oy + fy_on) / (fy_oy + fn_oy)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            fbias = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            fbias = np.empty(len(fy_oy))
        return fbias

    # function for calculating Gilbert skill score from MET contingency table counts
    def calculate_gss(self, fy_oy, fy_on, fn_oy, total):
        try:
            gss = (fy_oy - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy)) / (fy_oy + fy_on + fn_oy - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            gss = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            gss = np.empty(len(fy_oy))
        return gss

    # function for calculating Heidke skill score from MET contingency table counts
    def calculate_hss(self, fy_oy, fy_on, fn_oy, fn_on, total):
        try:
            hss = (fy_oy + fn_on - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy) + ((fn_oy + fn_on) / total) * (fy_on + fn_on)) / (total - ((fy_oy + fy_on) / total) * (fy_oy + fn_oy) + ((fn_oy + fn_on) / total) * (fy_on + fn_on))
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            hss = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            hss = np.empty(len(fy_oy))
        return hss

    # function for calculating probability of detection (yes) from MET contingency table counts
    def calculate_pody(self, fy_oy, fn_oy):
        try:
            pody = fy_oy / (fy_oy + fn_oy)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            pody = np.empty(len(fy_oy))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            pody = np.empty(len(fy_oy))
        return pody

    # function for calculating probability of detection (no) from MET contingency table counts
    def calculate_podn(self, fy_on, fn_on):
        try:
            podn = fn_on / (fy_on + fn_on)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            podn = np.empty(len(fy_on))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            podn = np.empty(len(fy_on))
        return podn

    # function for calculating probability of false detection from MET contingency table counts
    def calculate_pofd(self, fy_on, fn_on):
        try:
            pofd = fy_on / (fy_on + fn_on)
        except TypeError as e:
            self.error = "Error calculating bias: " + str(e)
            pofd = np.empty(len(fy_on))
        except ValueError as e:
            self.error = "Error calculating bias: " + str(e)
            pofd = np.empty(len(fy_on))
        return pofd

    # function for determining and calling the appropriate scalar statistical calculation function
    def calculate_scalar_stat(self, statistic, fbar, obar, ffbar, oobar, fobar, total):
        stat_switch = {  # dispatcher of statistical calculation functions
            'ACC': self.calculate_acc,
            'RMSE': self.calculate_rmse,
            'Bias-corrected RMSE': self.calculate_bcrmse,
            'MSE': self.calculate_mse,
            'Bias-corrected MSE': self.calculate_bcmse,
            'ME (Additive bias)': self.calculate_me,
            'Multiplicative bias': self.calculate_mbias,
            'N': self.calculate_n,
            'Forecast mean': self.calculate_f_mean,
            'Observed mean': self.calculate_o_mean,
            'Forecast stdev': self.calculate_f_stdev,
            'Observed stdev': self.calculate_o_stdev,
            'Error stdev': self.calculate_e_stdev,
            'Pearson correlation': self.calculate_pcc
        }
        args_switch = {  # dispatcher of arguments for statistical calculation functions
            'ACC': (fbar, obar, ffbar, oobar, fobar, total),
            'RMSE': (ffbar, oobar, fobar),
            'Bias-corrected RMSE': (fbar, obar, ffbar, oobar, fobar),
            'MSE': (ffbar, oobar, fobar),
            'Bias-corrected MSE': (fbar, obar, ffbar, oobar, fobar),
            'ME (Additive bias)': (fbar, obar),
            'Multiplicative bias': (fbar, obar),
            'N': (total,),
            'Forecast mean': (fbar,),
            'Observed mean': (obar,),
            'Forecast stdev': (fbar, ffbar, total),
            'Observed stdev': (obar, oobar, total),
            'Error stdev': (fbar, obar, ffbar, oobar, fobar, total),
            'Pearson correlation': (fbar, obar, ffbar, oobar, fobar, total)
        }
        try:
            stat_args = args_switch[statistic]  # get args
            sub_stats = stat_switch[statistic](*stat_args)  # call stat function
            stat = np.nanmean(sub_stats)  # calculate overall stat
        except KeyError as e:
            self.error = "Error choosing statistic: " + str(e)
            sub_stats = np.empty(len(fbar))
            stat = 'null'
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            sub_stats = np.empty(len(fbar))
            stat = 'null'
        return sub_stats, stat

    # function for determining and calling the appropriate vector statistical calculation function
    def calculate_vector_stat(self, statistic, ufbar, vfbar, uobar, vobar, uvfobar, uvffbar, uvoobar, f_speed_bar,
                              o_speed_bar, total):
        stat_switch = {  # dispatcher of statistical calculation functions
            'Vector ACC': self.calculate_vacc,
            'Forecast length of mean wind vector': self.calculate_fbar_speed,
            'Observed length of mean wind vector': self.calculate_obar_speed,
            'Forecast length - observed length of mean wind vector': self.calculate_speed_err,
            'abs(Forecast length - observed length of mean wind vector)': self.calculate_speed_err_abs,
            'Length of forecast - observed mean wind vector': self.calculate_vdiff_speed,
            'abs(Length of forecast - observed mean wind vector)': self.calculate_vdiff_speed_abs,
            'Forecast direction of mean wind vector': self.calculate_fdir,
            'Observed direction of mean wind vector': self.calculate_odir,
            'Angle between mean forecast and mean observed wind vectors': self.calculate_dir_err,      #Fix this
            'abs(Angle between mean forecast and mean observed wind vectors)': self.calculate_dir_err_abs,      #Fix this
            'Direction of forecast - observed mean wind vector': self.calculate_vdiff_dir,      #Fix this
            'abs(Direction of forecast - observed mean wind vector)': self.calculate_vdiff_dir_abs,      #Fix this
            'RMSE of forecast wind vector length': self.calculate_fs_rms,
            'RMSE of observed wind vector length': self.calculate_os_rms,
            'Vector wind speed MSVE': self.calculate_msve,
            'Vector wind speed RMSVE': self.calculate_rmsve,
            'Forecast mean of wind vector length': self.calculate_fbar,
            'Observed mean of wind vector length': self.calculate_obar,
            'Forecast mean - observed mean of wind vector length': self.calculate_fbar_m_obar,
            'abs(Forecast mean - observed mean of wind vector length)': self.calculate_fbar_m_obar_abs,
            'Forecast stdev of wind vector length': self.calculate_fstdev,
            'Observed stdev of wind vector length': self.calculate_ostdev
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
            self.error = "Error choosing statistic: " + str(e)
            sub_stats = np.empty(len(ufbar))
            stat = 'null'
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            sub_stats = np.empty(len(ufbar))
            stat = 'null'
        return sub_stats, stat

    # function for determining and calling the appropriate contigency table count statistical calculation function
    def calculate_ctc_stat(self, statistic, fy_oy, fy_on, fn_oy, fn_on, total):
        stat_switch = {  # dispatcher of statistical calculation functions
            'CSI': self.calculate_csi,
            'FAR': self.calculate_far,
            'FBIAS': self.calculate_fbias,
            'GSS': self.calculate_gss,
            'HSS': self.calculate_hss,
            'PODy': self.calculate_pody,
            'PODn': self.calculate_podn,
            'POFD': self.calculate_pofd
        }
        args_switch = {  # dispatcher of arguments for statistical calculation functions
            'CSI': (fy_oy, fy_on, fn_oy),
            'FAR': (fy_oy, fy_on),
            'FBIAS': (fy_oy, fy_on, fn_oy),
            'GSS': (fy_oy, fy_on, fn_oy, total),
            'HSS': (fy_oy, fy_on, fn_oy, fn_on, total),
            'PODy': (fy_oy, fn_oy),
            'PODn': (fy_on, fn_on),
            'POFD': (fy_on, fn_on)
        }
        try:
            stat_args = args_switch[statistic]  # get args
            sub_stats = stat_switch[statistic](*stat_args)  # call stat function
            stat = np.nanmean(sub_stats)  # calculate overall stat
        except KeyError as e:
            self.error = "Error choosing statistic: " + str(e)
            sub_stats = np.empty(len(fy_oy))
            stat = 'null'
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            sub_stats = np.empty(len(fy_oy))
            stat = 'null'
        return sub_stats, stat

    # function for processing the sub-values from the query and calling a calculate_stat function
    def get_stat(self, has_levels, row, statistic, stat_line_type):
        try:
            # get all of the sub-values for each time
            if stat_line_type == 'scalar':
                if 'sub_data' in row:
                    # everything except contour plots should be in this format
                    sub_data = str(row['sub_data']).split(',')
                    sub_fbar = []
                    sub_obar = []
                    sub_ffbar = []
                    sub_oobar = []
                    sub_fobar = []
                    sub_total = []
                    sub_secs = []
                    sub_levs = []
                    for sub_datum in sub_data:
                        sub_datum = sub_datum.split(';')
                        sub_fbar.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                        sub_obar.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                        sub_ffbar.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                        sub_oobar.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                        sub_fobar.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                        sub_total.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                        sub_secs.append(float(sub_datum[6]) if float(sub_datum[6]) != -9999 else np.nan)
                        if len(sub_datum) > 7:
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
                else:
                    # contour plot data
                    sub_fbar = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fbar']).split(','))])
                    sub_obar = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_obar']).split(','))])
                    sub_ffbar = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_ffbar']).split(','))])
                    sub_oobar = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_oobar']).split(','))])
                    sub_fobar = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fobar']).split(','))])
                    sub_total = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_total']).split(','))])
                    sub_secs = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_secs']).split(','))])
                    if has_levels:
                        sub_levs_raw = str(row['sub_levs']).split(',')
                        if self.is_number(sub_levs_raw[0]):
                            sub_levs = np.array([int(i) if float(i) != -9999 else np.nan for i in sub_levs_raw])
                        else:
                            sub_levs = np.array(sub_levs_raw)
                    else:
                        sub_levs = np.empty(len(sub_secs))

                # calculate the scalar statistic
                sub_values, stat = self.calculate_scalar_stat(statistic, sub_fbar, sub_obar, sub_ffbar, sub_oobar,
                                                              sub_fobar, sub_total)
            elif stat_line_type == 'vector':
                if 'sub_data' in row:
                    # everything except contour plots should be in this format
                    sub_data = str(row['sub_data']).split(',')
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
                    sub_secs = []
                    sub_levs = []
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
                            if len(sub_datum) > 11:
                                if self.is_number(sub_datum[11]):
                                    sub_levs.append(int(sub_datum[11]) if float(sub_datum[11]) != -9999 else np.nan)
                                else:
                                    sub_levs.append(sub_datum[11])
                        else:
                            sub_total.append(float(sub_datum[7]) if float(sub_datum[7]) != -9999 else np.nan)
                            sub_secs.append(float(sub_datum[8]) if float(sub_datum[8]) != -9999 else np.nan)
                            if len(sub_datum) > 9:
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
                else:
                    # contour plot data
                    sub_ufbar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_ufbar']).split(','))])
                    sub_vfbar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_vfbar']).split(','))])
                    sub_uobar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_uobar']).split(','))])
                    sub_vobar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_vobar']).split(','))])
                    sub_uvfobar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_uvfobar']).split(','))])
                    sub_uvffbar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_uvffbar']).split(','))])
                    sub_uvoobar = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_uvoobar']).split(','))])
                    if "ACC" not in statistic:
                        sub_f_speed_bar = np.array(
                            [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_f_speed_bar']).split(','))])
                        sub_o_speed_bar = np.array(
                            [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_o_speed_bar']).split(','))])
                    else:
                        sub_f_speed_bar = np.array([])
                        sub_o_speed_bar = np.array([])
                    sub_total = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_total']).split(','))])
                    sub_secs = np.array(
                        [float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_secs']).split(','))])
                    if has_levels:
                        sub_levs_raw = str(row['sub_levs']).split(',')
                        if self.is_number(sub_levs_raw[0]):
                            sub_levs = np.array([int(i) if float(i) != -9999 else np.nan for i in sub_levs_raw])
                        else:
                            sub_levs = np.array(sub_levs_raw)
                    else:
                        sub_levs = np.empty(len(sub_secs))

                # calculate the scalar statistic
                sub_values, stat = self.calculate_vector_stat(statistic, sub_ufbar, sub_vfbar, sub_uobar, sub_vobar,
                                                              sub_uvfobar, sub_uvffbar, sub_uvoobar, sub_f_speed_bar,
                                                              sub_o_speed_bar, sub_total)
            elif stat_line_type == 'ctc':
                if 'sub_data' in row:
                    # everything except contour plots should be in this format
                    sub_data = str(row['sub_data']).split(',')
                    sub_fy_oy = []
                    sub_fy_on = []
                    sub_fn_oy = []
                    sub_fn_on = []
                    sub_total = []
                    sub_secs = []
                    sub_levs = []
                    for sub_datum in sub_data:
                        sub_datum = sub_datum.split(';')
                        sub_fy_oy.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                        sub_fy_on.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                        sub_fn_oy.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                        sub_fn_on.append(float(sub_datum[3]) if float(sub_datum[3]) != -9999 else np.nan)
                        sub_total.append(float(sub_datum[4]) if float(sub_datum[4]) != -9999 else np.nan)
                        sub_secs.append(float(sub_datum[5]) if float(sub_datum[5]) != -9999 else np.nan)
                        if len(sub_datum) > 6:
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
                else:
                    # contour plot data
                    sub_fy_oy = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fy_oy']).split(','))])
                    sub_fy_on = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fy_on']).split(','))])
                    sub_fn_oy = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fn_oy']).split(','))])
                    sub_fn_on = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_fn_on']).split(','))])
                    sub_total = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_total']).split(','))])
                    sub_secs = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_secs']).split(','))])
                    if has_levels:
                        sub_levs_raw = str(row['sub_levs']).split(',')
                        if self.is_number(sub_levs_raw[0]):
                            sub_levs = np.array([int(i) if float(i) != -9999 else np.nan for i in sub_levs_raw])
                        else:
                            sub_levs = np.array(sub_levs_raw)
                    else:
                        sub_levs = np.empty(len(sub_secs))

                # calculate the ctc statistic
                sub_values, stat = self.calculate_ctc_stat(statistic, sub_fy_oy, sub_fy_on, sub_fn_oy, sub_fn_on,
                                                           sub_total)
            elif stat_line_type == 'precalculated':
                if 'sub_data' in row:
                    # everything except contour plots should be in this format
                    stat = float(row['stat']) if float(row['stat']) != -9999 else 'null'
                    sub_data = str(row['sub_data']).split(',')
                    sub_values = []
                    sub_total = []
                    sub_secs = []
                    sub_levs = []
                    for sub_datum in sub_data:
                        sub_datum = sub_datum.split(';')
                        sub_values.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                        sub_total.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                        sub_secs.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                        if len(sub_datum) > 3:
                            if self.is_number(sub_datum[3]):
                                sub_levs.append(int(sub_datum[3]) if float(sub_datum[0]) != -9999 else np.nan)
                            else:
                                sub_levs.append(sub_datum[3])
                    sub_values = np.asarray(sub_values)
                    sub_total = np.asarray(sub_total)
                    sub_secs = np.asarray(sub_secs)
                    if len(sub_levs) == 0:
                        sub_levs = np.empty(len(sub_secs))
                    else:
                        sub_levs = np.asarray(sub_levs)
                else:
                    # contour plot data
                    sub_values = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_precalc_stat']).split(','))])
                    sub_total = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_total']).split(','))])
                    sub_secs = np.array([float(i) if float(i) != -9999 else np.nan for i in (str(row['sub_secs']).split(','))])
                    if has_levels:
                        sub_levs_raw = str(row['sub_levs']).split(',')
                        if self.is_number(sub_levs_raw[0]):
                            sub_levs = np.array([int(i) if float(i) != -9999 else np.nan for i in sub_levs_raw])
                        else:
                            sub_levs = np.array(sub_levs_raw)
                    else:
                        sub_levs = np.empty(len(sub_secs))
                    value_mean = np.mean(sub_values)
                    stat = value_mean if len(sub_values > 0) and self.is_number(value_mean) else 'null'

            else:
                stat = 'null'
                sub_secs = np.empty(0)
                sub_levs = np.empty(0)
                sub_values = np.empty(0)

        except KeyError as e:
            self.error = "Error parsing query data. The expected fields don't seem to be present " \
                         "in the results cache: " + str(e)
            # if we don't have the data we expect just stop now and return empty data objects
            return np.nan, np.empty(0), np.empty(0), np.empty(0)

        # if we do have the data we expect, return the requested statistic
        return stat, sub_levs, sub_secs, sub_values

    def get_ens_hist_stat(self, row, has_levels):
        try:
            # get all of the sub-values for each time
            stat = float(row['bin_count']) if float(row['bin_count']) > -1 else 'null'
            sub_data = str(row['sub_data']).split(',')
            sub_values = []
            sub_total = []
            sub_secs = []
            sub_levs = []
            for sub_datum in sub_data:
                sub_datum = sub_datum.split(';')
                sub_values.append(float(sub_datum[0]) if float(sub_datum[0]) != -9999 else np.nan)
                sub_total.append(float(sub_datum[1]) if float(sub_datum[1]) != -9999 else np.nan)
                sub_secs.append(float(sub_datum[2]) if float(sub_datum[2]) != -9999 else np.nan)
                if len(sub_datum) > 3:
                    if self.is_number(sub_datum[3]):
                        sub_levs.append(int(sub_datum[3]) if float(sub_datum[0]) != -9999 else np.nan)
                    else:
                        sub_levs.append(sub_datum[3])
            sub_values = np.asarray(sub_values)
            sub_total = np.asarray(sub_total)
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

        elif plot_type == 'ROC':
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
                    hr = float(hit / (float(hit) + miss))
                except ZeroDivisionError:
                    hr = None
                pody.append(hr)

                # POFD
                try:
                    pofd = float(fa / (float(fa) + cn))
                except ZeroDivisionError:
                    pofd = None
                far.append(pofd)

            # Reverse all of the lists (easier to graph)
            pody = pody[::-1]
            far = far[::-1]
            threshold_all = threshold_all[::-1]
            oy_all = oy_all[::-1]
            on_all = on_all[::-1]
            total_values = total_values[::-1]
            total_times = total_times[::-1]

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
    def parse_query_data_timeseries(self, cursor, stat_line_type, statistic, has_levels, completeness_qc_param, vts):
        # initialize local variables
        xmax = float("-inf")
        xmin = float("inf")
        curve_times = []
        curve_stats = []
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
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row['obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row['vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row['vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row['fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row['fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            self.n0.append(int(row['N0']))
            self.n_times.append(int(row['N_times']))

            if row_idx < len(query_data) - 1:  # make sure we have the smallest time interval for the while loop later
                time_diff = int(query_data[row_idx + 1]['avtime']) - int(row['avtime'])
                time_interval = time_diff if time_diff < time_interval else time_interval

            if data_exists:
                stat, sub_levs, sub_secs, sub_values = self.get_stat(has_levels, row, statistic, stat_line_type)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this time point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_secs = 'NaN'
                    if has_levels:
                        sub_levs = 'NaN'
            else:
                # there's no data at this time point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_secs = 'NaN'
                if has_levels:
                    sub_levs = 'NaN'

            # store parsed data for later
            curve_times.append(av_time)
            curve_stats.append(stat)
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
                    self.data['subVals'].append('NaN')
                    self.data['subSecs'].append('NaN')
                    if has_levels:
                        self.data['subLevs'].append('NaN')
                # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                else:
                    # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                    loop_sum += curve_stats[d_idx]
                    list_vals = sub_vals_all[d_idx].tolist()
                    list_secs = sub_secs_all[d_idx].tolist()
                    if has_levels:
                        list_levs = sub_levs_all[d_idx].tolist()
                    # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
                    bad_value_indices = [index for index, value in enumerate(list_vals) if not self.is_number(value)]
                    for bad_value_index in sorted(bad_value_indices, reverse=True):
                        del list_vals[bad_value_index]
                        del list_secs[bad_value_index]
                        if has_levels:
                            del list_levs[bad_value_index]
                    # store data
                    self.data['x'].append(loop_time)
                    self.data['y'].append(curve_stats[d_idx])
                    self.data['error_y'].append('null')
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
    def parse_query_data_specialty_curve(self, cursor, stat_line_type, statistic, plot_type, has_levels, hide_gaps, completeness_qc_param):
        # initialize local variables
        ind_var_min = sys.float_info.max
        ind_var_max = -1 * sys.float_info.max
        curve_ind_vars = []
        curve_stats = []
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
            else:
                ind_var = int(row['avtime'])

            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row['obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row['vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row['vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row['fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row['fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            self.n0.append(int(row['N0']))
            self.n_times.append(int(row['N_times']))

            if data_exists:
                ind_var_min = ind_var if ind_var < ind_var_min else ind_var_min
                ind_var_max = ind_var if ind_var > ind_var_max else ind_var_max
                stat, sub_levs, sub_secs, sub_values = self.get_stat(has_levels, row, statistic, stat_line_type)
                if stat == 'null' or not self.is_number(stat):
                    # there's bad data at this point
                    stat = 'null'
                    sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    sub_secs = 'NaN'
                    if has_levels:
                        sub_levs = 'NaN'
            else:
                # there's no data at this point
                stat = 'null'
                sub_values = 'NaN'  # These are string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                sub_secs = 'NaN'
                if has_levels:
                    sub_levs = 'NaN'

            # deal with missing forecast cycles for dailyModelCycle plot type
            if plot_type == 'DailyModelCycle' and row_idx > 0 and (
                    int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000)) > 3600 * 24 * 1000:
                cycles_missing = math.ceil(
                    int(ind_var) - int(query_data[row_idx - 1]['avtime'] * 1000) / (3600 * 24 * 1000))-1
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
            sub_vals_all.append(sub_values)
            sub_secs_all.append(sub_secs)
            if has_levels:
                sub_levs_all.append(sub_levs)

        # make sure lists are definitely sorted by the float ind_var values, instead of their former strings
        if has_levels:
            curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all \
                = zip(*sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all, sub_levs_all)))
        else:
            curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all \
                = zip(*sorted(zip(curve_ind_vars, curve_stats, sub_vals_all, sub_secs_all)))

        n0_max = max(self.n0)
        n_times_max = max(self.n_times)
        loop_sum = 0
        dep_var_min = sys.float_info.max
        dep_var_max = -1 * sys.float_info.max

        # profiles have the levels sorted as strings, not numbers. Need to fix that
        if plot_type == 'Profile':
            curve_stats = [x for _, x in sorted(zip(curve_ind_vars, curve_stats))]
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
                        self.data['subVals'].append('NaN')
                        self.data['subSecs'].append('NaN')
                        self.data['subLevs'].append('NaN')
                        # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
                    else:
                        self.data['x'].append(ind_var)
                        self.data['y'].append('null')
                        self.data['error_y'].append('null')
                        self.data['subVals'].append('NaN')
                        self.data['subSecs'].append('NaN')
                        if has_levels:
                            self.data['subLevs'].append('NaN')
                        # We use string NaNs instead of numerical NaNs because the JSON encoder can't figure out what to do with np.nan or float('nan')
            else:
                # put the data in our final data dictionary, converting the numpy arrays to lists so we can jsonify
                loop_sum += curve_stats[d_idx]
                list_vals = sub_vals_all[d_idx].tolist()
                list_secs = sub_secs_all[d_idx].tolist()
                if has_levels:
                    list_levs = sub_levs_all[d_idx].tolist()
                # JSON can't deal with numpy nans in subarrays for some reason, so we remove them
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
                    self.data['subVals'].append(list_vals)
                    self.data['subSecs'].append(list_secs)
                    self.data['subLevs'].append(list_levs)
                else:
                    self.data['x'].append(ind_var)
                    self.data['y'].append(curve_stats[d_idx])
                    self.data['error_y'].append('null')
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
    def parse_query_data_histogram(self, cursor, stat_line_type, statistic, has_levels):
        # initialize local variables
        sub_vals_all = []
        sub_secs_all = []
        sub_levs_all = []

        # get query data and calculate starting time interval of the returned data
        query_data = cursor.fetchall()

        # loop through the query results and store the returned values
        for row in query_data:
            data_exists = False
            if stat_line_type == 'scalar':
                data_exists = row['fbar'] != "null" and row['fbar'] != "NULL" and row['obar'] != "null" and row['obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['ufbar'] != "null" and row['ufbar'] != "NULL" and row['vfbar'] != "null" and row['vfbar'] != "NULL" and row['uobar'] != "null" and row['uobar'] != "NULL" and row['vobar'] != "null" and row['vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['fy_oy'] != "null" and row['fy_oy'] != "NULL" and row['fy_on'] != "null" and row['fy_on'] != "NULL" and row['fn_oy'] != "null" and row['fn_oy'] != "NULL" and row['fn_on'] != "null" and row['fn_on'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['stat'] != "null" and row['stat'] != "NULL"
            self.n0.append(int(row['N0']))
            self.n_times.append(int(row['N_times']))

            if data_exists:
                stat, sub_levs, sub_secs, sub_values = self.get_stat(has_levels, row, statistic, stat_line_type)
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
                sub_vals_all.append(sub_values)
                sub_secs_all.append(sub_secs)
                if has_levels:
                    sub_levs_all.append(sub_levs)

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
            data_exists = row['bin'] != "null" and row['bin'] != "NULL" and row['bin_count'] != "null" and row['bin_count'] != "NULL"

            if data_exists:
                bin_number = int(row['bin'])
                bin_count = int(row['bin_count'])
                self.n0.append(int(row['N0']))
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
            data_exists = row['bin_number'] != "null" and row['bin_number'] != "NULL" and row['oy_i'] != "null" and row['oy_i'] != "NULL" and row['on_i'] != "null" and row['on_i'] != "NULL"

            if data_exists:
                bin_number = int(row['bin_number'])
                threshold = row['threshold']
                oy = int(row['oy_i'])
                on = int(row['on_i'])
                number_times = int(row['N_times'])
                number_values = int(row['N0'])

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
                data_exists = row['sub_fbar'] != "null" and row['sub_fbar'] != "NULL" and row['sub_obar'] != "null" and row['sub_obar'] != "NULL"
            elif stat_line_type == 'vector':
                data_exists = row['sub_ufbar'] != "null" and row['sub_ufbar'] != "NULL" and row['sub_vfbar'] != "null" and row['sub_vfbar'] != "NULL" and row['sub_uobar'] != "null" and row['sub_uobar'] != "NULL" and row['sub_vobar'] != "null" and row['sub_vobar'] != "NULL"
            elif stat_line_type == 'ctc':
                data_exists = row['sub_fy_oy'] != "null" and row['sub_fy_oy'] != "NULL" and row['sub_fy_on'] != "null" and row['sub_fy_on'] != "NULL" and row['sub_fn_oy'] != "null" and row['sub_fn_oy'] != "NULL" and row['sub_fn_on'] != "null" and row['sub_fn_on'] != "NULL"
            elif stat_line_type == 'precalculated':
                data_exists = row['sub_precalc_stat'] != "null" and row['sub_precalc_stat'] != "NULL"

            if data_exists:
                stat, sub_levs, sub_secs, sub_values = self.get_stat(has_levels, row, statistic, stat_line_type)
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
    def query_db(self, cursor, statement, stat_line_type, statistic, plot_type, has_levels, hide_gaps, completeness_qc_param, vts):
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
                                                     completeness_qc_param, vts)
                elif plot_type == 'Histogram':
                    self.parse_query_data_histogram(cursor, stat_line_type, statistic, has_levels)
                elif plot_type == 'Contour':
                    self.parse_query_data_contour(cursor, stat_line_type, statistic, has_levels)
                elif plot_type == 'Reliability' or plot_type == 'ROC':
                    self.parse_query_data_ensemble(cursor, plot_type)
                elif plot_type == 'EnsembleHistogram':
                    self.parse_query_data_ensemble_histogram(cursor, statistic, has_levels)
                else:
                    self.parse_query_data_specialty_curve(cursor, stat_line_type, statistic, plot_type, has_levels,
                                                          hide_gaps, completeness_qc_param)

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
