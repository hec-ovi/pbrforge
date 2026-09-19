# fixings

Four circular painted fixing heads per rectangular panel. `worldSize / cells` sets the panel module. `line` is head diameter; `bevel` is the centre inset from both adjoining edges, in metres. `depth` controls head and socket relief. Two colors: panel finish and fixing head. `grain` varies the panel tone.

Heads must have positive diameter, clear the panel edges and fit between opposite corners; invalid geometry returns `E_SCHEMA`.
