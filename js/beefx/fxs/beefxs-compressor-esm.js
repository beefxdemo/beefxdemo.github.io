/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {registerFxType, dB2Gain} = BeeFX(waCtx)

  const compressorFx = {//8#9a4 ----- Compressor (source: Oskar Eriksson / Tuna) -----
    def: {
      threshold: {defVal: -20, min: -60, max: 0, unit: 'dB'},
      knee: {defVal: 5, min: 0, max: 40, unit: 'dB'},
      ratio: {defVal: 4, min: 1, max: 20, subType: 'exp'},
      attack: {defVal: 10, min: 0, max: 1000, unit: 'ms'},
      release: {defVal: 250, min: 10, max: 1000, unit: 'ms'},
      autoMakeup: {defVal: true, type: 'boolean'},
      makeupGain: {defVal: 1, min: 1, max: 10, unit: 'dB'},
      compressorGraph: {type: 'graph'}
    },
    midi: {pars: ['threshold,knee,ratio', 'attack,release,makeupGain']},
    graphs: {
      compressorGraph: {
        graphType: 'compressor',
        minMs: 0,
        maxMs: 2750,
        minDb: -60,
        maxDb: 11,
        dbWidthFactor: .5,
        msOffsetFactor: .5    
      }
    }
  }
  
  compressorFx.setValue = (fx, key, value, {int} = fx) => ({
    threshold: _ => {
      int.compNode.threshold.value = value
      int.recompute()
    },
    knee: _ => {
      int.compNode.knee.value = value
      int.recompute()
    },
    attack: _ => int.compNode.attack.value = value / 1000,
    release: _ => int.compNode.release.value = value / 1000,
    ratio: _ => {
      int.compNode.ratio.value = value
      int.recompute()
    },
    makeupGain: _ => {
      fx.setAt('makeupNode', 'gain', dB2Gain(value))
      int.computingOn || fx.setValue('autoMakeup', false) //: else thr->makeupGain turns it off
    },
    autoMakeup: _ => int.recompute()
  }[key])
  
  compressorFx.construct = (fx, pars, {int, atm} = fx) => {
    int.compNode = fx.start = waCtx.createDynamicsCompressor()
    int.makeupNode = waCtx.createGain()
    int.compNode.connect(int.makeupNode)
    int.makeupNode.connect(fx.output)
    
    int.recompute = _ => {
      const {threshold, autoMakeup, ratio} = atm
      if (autoMakeup) {
        const magicCoeff = 4 //: raise if the output is too hot
        int.computingOn = true
        fx.setValue('makeupGain', -(threshold - threshold / ratio) / magicCoeff)
        int.computingOn = false
      }
    }
  }

  registerFxType('fx_compressor', compressorFx)
})
