# Kinetic synthetic scenarios

These files are small, checked-in projects for the bounded `traffic-ring-v1` educational model. They are not calibrated traffic forecasts. Load either JSON file from the editor, change any assumption, and the scenario fingerprint will change with the normalized model inputs.

| Project | Density | Reaction | Braking | Seed | Expected fingerprint |
| --- | ---: | ---: | ---: | ---: | --- |
| `sparse-ring.json` | 0.34 | 0.70 s | 4.2 m/s² | 11 | `9c47fc48` |
| `dense-ring.json` | 0.78 | 1.70 s | 2.4 m/s² | 77 | `217e2608` |

The automated test suite parses both through the same project-format validator used by the browser and rebuilds each timeline twice to verify deterministic reproduction.
