import getopt
import sys
import numpy as np
import json
from mode_stats import calculate_mode_stat


# class that calculates error bar length for CTC plots
class RecalcModeUtil:
    error = ""  # one of the two fields to return at the end -- records any error message
    stat = 'null'  # one of the two fields to return at the end -- the length of the error bars
    output_JSON = {}  # JSON structure to pass the two output fields back to the MATS JS

    # function for constructing and jsonifying a dictionary of the output variables
    def construct_output_json(self):
        self.output_JSON = {
            "stat": self.stat,
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

    # makes sure all expected options were indeed passed in
    def validate_options(self, options):
        assert True, options.statistic is not None and options.sub_interest is not None \
                     and options.sub_pair_fid is not None and options.sub_pair_oid is not None \
                     and options.sub_mode_header_id is not None and options.sub_f_area is not None \
                     and options.sub_o_area is not None

    # process 'c' style options - using getopt - usage describes options
    def get_options(self, args):
        usage = ["(S)tatistic=", "sub_(i)nterest", "sub_pair_(f)id", "sub_pair_(o)id=",
                 "sub_(m)ode_header_id", "(a) sub_f_area", "(b) sub_o_area"]
        statistic = None
        sub_interest = None
        sub_pair_fid = None
        sub_pair_oid = None
        sub_mode_header_id = None
        sub_f_area = None
        sub_o_area = None

        try:
            opts, args = getopt.getopt(args[1:], "S:i:f:o:m:a:b:", usage)
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
            elif o == "-i":
                sub_interest = json.loads(a)
            elif o == "-f":
                sub_pair_fid = json.loads(a)
            elif o == "-o":
                sub_pair_oid = json.loads(a)
            elif o == "-m":
                sub_mode_header_id = json.loads(a)
            elif o == "-a":
                sub_f_area = json.loads(a)
            elif o == "-b":
                sub_o_area = json.loads(a)
            else:
                assert False, "unhandled option"
        # make sure none were left out...
        assert True, statistic is not None and sub_interest is not None and sub_pair_fid is not None \
                     and sub_pair_oid is not None and sub_mode_header_id is not None and sub_f_area is not None\
                     and sub_o_area is not None
        options = {
            "statistic": statistic,
            "sub_interest": sub_interest,
            "sub_pair_fid": sub_pair_fid,
            "sub_pair_oid": sub_pair_oid,
            "sub_mode_header_id": sub_mode_header_id,
            "sub_f_area": sub_f_area,
            "sub_o_area": sub_o_area
        }
        return options

    def calc_mode_stats(self, options):
        self.validate_options(options)
        options["sub_mode_header_id"] = [str(i) for i in options["sub_mode_header_id"]]
        self.stat, self.error = calculate_mode_stat(options["statistic"], np.asarray(options["sub_interest"]),
                                                    np.asarray(options["sub_pair_fid"]), np.asarray(options["sub_pair_oid"]),
                                                    np.asarray(options["sub_mode_header_id"]), np.asarray(options["sub_f_area"]),
                                                    np.asarray(options["sub_o_area"]),)


if __name__ == '__main__':
    mode_util = RecalcModeUtil()
    options = mode_util.get_options(sys.argv)
    mode_util.calc_mode_stats(options)
    mode_util.construct_output_json()
    print(mode_util.output_JSON)
