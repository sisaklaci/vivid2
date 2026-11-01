// alap.v - Vivid 2.0 minta: harom gomb a padlon
// Koordinatarendszer: jobbkezes, Z felfele

studio {
    from 0 -12 4
    at 0 0 1
    up 0 0 1
    angle 35
    resolution 320 200
    aspect 1.6
    projection flat
    ambient 0.15 0.15 0.15
    background 0.1 0.1 0.3
    antialias adaptive
    threshold 16
    depth 6
}

light {
    type point
    position 10 -10 15
    color 1 1 1
}

light {
    type point
    position -8 -6 8
    color 0.4 0.4 0.5
}

// padlo
surface {
    diffuse 0.6 0.6 0.6
    ambient 0.1 0.1 0.1
}
polygon {
    points 4
    vertex -20 -20 0
    vertex  20 -20 0
    vertex  20  20 0
    vertex -20  20 0
}

// piros matt gomb
surface {
    diffuse 0.8 0.1 0.1
    ambient 0.1 0.0 0.0
    shine 20 0.5 0.5 0.5
}
sphere { center -3 0 1  radius 1 }

// zold fenyes gomb
surface {
    diffuse 0.1 0.6 0.1
    ambient 0.0 0.1 0.0
    specular 0.3 0.3 0.3
    shine 60 1 1 1
}
sphere { center 0 2 1.5  radius 1.5 }

// tukor gomb
surface {
    diffuse 0.05 0.05 0.05
    specular 0.9 0.9 0.9
    shine 200 1 1 1
}
sphere { center 3 0 1  radius 1 }
