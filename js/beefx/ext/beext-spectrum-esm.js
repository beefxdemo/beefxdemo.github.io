/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, undef} = Corelib
const {wassert} = Corelib.Debug //eslint-disable-line no-unused-vars

onWaapiReady.then(waCtx => {
  const {registerFxType, beeRAF} = BeeFX(waCtx)
  
  const logPerfOn = false
  const plog = (...args) => logPerfOn && console.log(...args)
  
  const drawFrame = fx => {
    const {int, atm} = fx
    const {cc, width, height, spectrum, freqData, ccext} = int
    
    const drawSpectrum = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      spectrum.getByteFrequencyData(freqData)
      const flen = freqData.length
      cc.clearRect(0, 0, width, height)
      
      const nyquist = waCtx.sampleRate / 2
      
      const drawFreqVertical = (hue, lite, freq) => {
        const freqbinPt = freq / nyquist
        const x = Math.pow(freqbinPt, 1 / atm.freqDyn) * width
        ccext.setLineStyle(`hsla(${hue}, 0%, 50%, .6)`, 3)
        ccext.drawLine(x, 0, x, (360 - hue) / 6)
      }
      
      drawFreqVertical(320, 55, 55)
      drawFreqVertical(280, 65, 110)
      drawFreqVertical(240, 75, 220)
      drawFreqVertical(200, 55, 440)
      drawFreqVertical(160, 50, 880)
      drawFreqVertical(120, 50, 1760)
      drawFreqVertical(80, 50, 3520)
      drawFreqVertical(40, 50, 7040)
      drawFreqVertical(0, 50, 14080)
      
      const mult = atm.laziness
      const div = atm.laziness + 1
      
      const db = []
      //const pixPerBin = width / flen
  
      for (let x = 0; x < width; x += 6) {//:Draw the frequency domain chart.
        const xpt = x / width
        const i = Math.round(flen * Math.pow(xpt, atm.freqDyn))
        const newValue = freqData[i]
        const oldValue = int.prevFreqData[i] || 0
        const value = Math.max(newValue, (newValue + oldValue * mult) / div)
        int.prevFreqData[i] = value
        const procPerc = i / flen * 50
        const sat = Math.round(100 - procPerc)
        const lit = Math.round(procPerc + 50)
        cc.beginPath()
        cc.strokeStyle = `hsl(0, ${sat}%, ${lit}%)`
        cc.lineWidth = 3
        cc.moveTo(x, height)
        cc.lineTo(x, height - height * value / 266)
        cc.stroke()
        db.push({i, x, procPerc, newValue, oldValue, color: `hsl(0, ${sat}%, ${lit}%)`})
      }
      
      timer.mark('stroke&text')
      if (logPerfOn) {
        const sum = timer.sum()
        int.prof.push(sum.dur.sum)
        if (int.prof.length % 110 === 105) {
          const last = int.prof.slice(-100).map(a => parseFloat(a))
          let agg = 0
          for (let i = 0; i < 100; i++) {
            agg += last[i]
          }
          agg = Math.round(agg * 10)
          plog(`###SPECTR avg: ${agg}ms **** `, int.prof.slice(-20).join(' / '))
        }
      }
    }
    if (cc) {
      drawSpectrum() //: refresh reducer!
    }
    int.isRAFOn && beeRAF(_ => drawFrame(fx))
  }

  const spectrumExt = { //8#48d ------- hi-res spectrum -------
    def: {
      laziness: {defVal: 0, min: 0, max: 5, subType: 'int'},
      freqDyn: {defVal: 2, min: 1, max: 2.5},
      spectrogram: {type: 'graph'}
    },
    name: 'Hi-res spectrum',
    graphs: {
      spectrogram: {
        graphType: 'custom',
        onInit: ({cc, ccext, width, height, fx}) => fx.int.capture({cc, ccext, width, height})
      }
    }
  }
  spectrumExt.setValue = (fx, key, value, {int} = fx) => ({
    laziness: nop,
    freqDyn: nop
  }[key])
  
  spectrumExt.onActivated = (fx, isActive) => isActive ? fx.startSpect() : fx.stopSpect()
  
  spectrumExt.construct = (fx, pars, {int} = fx) => {
    int.freqData = new Uint8Array(int.frequencyBinCount)
    int.prevFreqData = []
    int.isRAFOn = false
    int.prof = []
    
    int.spectrum = waCtx.createAnalyser()
    int.spectrum.minDecibels = -140
    int.spectrum.maxDecibels = 0
    int.spectrum.smoothingTimeConstant = 0
    int.spectrum.fftSize = 256
    int.freqData = new Uint8Array(int.spectrum.frequencyBinCount) //: fftSize / 2
    
    int.cc = undef    //: baseGraph fills these with onInit
    int.width = 600
    int.height = 300
    
    fx.start.connect(int.spectrum)
    fx.start.connect(fx.output)
    
    fx.startSpect = _ => {
      if (!int.isRAFOn) {
        int.isRAFOn = true
        beeRAF(_ => drawFrame(fx))
      }
    }
    fx.stopSpect = _ => int.isRAFOn = false
  }
  
  registerFxType('fx_spectrum', spectrumExt)
})
