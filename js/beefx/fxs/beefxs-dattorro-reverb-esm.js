/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {AudioWorkletNode} = window

onWaapiReady.then(async waCtx => {
  const {registerFxType, connectArr, getJsPath, nowa} = BeeFX(waCtx)
  
  const presets = {
    preDelay: [1525, 0, 0, 0],
    bandwidth: [0.5683, 0.928, 0.999, 0.999],
    inputDiffusion1: [0.4666, 0.7331, 0.75, 0.23],
    inputDiffusion2: [0.5853, 0.4534, 0.625, 0.667],
    decay: [0.3226, 0.8271, 1, 0.86],
    decayDiffusion1: [0.6954, 0.7839, 0.5, 0.7],
    decayDiffusion2: [0.6022, 0.1992, 0.711, 0.5],
    damping: [0.6446, 0.5975, 0.005, 0.3],
    excursionRate: [0, 0, 0.3, 0.7],
    excursionDepth: [0, 0, 1.4, 1.2],
    dry: [0.2921, 0.0042, 0.915, 0.53],
    wet: [0.4361, 0.9000, 0.194, 0.30]
  }
  
  const loadPreset = (fx, ix) => {
    if (ix) {
      for (const key in presets) {
        fx.setValue(key, presets[key][ix - 1])
      }
    }
  }
  
  const presetNames = [
    [0, 'none'],
    [1, 'room'],
    [2, 'church'],
    [3, 'freeze'],
    [4, 'ether']
  ]
  
  const auWorkletPromise = waCtx.audioWorklet.addModule(getJsPath('beefx/fxs/dattorroReverb.js'))
  auWorkletPromise
    .then(_ => console.log(`Dattoro's reverb audioWorklet loaded.`))
    .catch(err => console.error(`Dattoro's reverb audioWorklet failed to load.`, err))
    
  const dattoroReverbFx = {
    def: {
      preset: {defVal: 0, type: 'strings', subType: presetNames},
      preDelay: {defVal: 0, min: 0, max: waCtx.sampleRate - 1},
      bandwidth: {defVal: .9999, min: 0, max: 1},
      inputDiffusion1: {defVal: .75, min: 0, max: 1, name: 'inputDiffus1'},
      inputDiffusion2: {defVal: .75, min: 0, max: 1, name: 'inputDiffus2'},
      decay: {defVal: .5, min: 0, max: 1},
      decayDiffusion1: {defVal: .7, min: 0, max: .999999, name: 'decayDiffus1'},
      decayDiffusion2: {defVal: .5, min: 0, max: .999999, name: 'decayDiffus2'},
      damping: {defVal: .005, min: 0, max: 1},
      excursionRate: {defVal: .5, min: 0, max: 2, name: 'excurs.Rate'},
      excursionDepth: {defVal: .7, min: 0, max: 2, name: 'excurs.Depth'},
      wet: {defVal: .3, min: 0, max: 1},
      dry: {defVal: .6, min: 0, max: 1}
    },
    promises: [auWorkletPromise],
    midi: {pars: [
      'preDelay,inputDiffusion1,decayDiffusion1',
      'bandwidth,inputDiffusion2,decayDiffusion2',
      'excursionRate,wet,decay', 
      'excursionDepth,dry,damping'
    ]},
    name: `Reverb (Dattorro)`
  }

  dattoroReverbFx.setValue = (fx, key, value, {int} = fx) => ({
    preset: _ => loadPreset(fx, value)
  }[key] || (_ => fx.refreshParams()))
  
  dattoroReverbFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.dattorro = new AudioWorkletNode(waCtx, 'DattorroReverb', {outputChannelCount: [2]})
    
    const getPar = key => int.dattorro.parameters.get(key)
    
    connectArr(fx.start, int.dattorro, fx.output)
    
    fx.refreshParams = _ => {
      for (const key in exo.def) {
        key !== 'preset' && 
          getPar(key).linearRampToValueAtTime(atm[key], nowa(.19))
      }
    }
  }

  registerFxType('fx_dattoroReverb', dattoroReverbFx)
})
