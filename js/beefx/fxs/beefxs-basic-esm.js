/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, nowa} = BeeFX(waCtx)
  
  const blankFx = { //8#bbb ------- blank (there won't be any simpler Fx than this) -------
    def: {}
  }
  blankFx.construct = fx => fx.start.connect(fx.output)

  registerFxType('fx_blank', blankFx)
  
  const gainFx = { //8#a00 ------- WAU gain -------
    def: {
      gain: {defVal: 1, min: 0.05, max: 10, name: 'gain', subType: 'exp'}
    },
    midi: {pars: ['gain']}
  }
  gainFx.setValue = (fx, key, value) => ({
    gain: _ => fx.setAt('gain', 'gain', Math.pow((value - gainFx.def.gain.min) / .9, .6))
  }[key])
  
  gainFx.construct = (fx, pars, {int} = fx) => {
    int.gain = waCtx.createGain()
    connectArr(fx.start, int.gain, fx.output)
  }
  registerFxType('fx_gain', gainFx)

  const delayWAFx = { //8#a0a ------- WAU delay -------
    def: {
      delayTime: {defVal: 0, min: 0, max: 2, unit: 's'}
    },
    midi: {pars: ['delayTime']}
  }
  delayWAFx.setValue = (fx, key, value) => ({
    //: Unsolved issue: what is the best way to set the delay? (it clicks like H).
    //delayTime: _ => fx.setDelayTime('delay', value)
    delayTime: _ => fx.int.delay.delayTime.linearRampToValueAtTime(value, nowa(), .05)
  }[key])

  delayWAFx.construct = (fx, pars, {int} = fx) => {
    int.delay = waCtx.createDelay(10)
    connectArr(fx.start, int.delay, fx.output)
  }
  registerFxType('fx_delayWA', delayWAFx)
  
  const biquadOptions = [ //8#48d ------- WAU biquadFilter -------
    ['lowpass', 'lowpass [no gain]'],
    ['highpass', 'highpass [no gain]'],
    ['bandpass', 'bandpass [no gain]'],
    ['lowshelf', 'lowshelf, [no Q]'],
    ['highshelf', 'highshelf [no Q]'],
    ['allpass', 'allpass [no gain]'],
    ['notch', 'notch [no gain]'],
    ['peaking', 'peaking']
  ]
  const biquadFx = {
    def: {
      filterType: {defVal: 'peaking', type: 'strings', subType: biquadOptions},
      frequency: {defVal: 800, min: 20, max: 22050, subType: 'exp', unit: 'Hz'},
      detune: {defVal: 0, min: -600, max: 600, unit: 'cent', subType: 'int'},
      gain: {defVal: 0, min: -40, max: 40, unit: 'dB'},
      Q: {defVal: 1, min: .0001, max: 100, subType: 'exp'},
      freqGraph: {type: 'graph'}
    },
    midi: {pars: ['gain,Q', 'frequency,detune']},
    name: 'BiquadFilter',
    graphs: {}
  }
  biquadFx.graphs.freqGraph = {
    graphType: 'freq',
    filter: 'biquad',
    minDb: -43,
    maxDb: 53,
    diynamic: .8
  }
  //: const detuneFactor = Math.log(2) / 1200
  //: const hz = Math.pow2(detune / 1200)
  //: const detune = Math.log(hz) / Math.log(2) * 1200
  //: const detune = Math.log(hz) / detuneFactor
  
  biquadFx.setValue = (fx, key, value) => ({
    filterType: _ => fx.int.biquad.type = value,
    frequency: _ => fx.setAt('biquad', 'frequency', value),
    detune: _ => fx.setAt('biquad', 'detune', value),
    gain: _ => fx.setAt('biquad', 'gain', value),
    Q: _ => fx.int.biquad.Q.value = value
  }[key])
    
  biquadFx.construct = (fx, pars, {int} = fx) => {
    int.biquad = waCtx.createBiquadFilter()
    connectArr(fx.start, int.biquad, fx.output)
  }
  registerFxType('fx_biquad', biquadFx)
})
