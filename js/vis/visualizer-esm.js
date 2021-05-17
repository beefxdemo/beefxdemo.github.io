/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, space-unary-ops,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, no-unused-vars, object-curly-newline */

import {Corelib, DOMplusUltra} from '../improxy-esm.js'

//: This module draws the spectrums ONLY at the end of each stage on global flag showEndSpectrums.
//: The Hi-Res spectrums are handled differently.
//: These two must be DRIed into one place probably (although parameters differ).
//: So we will eliminate both and merge them into a ~spectrum-vis.js later. FUTREQ
//: Levelmeter is also implemented here, although not used now -> later.
//: Also levelMeter is the culprit who uses one call from DOMplusUltra.

const {Ø, undef} = Corelib
const {wassert, weject} = Corelib.Debug
const {set$} = DOMplusUltra
const {max} = Math
const {requestAnimationFrame} = window

const visualizerState = {
  hasStarted: false,
  redreshOn: false,
  isActive: true,       //:debuglike big OFF switch
  isSpectrumOn: true,   //:can be turned off
  isLevelMeterOn: false, //:always on
  visHash: {},
  pending: [],
  frameDelay: 0,
  cnt: 0
}

const initVisualizerState = _ => {
  if (!visualizerState.hasStarted) {
    visualizerState.hasStarted = true
    visualizerTick()  
  }
}

const addVisualizer = vis => {
  weject(typeof vis.ix === Ø)
  visualizerState.visHash[vis.ix] = vis
}

//: We draw every spectrum in one RAF. (And omit every second redraw if redresh is on.)
//: This can be bad. But we have a max of 12 spectrums (in extreme case). And they are fast.

const visualizerTick = async _ => {
  if (visualizerState.isActive) {
    if (!visualizerState.redreshOn || visualizerState.cnt++ % 2 === 1) {
      for (const visix in visualizerState.visHash) {
        const vis = visualizerState.visHash[visix]
        wassert(vis)
        vis.drawSpectrum()
      }
    }
  }
  visualizerState.frameDelay
    ? setTimeout(_ => requestAnimationFrame(visualizerTick), visualizerState.frameDelay)
    : requestAnimationFrame(visualizerTick)
}

export const createSpectrumVisualizer = (analyserNode, canvas$, levelMeter$, ix, mayday) => {
  wassert(canvas$)
  
  initVisualizerState()

  const WIDTH = 128
  const HEIGHT = 128 // was 256x 256
  const SMOOTHING = 0
  const FFT_SIZE = 128 // 64 // 128 // 2048
  
  const vis = {
    isActive: true,
    analyser: analyserNode,
    prevFreqs: [],
    freqs: undef,
    visualizerState,
    ix
  }

  const autoExec = _ => {
    vis.analyser = analyserNode
    vis.analyser.minDecibels = -140
    vis.analyser.maxDecibels = 0
    vis.analyser.smoothingTimeConstant = SMOOTHING
    vis.analyser.fftSize = FFT_SIZE
    vis.len = vis.analyser.frequencyBinCount
    vis.freqs = new Uint8Array(vis.len)

    addVisualizer(vis)
  }
  
  vis.setActive = val => vis.isActive = val
  
  //: This is a method of an INSTANCE, but will set a CLASS behaviour!
  //: (Didn't want to export another function.)
  //: If this is called multiple times - whatever, it's cheap.
  
  vis.reduceRefresh = on => visualizerState.redreshOn = on

  vis.drawSpectrum = async _ => {
    if (!vis.isActive) {
      return
    }
    vis.analyser.getByteFrequencyData(vis.freqs)
    if (mayday) {
      const MAYDAY_LIMIT = 180
      let ok = false
      for (let i = 0; i < vis.len; i++) {
        if (vis.freqs[i] < MAYDAY_LIMIT) {
          ok = true
          break
        }
      }
      if (!ok) {
        console.groupEnd()
        console.error('mayday', vis)
        mayday({freqs: vis.freqs, MAYDAY_LIMIT})
      }
    }

    const drawContext = canvas$.getContext('2d')
    canvas$.width = WIDTH
    canvas$.height = HEIGHT
    const barWidth = WIDTH / vis.len
    
    let peak = 0
    let avg = 0
    
    for (let i = 0; i < vis.len; i++) {//:Draw the frequency domain chart.
      const newValue = vis.freqs[i]
      const oldValue = vis.prevFreqs[i] || 0
      const value = max(newValue, (newValue + oldValue * 2) / 3)
      vis.prevFreqs[i] = value
      peak = max(peak, value)
      avg += value
      if (visualizerState.isSpectrumOn) {
        const percent = value / 256
        const height = HEIGHT * percent
        const offset = HEIGHT - height - 1
        const procPerc = i / vis.len * 100
        const sat = procPerc * .6 + 40
        const lit = procPerc * .6 + 40
        drawContext.fillStyle = `hsl(0, ${sat}%, ${lit}%)`      
        drawContext.fillRect(i * barWidth, offset, barWidth - 1, height)
      }
    }
    if (visualizerState.isLevelMeterOn) {
      avg /= vis.len
      avg /= 2.56
      peak /= 2.56
      set$(levelMeter$, {css: {
        '--peak': peak + '%',
        '--avg': avg + '%'
      }})
    }
  }
  
  autoExec()
  
  return vis
}
