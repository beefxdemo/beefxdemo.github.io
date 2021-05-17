/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib
const {PI} = Math
const PI2 = 2 * PI

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const LFOFx = { //8#04c ------- ScriptProcessor LFO (source: Oskar Eriksson / Tuna) -------
    def: {
      frequency: {defVal: 1, min: 0.1, max: 20, subType: 'exp'},
      offset: {defVal: .85, min: 0.1, max: 22049, subType: 'exp'},
      oscillation: {defVal: .3, min: -22050, max: 22050},
      phase: {defVal: 0, min: 0, max: PI2},
      masterFx: {defVal: {}},
      target: {defVal: {}, skipUi: true},
      callback: {defVal: nop, skipUi: true}
    },
    uiSelectDisabled: true
  }
  
  LFOFx.setValue = (fx, key, value, {int} = fx) => ({
    frequency: _ => int._phaseInc = PI2 * value * int.bufferSize / int.sampleRate,
    offset: nop,
    oscillation: nop,
    phase: nop,
    masterFx: nop,
    target: nop,
    callback: _ => int.lfo.onaudioprocess = fx.getCallbackPass(value)
  }[key])
  
  LFOFx.construct = (fx, {initial}, {atm, int} = fx) => {
    int.bufferSize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
    int.sampleRate = 44100
    int.lfo = waCtx.createScriptProcessor(256, 1, 1)
    
    fx.getCallbackPass = callback => _ => {
      if (atm.masterFx.isActive) {
        atm.phase += int._phaseInc
        atm.phase %= PI2
        callback(atm.target, atm.offset + atm.oscillation * Math.sin(atm.phase))
      }
    }
  }
  //: chorusLFO doesn't need this, but tremolo yes
  LFOFx.activate = ({int}, on) => on ? int.lfo.connect(waCtx.destination) : int.lfo.disconnect()

  registerFxType('fx_LFO', LFOFx)
  
  //: I don't have the faintest idea what is this doing, but it's creepy.
  //: Ok, I figured it out, it's fp mod, gives the exact same result as %. Wtf?
  /*const fmod = (x, y) => { 
    // http://kevin.vanzonneveld.net
    // *     example 1: fmod(5.7, 1.3);
    // *     returns 1: 0.5
    /* const tmpa = x.toExponential().match(/^.\.?(.*)e(.+)$/)
    const pa = parseInt(tmpa[2], 10) - (tmpa[1] + "").length
    const tmpb = y.toExponential().match(/^.\.?(.*)e(.+)$/)
    const pb = parseInt(tmpb[2], 10) - (tmpb[1] + "").length
    const p = Math.min(pa, pb)
    const mod = (x % y)

    if (p < -100 || p > 20) { // toFixed will give an out of bound error so we fix it like this:
      const l = Math.round(Math.log(mod) / Math.log(10))
      const l2 = Math.pow(10, l)
      return (mod / l2).toFixed(l - p) * l2
    } else {
      return parseFloat(mod.toFixed(-p))
    }
  } */
  
  const tremoloLFOFx = { //8#a6e ---------- tremoloLFO (Tuna) ----------
    def: {
      intensity: {defVal: .3, min: 0, max: 1},
      stereoPhase: {defVal: 0, min: 0, max: 180},
      rate: {defVal: 5, min: 0.1, max: 11}
    },
    midi: {pars: ['intensity,stereoPhase,rate']},
    name: 'Tremolo (LFO)'
  }
  
  tremoloLFOFx.setValue = ({int}, key, value) => ({
    intensity: _ => {
      int.lfoL.setValue('offset', 1 - value / 2)
      int.lfoR.setValue('offset', 1 - value / 2)
      int.lfoL.setValue('oscillation', value)
      int.lfoR.setValue('oscillation', value)
    },
    stereoPhase: _ =>
      int.lfoR.setValue('phase', (int.lfoL.atm.phase + value * PI / 180) % PI2),
    rate: _ => {
      int.lfoL.setValue('frequency', value)
      int.lfoR.setValue('frequency', value)
    }
  }[key])

  tremoloLFOFx.construct = (fx, pars, {int, atm} = fx) => {
    int.splitter = fx.start = waCtx.createChannelSplitter(2)
    int.amplitudeL = waCtx.createGain()
    int.amplitudeR = waCtx.createGain()
    int.merger = waCtx.createChannelMerger(2)
    int.lfoL = newFx('fx_LFO', {initial: {
      masterFx: fx,
      target: int.amplitudeL.gain,
      callback: (par, val) => par.value = val
    }})
    int.lfoR = newFx('fx_LFO', {initial: {
      masterFx: fx,
      target: int.amplitudeR.gain,
      callback: (par, val) => par.value = val
    }})

    connectArr(int.splitter, [int.amplitudeL, 0], [int.merger, 0, 0])
    connectArr(int.splitter, [int.amplitudeR, 1], [int.merger, 0, 1])
    int.merger.connect(fx.output)

    int.lfoL.setValue('offset', 1 - (atm.intensity / 2))
    int.lfoR.setValue('offset', 1 - (atm.intensity / 2))
    int.lfoL.setValue('phase', atm.stereoPhase * PI / 180)
  }
  registerFxType('fx_tremoloLFO', tremoloLFOFx)
  
  const phaserLFOFx = { //8#a77 ---------- phaserLFO (Tuna) ----------
    def: {
      rate: {defVal: .1, min: 0, max: 8},
      depth: {defVal: .6, min: 0, max: 1},
      feedback: {defVal: .6, min: 0, max: 1},
      baseModulationFrequency: {defVal: 700, min: 500, max: 1500, unit: 'Hz', name: 'baseModFreq'},
      stereoPhase: {defVal: 40, min: 0, max: 180}
    },
    midi: {pars: ['rate,depth,feedback', 'baseModulationFrequency,stereoPhase']},
    name: 'Phaser (LFO)'
  }
  
  phaserLFOFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    rate: _ => {
      int.lfoL.setValue('frequency', value)
      int.lfoR.setValue('frequency', value)
    },
    depth: _ => {
      int.lfoL.setValue('oscillation', atm.baseModulationFrequency * atm.depth)
      int.lfoR.setValue('oscillation', atm.baseModulationFrequency * atm.depth)
    },
    feedback: _ => {
      fx.setAt('feedbackL', 'gain', value)
      fx.setAt('feedbackR', 'gain', value)
    },
    baseModulationFrequency: _ => {
      int.lfoL.setValue('offset', atm.baseModulationFrequency)
      int.lfoR.setValue('offset', atm.baseModulationFrequency)
      int.lfoL.setValue('oscillation', atm.baseModulationFrequency * atm.depth)
      int.lfoR.setValue('oscillation', atm.baseModulationFrequency * atm.depth)
    },
    stereoPhase: _ =>
      int.lfoR.setValue('phase', (int.lfoL.atm.phase + value * PI / 180) & PI2)
  }[key])

  phaserLFOFx.construct = (fx, pars, {int} = fx) => {
    int.stage = 4
    int.splitter = fx.start = waCtx.createChannelSplitter(2)
    int.filtersL = []
    int.filtersR = []
    int.feedbackL = waCtx.createGain()
    int.feedbackR = waCtx.createGain()
    int.merger = waCtx.createChannelMerger(2)
    
    const callback = (filters, value) => {
      for (const filter of filters) {
        filter.frequency.value = value
      }
    }
    int.lfoL = newFx('fx_LFO', {initial: {masterFx: fx, target: int.filtersL, callback}})
    int.lfoR = newFx('fx_LFO', {initial: {masterFx: fx, target: int.filtersR, callback}})
    
    for (let i = 0; i < int.stage; i++) {
      int.filtersL[i] = waCtx.createBiquadFilter()
      int.filtersR[i] = waCtx.createBiquadFilter()
      int.filtersL[i].type = 'allpass'
      int.filtersR[i].type = 'allpass'
    }
    fx.input.connect(int.splitter)
    fx.input.connect(fx.output)
    int.splitter.connect(int.filtersL[0], 0, 0)
    int.splitter.connect(int.filtersR[0], 1, 0)
    connectArr(...int.filtersL, int.feedbackL)
    connectArr(...int.filtersR, int.feedbackR)
    int.filtersL[int.stage - 1].connect(int.merger, 0, 0)
    int.filtersR[int.stage - 1].connect(int.merger, 0, 1)
    int.feedbackL.connect(int.filtersL[0])
    int.feedbackR.connect(int.filtersR[0])
    int.merger.connect(fx.output)
  }
  registerFxType('fx_phaserLFO', phaserLFOFx)
})
