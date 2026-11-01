// uveg.v - Vivid 2.0 minta: uveggomb, kup, gyuru, teruleti fenyforras (lagy arnyek)

studio {
    from 6 -9 5
    at 0 0 1
    up 0 0 1
    angle 30
    resolution 320 200
    aspect 1.6
    ambient 0.1 0.1 0.1
    background 0 0 0
    antialias adaptive
    threshold 12
    depth 10
}

// gomb alaku fenyforras -> lagy arnyekok
light {
    type spherical
    position 5 -5 12
    radius 1.5
    samples 8
    color 1 1 0.9
}

// padlo
surface {
    diffuse 0.5 0.45 0.4
    specular 0.2 0.2 0.2
    shine 30 1 1 1
}
polygon {
    points 4
    vertex -30 -30 0
    vertex  30 -30 0
    vertex  30  30 0
    vertex -30  30 0
}

// uveg gomb
surface {
    diffuse 0 0 0
    ambient 0 0 0
    specular 0.2 0.2 0.2
    shine 150 1 1 1
    transparent 0.9 0.9 0.95
    ior 1.3
}
sphere { center 0 0 1.5  radius 1.5 }

// arany kup
surface {
    diffuse 0.6 0.45 0.1
    specular 0.5 0.4 0.1
    shine 80 1 0.9 0.5
}
cone {
    base   -3 2 0
    base_radius 1
    apex   -3 2 3
    apex_radius 0
}

// kek gyuru a padlo felett
surface {
    diffuse 0.1 0.2 0.8
    shine 40 1 1 1
}
ring {
    center 3 2 0.01
    normal 0 0 1
    min_radius 0.6
    max_radius 1.2
}
