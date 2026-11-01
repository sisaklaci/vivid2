// transzform.v - Vivid 2.0 minta: transzformaciok, include, vagas (clip),
// matematikai kifejezesek, kod (haze)

#include color.vc
#define TEGLA  surface { diffuse 0.7 0.3 0.2  shine 15 0.3 0.3 0.3 }

studio {
    from 9 -12 7
    at 0 0 1.5
    up 0 0 1
    angle 34
    resolution 320 200
    aspect 1.6
    ambient 0.12 0.12 0.12
    background 0.75 0.8 0.9
    haze 0.02
    antialias adaptive
    depth 6
}

light { type directional  direction -1 0.6 -1.5  color 0.9 0.9 0.85 }
light { type point  position -6 -8 9  color 0.35 0.35 0.4 }

surface { diffuse 0.55 0.6 0.5 }
ring { center 0 0 0  normal 0 0 1  radius 60 }

// kockatorony: minden szint kisebb es elforgatott
TEGLA
transform { translate -0.5 -0.5 0  scale 2 2 1 }
#include kocka.vo
transform_pop

transform { translate -0.5 -0.5 0  scale 1.5 1.5 1  rotate 0 0 30  translate 0 0 1 }
#include kocka.vo
transform_pop

transform { translate -0.5 -0.5 0  scale 1 1 1  rotate 0 0 60  translate 0 0 2 }
#include kocka.vo
transform_pop

// ellipszoid: nem egyenletes skalazas egy gombon
surface { diffuse 0.15 0.35 0.8  specular 0.3 0.3 0.3  shine 80 1 1 1 }
transform { scale 1 1 0.45  translate 0 0 3.45 }
sphere { center 0 0 0  radius 0.9 }
transform_pop

// felbevagott gomb: a sik normalisa felee eso resz marad meg
surface { diffuse 0.9 0.75 0.2  shine 40 1 1 1 }
sphere {
    center 3.5 1 1.2
    radius 1.2
    clip { center 3.5 1 1.2  normal (sin(0.6)) 0 (cos(0.6)) }
}

// henger (cone egyetlen radius-szal) gyuru-tetovel
surface { diffuse 0.85 0.85 0.85  shine 20 }
cone { base -3.5 1 0  apex -3.5 1 (1.5 * 2)  radius 0.6 }
ring { center -3.5 1 3  normal 0 0 1  radius 0.6 }
