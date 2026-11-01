// textura.v - Vivid 2.0 minta: szilard texturak es bump mapping
//   - sakktabla padlo (texture / pattern checker)
//   - marvanyszeru gomb (pattern noise)
//   - hullamos tukor felulet (bump / wave)
//   - "kalapalt" fem gomb (bump / turbulence)

#include color.vc

studio {
    from 0 -11 4.5
    at 0 0 1.2
    up 0 0 1
    angle 38
    resolution 320 200
    aspect 1.6
    ambient 0.15 0.15 0.15
    background 0.35 0.45 0.7
    antialias adaptive
    threshold 12
    depth 6
}

light { type point  position 8 -10 14  color 1 1 1 }
light { type point  position -10 -4 6  color 0.35 0.35 0.4  no_spec }

// sakktabla padlo
surface {
    texture {
        pattern checker
        scale 1.5
        blend 0.03
        surface { diffuse 0.85 0.85 0.8  specular 0.15 0.15 0.15  shine 40 }
        surface { diffuse 0.1 0.1 0.12   specular 0.15 0.15 0.15  shine 40 }
    }
}
ring { center 0 0 0  normal 0 0 1  radius 40 }

// marvany gomb
surface {
    texture {
        pattern noise
        scale 0.6
        terms 5
        blend 0.4
        surface { diffuse 0.9 0.88 0.85  shine 60 1 1 1 }
        surface { diffuse 0.25 0.3 0.45  shine 60 1 1 1 }
    }
}
sphere { center -2.6 0.5 1.3  radius 1.3 }

// hullamos tukor
surface {
    diffuse 0.05 0.05 0.1
    specular 0.8 0.8 0.9
    shine 120 1 1 1
    bump {
        wave { center 0 1 1.3  wavelength 0.5  amplitude 0.15  damping 0.3 }
    }
}
sphere { center 0 1.5 1.3  radius 1.3 }

// kalapalt rez
surface {
    diffuse 0.45 0.25 0.1
    specular 0.45 0.3 0.15
    shine 30 1 0.8 0.5
    bump {
        turbulence { scale 0.15  amp 0.35  terms 3 }
    }
}
sphere { center 2.6 0.5 1.3  radius 1.3 }
