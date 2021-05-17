/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  //: fx dependencies: LFO (but not on the first run registering the Fx, only on construct)
  
  const chorusLFOFx = { //8#a6e --------- chorusLFO (adapted from Tuna / Oskar Eriksson) ---------
    def: {
      feedback: {defVal: .4, min: 0, max: .95},
      delay: {defVal: 4.5, min: 0.01, max: 1000, subType: 'exp', unit: 'ms'},
      depth: {defVal: .7, min: 0, max: 1},
      rate: {defVal: 1.5, min: 0, max: 8} //: there could be a two-channel version for this too
    },
    midi: {pars: ['feedback,delay,depth', 'rate']},
    name: 'Chorus (LFO)'
  }
  
  chorusLFOFx.setValue = (fx, key, value, {int} = fx) => ({
    delay: _ => {
      int._delay = 0.0002 * (Math.pow(10, value / 1000) * 2)
      int.lfoL.setValue('offset', int._delay)
      int.lfoR.setValue('offset', int._delay)
    },
    depth: _ => {
      int.lfoL.setValue('oscillation', value * int._delay)
      int.lfoR.setValue('oscillation', value * int._delay)
    },
    feedback: _ => {
      fx.setAt('feedbackLR', 'gain', value)
      fx.setAt('feedbackRL', 'gain', value)
    },
    rate: _ => {
      int.lfoL.setValue('frequency', value)
      int.lfoR.setValue('frequency', value)
    }
  }[key])

  chorusLFOFx.construct = (fx, pars, {int} = fx) => {
    int.attenuator = waCtx.createGain()
    int.attenuator.gain.value = 0.6934 // 1 / (10 ^ (((20 * log10(3)) / 3) / 20))
    fx.start = int.attenuator
    
    int.splitter = waCtx.createChannelSplitter(2)
    int.delayL = waCtx.createDelay(2)
    int.delayR = waCtx.createDelay(2)
    int.feedbackLR = waCtx.createGain()
    int.feedbackRL = waCtx.createGain()
    int.merger = waCtx.createChannelMerger(2)

    int.lfoL = newFx('fx_LFO', {initial: {
      masterFx: fx,
      target: int.delayL.delayTime,
      callback: (par, val) => par.value = Math.abs(val || 0) //: protects against NaNs
    }})
    int.lfoR = newFx('fx_LFO', {initial: {
      masterFx: fx,
      target: int.delayR.delayTime,
      callback: (par, val) => par.value = Math.abs(val || 0)
    }})
    //: Sometimes the LFO calls with negative value (-1E7) which drives WAU mad -> Math.abs.

    int.attenuator.connect(fx.output)
    int.attenuator.connect(int.splitter)
    connectArr(int.splitter, [int.delayL, 0], int.feedbackLR, int.delayR, [int.merger, 0, 1])
    connectArr(int.splitter, [int.delayR, 1], int.feedbackRL, int.delayL, [int.merger, 0, 0])
    int.merger.connect(fx.output)

    int.lfoR.setValue('phase', Math.PI / 2)
  }
  registerFxType('fx_chorusLFO', chorusLFOFx)
  
  const chorusOscFx = { //8#b6b ---------- chorusOsc (Chris Wilson) ----------
    def: {
      delay: {defVal: 30, min: 5, max: 55},
      depth: {defVal: 2, min: .5, max: 4.0},
      speed: {defVal: 3.5, min: .5, max: 15}
    },
    name: 'Chorus (osc)'
  }
  
  chorusOscFx.setValue = (fx, key, value) => ({
    delay: _ => fx.setDelayTime('delayNode', value / 1000),
    depth: _ => fx.setAt('gain', 'gain', value / 1000),
    speed: _ => fx.setAt('osc', 'frequency', value)
  }[key])
  
  chorusOscFx.construct = (fx, pars, {int} = fx) => {
    int.delayNode = waCtx.createDelay(2)
    int.osc = waCtx.createOscillator()
    int.osc.type = 'sine'
    int.gain = waCtx.createGain()

    connectArr(int.osc, int.gain, int.delayNode.delayTime)
    connectArr(fx.start, int.delayNode, fx.output)
    fx.start.connect(fx.output)

    int.osc.start(0) //: This oscillator should be stopped on deact?
  }

  registerFxType('fx_chorusOsc', chorusOscFx)
})
