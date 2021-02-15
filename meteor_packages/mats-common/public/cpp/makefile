CC = gcc -ansi -c
CL = gcc -ansi


INCS = -I./
# LIBS = -L$(NETCDF_BASE)/lib -lnetcdf 

OBJS = perm.o

#define the rule for compiling .c files
.c.o:
	${CC} $*.c $(INCS)

perm_file.x:    perm_file.o permutation_stats.o
	$(CL) perm_file.o permutation_stats.o -lm -o perm_file.x $(INCS)

perm_memory.x: perm_memory.o permutation_stats.o
	$(CL) perm_memory.o permutation_stats.o -lm -o perm_memory.x $(INCS)

