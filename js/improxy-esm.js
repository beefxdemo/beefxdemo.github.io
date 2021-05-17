/* eslint-disable spaced-comment, object-curly-spacing */

import * as Corelib from './red/esm/stdlib/corelib-esm.js'
import * as Store from './red/esm/stdlib/store-esm.js'
import * as DOMplusUltra from './red/esm/dom/dom-plus-ultra-esm.js'
import { DragWithDOM } from './red/esm/dom/dragwdom-esm.js'
import { Redact } from './red/esm/dom/redact-esm.js'

import { BeeFX, BPM, onWaapiReady, CT } from './beefx/beeproxy-esm.js'

import { createGraphBase } from './vis/graphbase-esm.js'
import * as Visualizer from './vis/visualizer-esm.js'

import * as Midi from './red/esm/webapis/midi-interface-esm.js'
import * as TestMidi from './ui/ui-midi-esm.js'

import * as Sources from './pg-sources-esm.js'
import * as StateManager from './pg-states-esm.js'
import * as StageManager from './pg-stages-esm.js'

import * as FxUiPars from './ui/ui-fxpars-esm.js'
import * as FxUi from './ui/ui-fxpanel-esm.js'
import * as StagesUi from './ui/ui-stages-esm.js'
import * as Observer from './ui/ui-observer-esm.js'
import * as PlayersUi from './ui/ui-players-esm.js'
import * as SourcesUi from './ui/ui-sources-esm.js'
import * as StatesUi from './ui/ui-states-esm.js'

import { createUI } from './ui/ui-esm.js'

import * as Playground from './playground-esm.js'
import '../contest/ct-esm.js'

export {
  Corelib, Store, DOMplusUltra, Redact, DragWithDOM, Midi, TestMidi,
  onWaapiReady, BeeFX, BPM, Visualizer, createGraphBase,
  Sources, StateManager, StageManager, Playground,
  StagesUi, FxUiPars, FxUi, Observer, PlayersUi, SourcesUi, StatesUi, createUI, CT
}
