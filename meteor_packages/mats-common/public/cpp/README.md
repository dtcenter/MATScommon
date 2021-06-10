# Contingency Table Calculations

This code computes errors for contingency tables.

It takes in results from a SQL query (written to a file) and gives you back errors (written to a file)

## Compiling

This project includes a Makefile and a CMake setup. Both work fine. However, CMake will let you generate a compiliation database for better IDE support. 

### Make

To use the Makefile you can do:

```console
make contingency-errors
```

### CMake

To use CMake to generate a build environment you can do:

```console
$ cmake -S . -B cmake-build-debug
```

And then build with:

```console
$ cd cmake-build-debug && make
```

The `compilation_commands.json` database and the `contingency-errors` binary will be generated in the `cmake-build-debug` output directory.

This could be improved.

## Code Formatting

The code has been formatted with the `clang-format` tool. You can call clang-format like so:

```console
$ clang-format --style=Google -i perm_file.c permutation_stats.c permutations.h
```

## Testing

TODO

## Running the program

You will need to define the `STAT_FILE` env variable with the path to the stat file you want to run on.

The stat file should contain the calculation to perform on the first line, something on the second line and then space separated values. The program skips lines starting with `;` characters and will attempt to output results to `./errors.txt`. This appears to be broken at the moment and results actually appear on stdout. (which works for our case)

I've included a `sample-resources` directory with two sample data files and the corresponding output you can use to get started. A sample SQL query is also included.

```console
.../MATScommon/meteor_packages/mats-common/public/cpp$ env STAT_FILE=$(pwd)/sample-resources/data-bias.tmp ./cmake-build-debug/contingency-errors > my-results.txt
```
