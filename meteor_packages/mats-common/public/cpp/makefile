CC = gcc -ansi -c
# Equivalent to:
# CC = gcc -std=c90 -pedantic -c
CL = gcc -ansi


INCS = -I./
# LIBS = -L$(NETCDF_BASE)/lib -lnetcdf 

OBJS = perm.o

#define the rule for compiling .c files
.c.o:
	${CC} $*.c $(INCS)

contingency-errors:    perm_file.o permutation_stats.o
	$(CL) perm_file.o permutation_stats.o -lm -o contingency-errors $(INCS)
