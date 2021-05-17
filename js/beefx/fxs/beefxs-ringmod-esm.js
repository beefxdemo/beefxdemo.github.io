/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType} = BeeFX(waCtx)
  
  //: Diodes should have a stand-alone Fx! But this should bee rewritten anyway.

  // # DiodeNode
  // This class implements the diode described in Parker's paper using the Web Audio API's
  // [WaveShaperNode](https://webaudio.github.io/web-audio-api/#WaveShaperNode) interface.
  
  class DiodeNode {
    constructor (waCtx) {
      this.context = waCtx
      this.node = this.context.createWaveShaper()

      this.vb = 0.2   // three initial parameters controlling the shape of the curve
      this.vl = 0.4
      this.h = 1
      this.setCurve()
    }

    setDistortion (distortion) {
      // We increase the distortion by increasing the gradient of the
      // linear portion of the waveshaper's curve.
      this.h = distortion
      return this.setCurve()
    }

    // The non-linear waveshaper curve describes the transformation between an input signal and an
    // output signal. We calculate a 1024-point curve following equation (2) from Parker's paper.
    
    setCurve () {
      const samples = 1024
      const wsCurve = new Float32Array(samples)

      for (let i = 0, end = wsCurve.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        // Convert the index to a voltage of range -1 to 1.
        var value
        let v = (i - (samples / 2)) / (samples / 2)
        v = Math.abs(v)

        if (v <= this.vb) {
          value = 0
        } else if ((this.vb < v) && (v <= this.vl)) {
          value = this.h * ((Math.pow(v - this.vb, 2)) / ((2 * this.vl) - (2 * this.vb)))
        } else {
          value = ((this.h * v) - (this.h * this.vl)) + (this.h * ((Math.pow(this.vl - this.vb, 2)) / ((2 * this.vl) - (2 * this.vb))))
        }

        wsCurve[i] = value
      }

      return this.node.curve = wsCurve
    }

    // We provide a connect method so that instances of this class
    // can be connected to other nodes in a consistent way.
    connect (destination) {
      return this.node.connect(destination)
    }
  }

  const bbcRingModulatorFx = {//8#77d ------- BBC Ring Modulator -------
    def: {
      distortion: {defVal: 1, min: .2, max: 50, subType: 'exp'},
      speed: {defVal: 30, min: 0.01, max: 2000, subType: 'exp'},
      threshold: {defVal: -12, min: -24, max: -3},
      ratio: {defVal: 12, min: 6, max: 18},
      gain: {defVal: 2, min: 2, max: 4}
    },
    midi: {pars: ['distortion,gain', 'speed,threshold,ratio']},
    name: 'BBC Ring Modulator'
  }

  bbcRingModulatorFx.setValue = (fx, key, value) => ({
    distortion: _ => fx.setDistortion(value),
    speed: _ => fx.setAt('vIn', 'frequency', value),
    threshold: _ => fx.setAt('compressor', 'threshold', value),
    ratio: _ => fx.setAt('compressor', 'ratio', value),
    gain: _ => fx.setAt('outGain', 'gain', value)
  }[key])
  
  bbcRingModulatorFx.construct = (fx, pars, {int} = fx) => {
    int.vIn = waCtx.createOscillator()
    int.vIn.frequency.value = 30
    int.vIn.start(0)
    int.vInGain = waCtx.createGain()
    int.vInGain.gain.value = 0.5
  
    // GainNodes can take negative gain which represents phase inversion.
    int.vInInverter1 = waCtx.createGain()
    int.vInInverter1.gain.value = -1
  
    int.vInInverter2 = waCtx.createGain()
    int.vInInverter2.gain.value = -1
  
    int.vInDiode1 = new DiodeNode(waCtx)
    int.vInDiode2 = new DiodeNode(waCtx)
  
    int.vInInverter3 = waCtx.createGain()
    int.vInInverter3.gain.value = -1
  
    int.vcInverter1 = waCtx.createGain()
    int.vcInverter1.gain.value = -1
    int.vcDiode3 = new DiodeNode(waCtx)
    int.vcDiode4 = new DiodeNode(waCtx)
    int.diodes = [int.vInDiode1, int.vInDiode2, int.vcDiode3, int.vcDiode4]
  
    // A gain node to control master output levels.
    int.outGain = waCtx.createGain()
    int.outGain.gain.value = 4
  
    // A small addition to the graph given in Parker's paper is a compressor node immediately
    // before the output. This ensures that the user's volume remains somewhat constant when the
    // distortion is increased.
    int.compressor = waCtx.createDynamicsCompressor()
    int.compressor.threshold.value = -12
  
    // First the Vc side,
    fx.start.connect(int.vcInverter1)
    fx.start.connect(int.vcDiode4.node)
    int.vcInverter1.connect(int.vcDiode3.node)
  
    // then the Vin side.
    int.vIn.connect(int.vInGain)
    int.vInGain.connect(int.vInInverter1)
    int.vInGain.connect(int.vcInverter1)
    int.vInGain.connect(int.vcDiode4.node)
  
    int.vInInverter1.connect(int.vInInverter2)
    int.vInInverter1.connect(int.vInDiode2.node)
    int.vInInverter2.connect(int.vInDiode1.node)
  
    // Finally connect the four diodes to the destination via the
    // output-stage compressor and master gain node.
    int.vInDiode1.connect(int.vInInverter3)
    int.vInDiode2.connect(int.vInInverter3)
  
    int.vInInverter3.connect(int.compressor)
    int.vcDiode3.connect(int.compressor)
    int.vcDiode4.connect(int.compressor)
  
    int.compressor.connect(int.outGain)
    int.outGain.connect(fx.output)
    
    fx.setDistortion = value => {
      for (const diode of int.diodes) {
        diode.setDistortion(value)
      }
    }
  }
  registerFxType('fx_bbcRingModulator', bbcRingModulatorFx)
  
  const simpeRingModulatorFx = { //8#05e -------RingModulator (Chris Wilson) -------
    def: {
      speed: {defVal: 440, min: 55, max: 8000, subType: 'exp', unit: 'Hz'}
    },
    name: 'Ring modulator (simple)'
  }
  simpeRingModulatorFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    speed: _ =>  fx.setAt('osc', 'frequency', value)
  }[key])
  
  simpeRingModulatorFx.construct = (fx, {initial}, {int} = fx) => {
    int.osc = waCtx.createOscillator()
    int.osc.type = 'sine'
    int.osc.start(0)
    int.ring = waCtx.createGain()
    int.ring.gain.value = 0
    int.gain = waCtx.createGain()
    int.osc.connect(int.ring.gain)
    connectArr(fx.start, int.gain, int.ring, fx.output)
  }

  registerFxType('fx_simpleRingModulator', simpeRingModulatorFx)
})
