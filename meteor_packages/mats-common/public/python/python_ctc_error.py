import getopt
import sys
import numpy as np
import json


# class that calculates error bar length for CTC plots
class CTCErrorUtil:
    error = ""          # one of the two fields to return at the end -- records any error message
    error_length = 0     # one of the two fields to return at the end -- the length of the error bars
    output_JSON = {}    # JSON structure to pass the two output fields back to the MATS JS

    # function for constructing and jsonifying a dictionary of the output variables
    def construct_output_json(self):
        self.output_JSON = {
            "error_length": self.error_length,
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

    # function for calculating true skill score
    def calculate_tss(self, hit, fa, miss, cn):
        try:
            tss = ((hit * cn - fa * miss) / ((hit + miss) * (fa + cn))) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            tss = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            tss = np.NaN
        return tss

    # function for calculating probability of positive detection
    def calculate_pody(self, hit, miss):
        try:
            pody = hit / (hit + miss) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            pody = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            pody = np.NaN
        return pody

    # function for calculating probability of negative detection
    def calculate_podn(self, fa, cn):
        try:
            podn = cn / (cn + fa) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            podn = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            podn = np.NaN
        return podn

    # function for calculating false alarm ratio
    def calculate_far(self, hit, fa):
        try:
            far = fa / (fa + hit) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            far = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            far = np.NaN
        return far

    # function for calculating multiplicative bias
    def calculate_bias(self, hit, fa, miss):
        try:
            bias = (hit + fa) / (hit + miss)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            bias = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            bias = np.NaN
        return bias

    # function for calculating critical skill index
    def calculate_csi(self, hit, fa, miss):
        try:
            csi = hit / (hit + miss + fa) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            csi = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            csi = np.NaN
        return csi

    # function for calculating Heidke skill score
    def calculate_hss(self, hit, fa, miss, cn):
        try:
            hss = 2 * (cn * hit - miss * fa) / ((cn + fa) * (fa + hit) + (cn + miss) * (miss + hit)) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            hss = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            hss = np.NaN
        return hss

    # function for calculating equitable threat score
    def calculate_ets(self, hit, fa, miss, cn):
        try:
            ets = (hit - ((hit + fa) * (hit + miss) / (hit + fa + miss + cn))) / ((hit + fa + miss) - ((hit + fa) * (hit + miss) / (hit + fa + miss + cn))) * 100
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ets = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ets = np.NaN
        return ets

    # function for calculating number below threshold
    def calculate_nlow(self, hit, miss):
        try:
            nlow = hit + miss
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            nlow = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            nlow = np.NaN
        return nlow

    # function for calculating number above threshold
    def calculate_nhigh(self, fa, cn):
        try:
            nhigh = cn + fa
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            nhigh = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            nhigh = np.NaN
        return nhigh

    # function for calculating total number
    def calculate_ntot(self, hit, fa, miss, cn):
        try:
            ntot = hit + fa + miss + cn
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ntot = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ntot = np.NaN
        return ntot

    # function for calculating total number
    def calculate_n(self, n):
        try:
            n = n + 0
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            n = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            n = np.NaN
        return n

    # function for calculating ratio of nlow to ntot
    def calculate_ratlow(self, hit, fa, miss, cn):
        try:
            ratlow = self.calculate_nlow(hit, miss) / self.calculate_ntot(hit, fa, miss, cn)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            ratlow = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            ratlow = np.NaN
        return ratlow

    # function for calculating ratio of nhigh to ntot
    def calculate_rathigh(self, hit, fa, miss, cn):
        try:
            rathigh = self.calculate_nhigh(fa, cn) / self.calculate_ntot(hit, fa, miss, cn)
        except TypeError as e:
            self.error = "Error calculating statistic: " + str(e)
            rathigh = np.NaN
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            rathigh = np.NaN
        return rathigh

    # function for determining and calling the appropriate contigency table count statistical calculation function
    def calculate_ctc_stat(self, statistic, hit, fa, miss, cn, n):
        stat_switch = {  # dispatcher of statistical calculation functions
            'TSS (True Skill Score)': self.calculate_tss,
            'PODy (POD of value < threshold)': self.calculate_pody,
            'PODy (POD of value > threshold)': self.calculate_pody,
            'PODn (POD of value > threshold)': self.calculate_podn,
            'PODn (POD of value < threshold)': self.calculate_podn,
            'FAR (False Alarm Ratio)': self.calculate_far,
            'Bias (forecast/actual)': self.calculate_bias,
            'CSI (Critical Success Index)': self.calculate_csi,
            'HSS (Heidke Skill Score)': self.calculate_hss,
            'ETS (Equitable Threat Score)': self.calculate_ets,
            'Nlow (Number of obs < threshold (hits + misses))': self.calculate_nlow,
            'Nhigh (Number of obs > threshold (hits + misses))': self.calculate_nlow,
            'Nlow (Number of obs < threshold (false alarms + correct nulls))': self.calculate_nhigh,
            'Nhigh (Number of obs > threshold (false alarms + correct nulls))': self.calculate_nhigh,
            'Ntot (Total number of obs, (Nlow + Nhigh))': self.calculate_ntot,
            'Ratio Nlow / Ntot ((hit + miss)/(hit + miss + fa + cn))': self.calculate_ratlow,
            'Ratio Nhigh / Ntot ((hit + miss)/(hit + miss + fa + cn))': self.calculate_ratlow,
            'Ratio Nlow / Ntot ((fa + cn)/(hit + miss + fa + cn))': self.calculate_rathigh,
            'Ratio Nhigh / Ntot ((fa + cn)/(hit + miss + fa + cn))': self.calculate_rathigh,
            'N times*levels(*stations if station plot) per graph point': self.calculate_n,
            'All observed yes': self.calculate_nlow,
            'All observed no': self.calculate_nhigh
        }
        args_switch = {  # dispatcher of arguments for statistical calculation functions
            'TSS (True Skill Score)': (hit, fa, miss, cn),
            'PODy (POD of value < threshold)': (hit, miss),
            'PODy (POD of value > threshold)': (hit, miss),
            'PODn (POD of value > threshold)': (fa, cn),
            'PODn (POD of value < threshold)': (fa, cn),
            'FAR (False Alarm Ratio)': (hit, fa),
            'Bias (forecast/actual)': (hit, fa, miss),
            'CSI (Critical Success Index)': (hit, fa, miss),
            'HSS (Heidke Skill Score)': (hit, fa, miss, cn),
            'ETS (Equitable Threat Score)': (hit, fa, miss, cn),
            'Nlow (Number of obs < threshold (hits + misses))': (hit, miss),
            'Nhigh (Number of obs > threshold (hits + misses))': (hit, miss),
            'Nlow (Number of obs < threshold (false alarms + correct nulls))': (fa, cn),
            'Nhigh (Number of obs > threshold (false alarms + correct nulls))': (fa, cn),
            'Ntot (Total number of obs, (Nlow + Nhigh))': (hit, fa, miss, cn),
            'Ratio Nlow / Ntot ((hit + miss)/(hit + miss + fa + cn))': (hit, fa, miss, cn),
            'Ratio Nhigh / Ntot ((hit + miss)/(hit + miss + fa + cn))': (hit, fa, miss, cn),
            'Ratio Nlow / Ntot ((fa + cn)/(hit + miss + fa + cn))': (hit, fa, miss, cn),
            'Ratio Nhigh / Ntot ((fa + cn)/(hit + miss + fa + cn))': (hit, fa, miss, cn),
            'N times*levels(*stations if station plot) per graph point': (n,),
            'All observed yes': (hit, miss),
            'All observed no': (fa, cn)
        }
        try:
            stat_args = args_switch[statistic]  # get args
            stat = stat_switch[statistic](*stat_args)  # call stat function
        except KeyError as e:
            self.error = "Error choosing statistic: " + str(e)
            stat = 'null'
        except ValueError as e:
            self.error = "Error calculating statistic: " + str(e)
            stat = 'null'
        return stat

    def test_null_hypothesis(self, statistic, minuend_data, subtrahend_data):
        # pre-calculate random indices
        max_tries = 1000
        max_length = len(minuend_data["hit"]) if len(minuend_data["hit"]) > len(subtrahend_data["hit"]) else len(subtrahend_data["hit"])
        length_indices = range(max_length)
        rand_indices = np.random.randint(2, size=(max_tries, max_length))
        other_indices = 1-rand_indices

        # make sure input data arrays are the same length
        if len(minuend_data["hit"]) < max_length:
            length_needed = max_length - len(minuend_data["hit"])
            for k in range(0, length_needed):
                minuend_data["hit"].append(0)
                minuend_data["fa"].append(0)
                minuend_data["miss"].append(0)
                minuend_data["cn"].append(0)

        if len(subtrahend_data["hit"]) < max_length:
            length_needed = max_length - len(subtrahend_data["hit"])
            for k in range(0, length_needed):
                subtrahend_data["hit"].append(0)
                subtrahend_data["fa"].append(0)
                subtrahend_data["miss"].append(0)
                subtrahend_data["cn"].append(0)

        # store input data in easy-access numpy arrays to eliminate the need to loop over length
        all_hits = np.transpose(np.asarray([minuend_data["hit"], subtrahend_data["hit"]]))
        all_fas = np.transpose(np.asarray([minuend_data["fa"], subtrahend_data["fa"]]))
        all_misses = np.transpose(np.asarray([minuend_data["miss"], subtrahend_data["miss"]]))
        all_cns = np.transpose(np.asarray([minuend_data["cn"], subtrahend_data["cn"]]))
        all_diffs = []

        for j in range(0, max_tries):
            perm_m_hit = all_hits[length_indices, rand_indices[j, :]]
            perm_m_fa = all_fas[length_indices, rand_indices[j, :]]
            perm_m_miss = all_misses[length_indices, rand_indices[j, :]]
            perm_m_cn = all_cns[length_indices, rand_indices[j, :]]
            perm_s_hit = all_hits[length_indices, other_indices[j, :]]
            perm_s_fa = all_fas[length_indices, other_indices[j, :]]
            perm_s_miss = all_misses[length_indices, other_indices[j, :]]
            perm_s_cn = all_cns[length_indices, other_indices[j, :]]

            perm_m_stat = self.calculate_ctc_stat(statistic, int(np.sum(perm_m_hit)), int(np.sum(perm_m_fa)), int(np.sum(perm_m_miss)), int(np.sum(perm_m_cn)), len(perm_m_hit))
            perm_s_stat = self.calculate_ctc_stat(statistic, int(np.sum(perm_s_hit)), int(np.sum(perm_s_fa)), int(np.sum(perm_s_miss)), int(np.sum(perm_s_cn)), len(perm_s_hit))
            perm_diff = perm_m_stat - perm_s_stat
            all_diffs.append(perm_diff)

        all_diffs.sort()
        i_min = int(max_tries * 0.025)
        i_max = int(max_tries * 0.975)
        bot_95 = all_diffs[i_min]
        top_95 = all_diffs[i_max]
        ci_length = (top_95-bot_95)/2  # length of 95th percentile confidence interval. Divide by 1.96 for standard error.
        return ci_length

    # makes sure all expected options were indeed passed in
    def validate_options(self, options):
        assert True, options.statistic is not None and options.minuend_data is not None and options.subtrahend_data is not None

    # process 'c' style options - using getopt - usage describes options
    def get_options(self, args):
        usage = ["(S)tatistic=", "(m)inuend_data", "(s)ubtrahend_data"]
        statistic = None
        minuend_data = None
        subtrahend_data = None

        try:
            opts, args = getopt.getopt(args[1:], "S:m:s:", usage)
        except getopt.GetoptError as err:
            # print help information and exit:
            print(str(err))  # will print something like "option -a not recognized"
            print(usage)  # print usage from last param to getopt
            sys.exit(2)
        for o, a in opts:
            if o == "-?":
                print(usage)
                sys.exit(2)
            if o == "-S":
                statistic = a
            elif o == "-m":
                minuend_data = json.loads(a)
            elif o == "-s":
                subtrahend_data = json.loads(a)
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, statistic is not None and minuend_data is not None and subtrahend_data is not None
        options = {
            "statistic": statistic,
            "minuend_data": minuend_data,
            "subtrahend_data": subtrahend_data
        }
        return options

    def calc_error_stats(self, options):
        self.validate_options(options)
        self.error_length = self.test_null_hypothesis(options["statistic"], options["minuend_data"], options["subtrahend_data"])


if __name__ == '__main__':
    ctc_util = CTCErrorUtil()
    options = ctc_util.get_options(sys.argv)
    ctc_util.calc_error_stats(options)
    ctc_util.construct_output_json()
    print(ctc_util.output_JSON)
