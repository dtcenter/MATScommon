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

To use CMake to build you can do:

```console
cmake -S . -B cmake-build-debug
```

The `compilation_commands.json` database and the `contingency-errors` binary will be generated in the `cmake-build-debug` output directory.

## Code Formatting

The code has been formatted with the `clang-format` tool. You can call clang-format like so:

```console
clang-format --style=Google -i perm_file.c permutation_stats.c permutations.h
```
