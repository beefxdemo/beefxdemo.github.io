/* eslint-disable spaced-comment, object-curly-spacing */

import * as Corelib from './red/esm/stdlib/corelib-esm.js'
import { CT } from './red/esm/stdlib/contest-esm.js'

import { onReady as onWaapiReady } from './wautils-esm.js'
import { createBeeDebug } from './beefx-debug-esm.js'
import * as beeCommon from './beefx-common-esm.js'
import { BeeFX } from './beefx-esm.js'

import './fxs/beefxs-basic-esm.js'
import './fxs/beefxs-ratio-esm.js'
import './fxs/beefxs-amp-esm.js'
import './fxs/beefxs-equalizer-esm.js'
import './fxs/beefxs-delays-esm.js'
import './fxs/beefxs-noise-esm.js'
import './fxs/beefxs-reverb-esm.js'
import './fxs/beefxs-dattorro-reverb-esm.js'
import './fxs/beefxs-compressor-esm.js'
import './fxs/beefxs-wobble-esm.js'
import './fxs/beefxs-scrlfo-esm.js'
import './fxs/beefxs-chorus-esm.js'
import './fxs/beefxs-pitchshifter-esm.js'
import './fxs/beefxs-osc-esm.js'
import './fxs/beefxs-env-esm.js'
import './fxs/beefxs-overdrive-esm.js'
import * as Chebyshev from './fxs/chebyshev-math-esm.js'
import './fxs/beefxs-iir-esm.js'
import './fxs/beefxs-ringmod-esm.js'

import { detectBPMj } from './med/bpmj-esm.js'
import * as BPM from './med/bpm-auditor-esm.js'

import './ext/beext-oscillator-esm.js'
import './ext/beext-oscilloscope-esm.js'
import './ext/beext-spectrum-esm.js'
import './ext/beext-recmulti-esm.js'
import './med/beefxs-bpmtrans-esm.js'

export {
  Corelib, onWaapiReady,
  createBeeDebug, beeCommon, BeeFX,
  Chebyshev, detectBPMj, BPM, CT
}
