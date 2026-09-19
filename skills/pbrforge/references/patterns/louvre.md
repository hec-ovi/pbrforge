# louvre

Tilted blades with folded lips and optional opaque recessed punches. `axis: y` gives horizontal blades; `axis: x` gives vertical comb fins. `worldSize / cells` sets the pitch. `line` is the gap width, `bevel` the folded lip width, both in metres. `depth` is the blade projection divided by pitch. Normal directions come from the metric profile with OpenGL +Y.

Two colors: brushed face and dark recess. `grain` varies brushing; `sheen` varies roughness. Optional `opening: [width, height]` cuts one recessed punch per cell at 68 percent of blade pitch. Openings retain opaque backing. Each opening must fit its cell; invalid geometry returns `E_SCHEMA`.
