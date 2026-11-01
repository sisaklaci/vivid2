// oszlopsor.v - Vivid 2.0 minta: makrok, oszlopsor csonka kupokbol, reflektor

#define PADLO  diffuse 0.7 0.7 0.65
#define KO     diffuse 0.75 0.72 0.65  shine 10 0.3 0.3 0.3
#define RAD    0.4

studio {
    from 0 -14 3
    at 0 6 2
    up 0 0 1
    angle 40
    resolution 320 200
    aspect 1.6
    ambient 0.12 0.12 0.15
    background 0.5 0.6 0.9
    antialias adaptive
    threshold 16
    depth 5
}

light {
    type directional
    direction -1 1 -2
    color 0.9 0.85 0.7
}

light {
    type spot
    position 0 -6 8
    at 0 6 0
    min_angle 15
    max_angle 25
    color 0.6 0.6 0.6
}

surface { PADLO }
polygon {
    points 4
    vertex -10 -10 0
    vertex  10 -10 0
    vertex  10  20 0
    vertex -10  20 0
}

surface { KO }

// bal oszlopsor
cone { base -3 0  0  base_radius RAD  apex -3 0  4  apex_radius 0.35 }
cone { base -3 4  0  base_radius RAD  apex -3 4  4  apex_radius 0.35 }
cone { base -3 8  0  base_radius RAD  apex -3 8  4  apex_radius 0.35 }
cone { base -3 12 0  base_radius RAD  apex -3 12 4  apex_radius 0.35 }

// jobb oszlopsor
cone { base  3 0  0  base_radius RAD  apex  3 0  4  apex_radius 0.35 }
cone { base  3 4  0  base_radius RAD  apex  3 4  4  apex_radius 0.35 }
cone { base  3 8  0  base_radius RAD  apex  3 8  4  apex_radius 0.35 }
cone { base  3 12 0  base_radius RAD  apex  3 12 4  apex_radius 0.35 }

// architrav (fedolap) - also es felso lap
polygon {
    points 4
    vertex -3.6 -0.6 4
    vertex  3.6 -0.6 4
    vertex  3.6 12.6 4
    vertex -3.6 12.6 4
}
polygon {
    points 4
    vertex -3.6 -0.6 4.5
    vertex  3.6 -0.6 4.5
    vertex  3.6 12.6 4.5
    vertex -3.6 12.6 4.5
}
// elulso homlokzat
polygon {
    points 4
    vertex -3.6 -0.6 4
    vertex  3.6 -0.6 4
    vertex  3.6 -0.6 4.5
    vertex -3.6 -0.6 4.5
}

// gomb a vegen
surface {
    diffuse 0.7 0.1 0.1
    specular 0.5 0.5 0.5
    shine 80 1 1 1
}
sphere { center 0 12 1  radius 1 }
