/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, clamp} = Corelib
const {wassert} = Corelib.Debug
const {post} = Corelib.Tardis
const {pow, round, tanh, abs, min, sign} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, dB2Gain} = BeeFX(waCtx)
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  const e4 = (x, k) => 1.0 - Math.exp(-k * x)
  
  const shape = amount => {
    const threshold = -27 + 24 * (amount - .5) // -27
    const headroom = 21 + 24 * (amount - .5) // 27
    const linearThreshold = dB2Gain(threshold)
    const linearHeadroom = dB2Gain(headroom)
    const maximum = 1.505 * linearHeadroom * linearThreshold
    const kk = (maximum - linearThreshold)
    clog(`amount=${amount} threshold=${threshold} headroom=${headroom} linThr=${linearThreshold} linHead=${linearHeadroom} max=${maximum} kk=${kk}`)
    
    return x => {
      const sign = x < 0 ? -1 : +1
      const absx = Math.abs(x)
      const shapedInput = absx < linearThreshold 
        ? absx 
        : linearThreshold + kk * e4(absx - linearThreshold, 1.0 / kk)
      
      return shapedInput * sign
    }
  }
  
  const transAmount = amount => {
    const aa = clamp(amount, .01, .99)
    return (1 - aa) / aa // 0..inf
  }
  
  const genXoff = (confuse, n_samples, power = (1 - confuse)) => i => {
    const x = i / n_samples
    return 1 - pow(1 - x, power) * 2
  }
  
  const overdriveAlgorithms = algIx => (amount, n_samples, wsCurve, confuse) => ([
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const xmod = sign(x) * pow(abs(x), k)
        wsCurve[i] = (1 + k) * xmod / (1 + k * abs(xmod)) // 0...1+k / 1..1+k 
      }
      return 'Flex Xmod'
    },
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const xmod = sign(x) * pow(abs(x), pow(k, 1 / 4))
        wsCurve[i] = (1 + k) * xmod / (1 + k * abs(xmod)) // 0...1+k / 1..1+k 
      }
      return 'Flex XmodLow'
    },
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const y = (1 + k) * x / (1 + k * abs(x)) // 0...1+k / 1..1+k 
        wsCurve[i] = sign(y) * pow(abs(y), k)
      }
      return 'Flex Ymod'
    },
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const y = (1 + k) * x / (1 + k * abs(x)) // 0...1+k / 1..1+k 
        wsCurve[i] = sign(y) * pow(abs(y), pow(k, 1 / 4))
      }
      return 'Flex YmodLow'
    },
    _ => {
      const k = transAmount(1 - amount)
      const xoff = genXoff(confuse, n_samples)
      for (let i = 0; i < n_samples; i++) {
        const xmod = xoff(i)
        wsCurve[i] = (1 + k) * xmod / (1 + k * abs(xmod)) // 0...1+k / 1..1+k 
      }
      return 'SuperFlex XmodXoff'
    },
    _ => {
      const k = transAmount(amount)
      const xoff = genXoff(confuse, n_samples)
      for (let i = 0; i < n_samples; i++) {
        const xmod = xoff(i)
        const y = (1 + k) * xmod / (1 + k * abs(xmod)) // 0...1+k / 1..1+k 
        wsCurve[i] = sign(y) * pow(abs(y), k)
      }
      return 'SuperFlex YmodXoff'
    },
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const xmod = sign(x) * pow(abs(x), k)
        wsCurve[i] = Math.tanh(xmod)
      }
      return 'Flex tanh'
    },
    _ => {
      const k = transAmount(amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const xmod = sign(x) * pow(abs(x), k)
        const y = (1 + k) * xmod / (1 + k * abs(xmod)) // 0...1+k / 1..1+k 
        wsCurve[i] = sign(y) * pow(abs(y), k)
      }
      return 'Flex XYmod'
    },
    _ => {
      const k = transAmount(amount)
      
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const y = Math.asin(Math.tanh(x))
        wsCurve[i] = sign(y) * pow(abs(y), k)
      }
      return 'Gudermannian Ymod'
    },
    _ => {
      const k = transAmount(amount)
      
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const y = Math.asinh(Math.tan(x))
        wsCurve[i] = sign(y) * pow(abs(y), k)
      }
      return 'Gudermannian inverse Ymod'
    },
    _ => {
      amount = min(amount, 0.9999)
      const k = 2 * amount / (1 - amount)
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        wsCurve[i] = (1 + k) * x / (1 + k * abs(x))
      }
      return 'Tuna #0'
    },
    _ => {
      let y
      for (let i = 0; i < n_samples; i++) { //modprec orig
        const x = i * 2 / n_samples - 1
        y = ((0.5 * pow((x + 1.4), 2)) - 1) * (y >= 0 ? 5.8 : 1.2)
        wsCurve[i] = tanh(y)
      }
      return 'Tuna #1 fixed [no pars]'
    },
    _ => {
      const a = 1 - amount
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const y = x < 0 ? -pow(abs(x), a + 0.04) : pow(x, a)
        wsCurve[i] = tanh(y * 2)
      }
      return 'Tuna #2'
    },
    _ => {
      const a = 1 - amount > 0.99 ? 0.99 : 1 - amount
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        const abx = abs(x)
        const y = abx < a
          ? abx
          : abx > a
            ? a + (abx - a) / (1 + pow((abx - a) / (1 - a), 2))
            : abx > 1 ? abx : 0
        wsCurve[i] = sign(x) * y * (1 / ((a + 1) / 2))
      }
      return 'Tuna #3 mod'
    },
    _ => {
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        wsCurve[i] = x < -0.08905
          ? -3 / 4 * (1 - (pow((1 - (abs(x) - .032857)), 12)) + (1 / 3) * (abs(x) - .032847)) + .01
          : x >= -0.08905 && x < 0.320018
            ? -6.153 * (x * x) + 3.9375 * x
            : .630035
      }
      return 'Tuna #4 mod [no pars]'
    },
    _ => {
      const a = 2 + round(amount * 14)
      const bits = round(pow(2, a - 1))
      for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1
        wsCurve[i] = round(x * bits) / bits
      }
      return 'Tuna #5 Bitcrush'
    },
    _ => {
      const k = round(amount * 400)
      const deg = Math.PI / 180
      for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1
        wsCurve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x))
      }
      return 'Kevin Cennis'
    },
    _ => {
      const n2 = n_samples / 2
      const shaper = shape(amount)
      for (let i = 0; i < n2; ++i) {
        const x = shaper(i / n2)
        wsCurve[n2 + i] = x
        wsCurve[n2 - i - 1] = -x
      }
      return 'Colortouch mod (Chris Wilson)'
    },
    _ => {
      const n2 = n_samples / 2
      const shaper = shape(amount)
      for (let i = 0; i < n2; ++i) {
        const x = shaper(i / n2)
        wsCurve[n2 + i] = x
        wsCurve[n2 - i - 1] = x
      }
      return 'Mirror mod (Chris Wilson)'
    },
    _ => null
  ][algIx])()
  
  const algNameDb = []
  
  void (_ => {
    for (let ix = 0; ; ix++) {
      const algName = overdriveAlgorithms(ix)(0, 0, [])
      if (algName) {
        algNameDb.push([ix, algName])
      } else {
        break
      }
    }
  })()
  
  const confuseTheCurve = (n_samples, wsCurve, confuse) => {
    for (let i = 0; i < n_samples; i++) {
      //const data = wsCurve[i]
      wsCurve[i] = clamp((1 + abs(confuse)) * (wsCurve[i] - confuse), -1, 1)
    }
  }
  
  //: These two overdrive filters should be merged into two variants of one. Or not.
  
  const overdriveFx = {//8#9a4 ----- Overdrive (adapted from Tuna) -----
    def: {
      drive: {defVal: .5, min: .01, max: 1},
      autoGain: {defVal: true, type: 'boolean'},
      postDrive: {defVal: 2, min: .01, max: 50, subType: 'exp', readOnly: true},
      log: {defVal: '-', type: 'html'},
      outputGain: {defVal: 0, min: -46, max: 6, unit: 'dB'},
      curveAmount: {defVal: .5, min: 0, max: 1},
      confuse: {defVal: 0, min: -1, max: 1},
      algorithm: {defVal: 0, type: 'strings', subType: algNameDb},
      sigmoidGraph: {type: 'graph'}
    },
    midi: {pars: ['drive,postDrive,outputGain', 'curveAmount,confuse']},
    name: 'Overdrive',
    graphs: {}
  }
  overdriveFx.graphs.sigmoidGraph = {
    graphType: 'sigmoid',
    genCurveColor: '#fc6'
  }
  
  overdriveFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    log: nop,
    postDrive: nop,
    confuse: _ => fx.rerunAlgorithm(),
    drive: _ => {
      fx.setAt('inputDrive', 'gain', value)
      fx.updateOutputGain()
    },
    outputGain: _ => fx.updateOutputGain(),
    autoGain: _ => fx.updateOutputGain(),
    curveAmount: _ => fx.rerunAlgorithm(),
    algorithm: _ => {
      int.algorithm = overdriveAlgorithms(parseInt(value))
      wassert(int.algorithm)
      fx.rerunAlgorithm()
    }
  }[key])
  
  overdriveFx.construct = (fx, {initial}, {int, atm} = fx) => {
    int.nSamples = 2048
    int.wsCurve = new Float32Array(int.nSamples)
    int.graphDiv = 4 // 2048 / 4 = 512
    
    int.inputDrive = waCtx.createGain()
    int.waveshaper = waCtx.createWaveShaper()
    int.outputDrive = waCtx.createGain()
    int.output = waCtx.createGain()
    connectArr(fx.start, int.inputDrive, int.waveshaper, int.outputDrive, fx.output)
    
    fx.rerunAlgorithm = _ => {
      if (int.algorithm) {
        int.lastAlgName = int.algorithm(atm.curveAmount, int.nSamples, int.wsCurve, atm.confuse)
        if (atm.confuse) {
          confuseTheCurve(int.nSamples, int.wsCurve, atm.confuse)
        }
        int.waveshaper.curve = int.wsCurve
        fx.valueChanged('drive')//: redraw graph?
      }
    }
    fx.updateLog = _ => {
      fx.setValue('log', [
        `outputGain(Db): ${atm.outputGain} outputGain(Gain): ${int.outputGainGain}`,
        `outputGainMod: ${int.outputGainMod} outputGainReal: ${int.outputGainReal.toFixed(3)}`
      ].join('<br>'))
    }
    fx.updateOutputGain = _ => post(_ => {
      fx.setValue('postDrive', atm.autoGain ? round(1000 * Math.pow(1 / atm.drive, .75)) / 1000 : 1)
      int.outputGainGain = dB2Gain(atm.outputGain)
      int.outputGainMod = atm.autoGain ? atm.postDrive : 1
      int.outputGainReal = int.outputGainMod * int.outputGainGain
      fx.setAt('outputDrive', 'gain', int.outputGainReal)
      fx.updateLog()
    })
  }
  registerFxType('fx_overdrive', overdriveFx)
  
  const overdriveWACFx = {//8#a90 ----- Overdrive (from WAC) -----
    def: {
      drive: {defVal: .5, min: 0, max: 1},
      preBand: {defVal: .5, min: 0, max: 1},
      color: {defVal: 800, min: 10, max: 22050, subType: 'exp'},
      postCut: {defVal: 3000, min: 10, max: 22050, subType: 'exp'},
      freqGraph: {type: 'graph'},
      curveAmount: {defVal: .5, min: 0, max: 1},
      algorithm: {defVal: 0, type: 'strings', subType: algNameDb},
      oversampling4x: {defVal: false, type: 'boolean', uiLabel: '4x oversampl'},
      sigmoidGraph: {type: 'graph'}
    },
    midi: {pars: ['drive,preBand', 'color,postCut,curveAmount']},
    name: 'OverdriveWAC',
    graphs: {}
  }
  overdriveWACFx.graphs.freqGraph = [{
    graphType: 'freq',
    filter: 'lowpass',
    minDb: -43,
    maxDb: 16,
    magCurveColor: `hsla(120, 99%, 55%)`,
    diynamic: .8
  }, {
    graphType: 'freq',
    filter: 'bandpass',
    renderSet: {doClear: false, doGrid: false, doGraph: true},
    minDb: -43,
    maxDb: 16,
    magCurveColor: `hsla(20, 99%, 65%)`,
    diynamic: .8
  }]
  overdriveWACFx.graphs.sigmoidGraph = {
    graphType: 'sigmoid',
    genCurveColor: '#fbb'
  }
  
  overdriveWACFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    drive: _ => fx.rerunAlgorithm(value),
    preBand: _ => {
      fx.setAt('bpWet', 'gain', value)
      fx.setAt('bpDry', 'gain', 1 - value)
    },
    color: _ => fx.setAt('bandpass', 'frequency', value),
    postCut: _ =>  fx.setAt('lowpass', 'frequency', value),
    curveAmount: _ => fx.rerunAlgorithm(),
    algorithm: _ => {
      int.algorithm = overdriveAlgorithms(parseInt(value))
      fx.rerunAlgorithm()
    },
    oversampling4x: _ => int.waveshaper.oversampling = value ? '4x' : 'none'
  }[key])
  
  overdriveWACFx.construct = (fx, {initial}, {int, atm} = fx) => {
    int.nSamples = 2048 // 8192
    int.wsCurve = new Float32Array(int.nSamples)
    int.graphDiv = 4 // 2048 / 4 = 512

    int.bandpass = waCtx.createBiquadFilter()
    int.bpWet = waCtx.createGain()
    int.bpDry = waCtx.createGain()
    int.waveshaper = waCtx.createWaveShaper()
    int.lowpass = waCtx.createBiquadFilter()
    
    connectArr(fx.start, int.bandpass, int.bpWet, int.waveshaper, int.lowpass, fx.output)
    connectArr(int.bandpass, int.bpDry, int.lowpass)  
    
    fx.rerunAlgorithm = _ => {
      if (int.algorithm) {
        int.lastAlgName = int.algorithm(atm.curveAmount, int.nSamples, int.wsCurve, atm.confuse)
        int.waveshaper.curve = int.wsCurve
        fx.valueChanged('drive')
      }
    }
  }
  registerFxType('fx_overdriveWAC', overdriveWACFx)
})
