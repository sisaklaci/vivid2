studio {
    from 0 -6.2 3.2  at 0 0 0.9  up 0 0 1  angle 36
    resolution 384 384  aspect 1
    ambient 0.18 0.18 0.2  background 0.09 0.1 0.13
    antialias adaptive  threshold 6  depth 6
}
light { type point position 6 -7 10 color 1 0.98 0.92 }
light { type point position -6 -2 4 color 0.25 0.3 0.45 no_spec }
surface {
    texture { pattern checker scale 1.2
        surface { diffuse 0.92 0.9 0.86 specular 0.12 0.12 0.12 }
        surface { diffuse 0.16 0.17 0.2 specular 0.12 0.12 0.12 } }
}
ring { center 0 0 0 normal 0 0 1 radius 30 }
surface { diffuse 0.95 0.55 0.08 specular 0.25 0.2 0.15 shine 60 1 1 1 }
sphere { center 0 0 1.25 radius 1.25 }
