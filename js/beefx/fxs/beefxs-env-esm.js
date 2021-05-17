/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, import/first,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, clamp} = Corelib
const {wejectNaN} = Corelib.Debug
const {startEndThrottle} = Corelib.Tardis
const {min, pow, exp, sqrt, round} = Math

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)
  const {sampleRate} = waCtx
  const nyquist = sampleRate / 2
  const logOn = false

  const envelopeFollowerFx = { //8#04c ------- envelopeFollower (adapted from Tuna) -------
    def: {
      attackTime: {defVal: 3, min: 0, max: 5000}, // sec * 1000
      releaseTime: {defVal: 500, min: 0, max: 500}, // sec * 1000
      masterFx: {defVal: {}},
      callback: {defVal: nop, skipUi: true}
    },
    uiSelectDisabled: true
  }
  
  envelopeFollowerFx.setValue = ({int}, key, value) => ({
    attackTime: _ => {
      int._attackTime = value / 1000
      int._attackC = exp(-1 / int._attackTime * sampleRate / int.buffersize)
      wejectNaN(int._attackC)
    },
    releaseTime: _ => {
      int._releaseTime = value / 1000
      int._releaseC = exp(-1 / int._releaseTime * sampleRate / int.buffersize)
      wejectNaN(int._releaseC)
    },
    masterFx: nop,
    callback: nop
  }[key])
  
  envelopeFollowerFx.construct = (fx, pars, {int, atm} = fx) => {
    int.buffersize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
    int.envelope = 0
    int.scriptNode = fx.output = waCtx.createScriptProcessor(int.buffersize, 1, 1)
    fx.input.connect(fx.output)

    int.compute = ({inputBuffer}) => {
      if (atm.masterFx.isActive) {
        const count = inputBuffer.getChannelData(0).length
        const channels = inputBuffer.numberOfChannels
        let rms = 0
        
        for (let chan = 0; chan < channels; ++chan) { //: always 1 if we give 1, 1 as params above
          const data = inputBuffer.getChannelData(chan)
          for (let i = 0; i < count; ++i) {
            const current = data[i]
            rms += current * current
          }
        }
        rms /= channels
        rms = sqrt(rms)

        if (int.envelope < rms) {
          int.envelope *= int._attackC
          int.envelope += (1 - int._attackC) * rms
        } else {
          int.envelope *= int._releaseC
          int.envelope += (1 - int._releaseC) * rms
        }
        atm.callback(int.envelope)
      }
    }
  }
  envelopeFollowerFx.activate = ({int}, on) => {
    if (on) {
      int.scriptNode.connect(waCtx.destination)
      int.scriptNode.onaudioprocess = int.compute
    } else {
      int.scriptNode.disconnect()
      int.scriptNode.onaudioprocess = null
    }
  }
  registerFxType('fx_envelopeFollower', envelopeFollowerFx)
  
  const wahWahEFFx = { //8#a6e ---------- wahWahEF (Tuna) ----------
    def: {
      baseFreq: {defVal: 50, min: 20, max: 10000, unit: 'Hz', subType: 'exp'},
      excursionOctaves: {defVal: 2, min: 1, max: 6, name: 'excursionOct'},
      resonance: {defVal: 10, min: 1, max: 100, subType: 'exp'},
      automode: {defVal: true, type: 'boolean'},
      linThrottle: {defVal: 1, min: .5, max: 2.5},
      expThrottle: {defVal: .5, min: 1, max: 5, subType: 'exp'},
      envelope: {defVal: .2, min: 0, max: 1.2, readOnly: true, name: 'envFollower'},
      sweep: {defVal: .2, min: 0, max: 1.2, name: 'sweep'},
      sensitivity: {defVal: 3, min: .1, max: 10, subType: 'exp'},
      filterGraph: {type: 'graph'}
    },
    midi: {pars: ['baseFreq,excursionOctaves,resonance', 'sensitivity', 'sweep']},
    name: 'Wah-Wah (EF)',
    graphs: {
      filterGraph: [{
        graphType: 'freq',
        triggerKeys: ['filterGraph'],
        filter: 'filterBp',
        minDb: -27,
        maxDb: 33,
        diynamic: .8,
        customRenderer: {
          pre: ({fx, cc, ccext, freq}) => {
            const baseX = freq.freq2X[round(fx.atm.baseFreq)] || 0
            const excurX = freq.freq2X[round(fx.int._excursionFreq)] || 0
            const gradient = cc.createLinearGradient(baseX, 0, excurX, 0)
            gradient.addColorStop(0, `hsla(120,75%,50%,.5)`)
            gradient.addColorStop(.5, `hsla(60,75%,50%,.5)`)
            gradient.addColorStop(1, `hsla(0,75%,50%,.5)`)
            cc.fillStyle = gradient
            cc.fillRect(baseX, 0, excurX, ccext.height)
          }
        },
        phaseCurveColor: `hsla(330, 99%, 75%, .5)`,
        magCurveColor: `hsl(330, 99%, 75%)`
      }, {
        graphType: 'freq',
        triggerKeys: ['filterGraph'],
        filter: 'filterPeaking',
        renderSet: {doClear: false, doGrid: false, doGraph: true},
        minDb: -27,
        maxDb: 33,
        diynamic: .8,
        phaseCurveColor: `hsla(70, 99%, 75%, .5)`,
        magCurveColor: `hsl(70, 99%, 75%)`
      }]
    }
  }
  
  wahWahEFFx.onActivated = (fx, isActive) => fx.int.envelopeFollower.activate(isActive)
  
  wahWahEFFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    automode: _ => {
      if (value) {
        fx.start.connect(int.envelopeFollower.input)
        int.envelopeFollower.activate(true)
      } else {
        int.envelopeFollower.activate(false)
        fx.start.disconnect()
        fx.start.connect(int.filterBp)
      }
    },
    baseFreq: _ => int.freqParsChanged(),
    excursionOctaves: _ => int.freqParsChanged(),
    sweep: _ => fx.setSweep(value, true),
    envelope: nop,
    throttle: nop,
    linThrottle: nop,
    expThrottle: nop,
    resonance: _ => {
      int.filterPeaking.Q.value = value
      int.freqParsChanged()
    },
    sensitivity: _ => int._sensitivity = pow(10, value)
  }[key])
  
  window.envdebug = []
  window.envcnt = 0

  wahWahEFFx.construct = (fx, pars, {int, atm} = fx) => {
    int.filterFreqTimeout = 0
    
    const lazyLog = startEndThrottle(console.log, 200)
    
    const redraw = startEndThrottle(_ => fx.valueChanged('filterGraph'), 20)
    
    int.setFilterFreq = _ => {
      let freq
      try {
        freq = min(nyquist, atm.baseFreq + int._excursionFreq * atm.sweep)
        
        if (logOn) {
          wejectNaN(freq)
          const {baseFreq, sweep, sensitivity} = atm
          const {_excursionFreq} = int
          lazyLog({freq, baseFreq, _excursionFreq, sweep, sensitivity})
        }
        
        int.filterBp.frequency.value = freq
        int.filterPeaking.frequency.value = freq
      } catch (err) {
        console.error('setfiltfreq', err)
        clearTimeout(int.filterFreqTimeout)
        //put on the next cycle to let all init properties be set
        int.filterFreqTimeout = setTimeout(int.setFilterFeq, 0)
      }
      redraw()
    }
    
    int.freqParsChanged = _ => {
      int._excursionFreq = min(nyquist, atm.baseFreq * pow(2, atm.excursionOctaves))
      int.setFilterFreq()
    }
    
    fx.setSweep = (sweep, isManual = false) => {
      if (!isManual) { //: sweep is env as it comes from the envelopeFollower
        const throttledSweep = pow(sweep, 1 / atm.expThrottle) / atm.linThrottle
        fx.setValue('envelope', throttledSweep)
        fx.setValue('sweep', pow(clamp(throttledSweep, 0, 1), atm.sensitivity))
      }
      int.setFilterFreq()
    }
    
    int.envelopeFollower = newFx('fx_envelopeFollower', {initial: {
      masterFx: fx,
      callback: fx.setSweep
    }})
    
    int.filterBp = waCtx.createBiquadFilter()
    int.filterBp.type = 'bandpass'
    int.filterBp.Q.value = 1
    
    int.filterPeaking = waCtx.createBiquadFilter()
    int.filterPeaking.type = 'peaking'
    int.filterPeaking.gain.value = 20
    
    connectArr(fx.start, int.filterBp, int.filterPeaking, fx.output)

    fx.output.gain.value = 1
    fx.start.gain.value = 2
  }
  registerFxType('fx_wahWahEF', wahWahEFFx)
})
