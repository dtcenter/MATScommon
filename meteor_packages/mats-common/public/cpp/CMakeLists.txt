cmake_minimum_required(VERSION 3.16)
project(contingency-errors C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include_directories(.)

add_executable(contingency-errors
        perm_file.c
        permutation_stats.c
        permutations.h)
