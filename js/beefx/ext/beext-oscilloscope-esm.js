/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, undef} = Corelib
const {round, pow} = Math
void undef

onWaapiReady.then(waCtx => {
  const {registerFxType, beeRAF} = BeeFX(waCtx)
  const {sampleRate} = waCtx
  
  const logOn = false
  const logPerfOn = false
  const clog = (...args) => logOn && console.log(...args)  
  const plog = (...args) => logPerfOn && console.log(...args)
  
  const findZeroCrossing = (data, width, sensitivity) => {
    const min = (sensitivity - 0) / 100 * 128 + 128
    let i = 0
    let last = -1
    while (i < width && (data[i] > 128)) {
      i++
    }
    if (i >= width) {
      return 0
    }
    let s
    while (i < width && ((s = data[i]) < min)) {
      last = s >= 128 
        ? last === -1
          ? i 
          : last 
        : -1
      i++
    }
    last = last < 0 ? i : last
    return i === width ? 0 : last
  }
  
  const drawFrame = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height, scope, freqData} = int
    const {sensitivity} = atm
    
    const drawGrid = _ => {
      cc.clearRect(0, 0, width, height)
      cc.font = '32px roboto condensed'
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(200, 70%, 55%, 0.1)'
      cc.beginPath()
      
      for (let i = 50; i < width; i += 50) {
        cc.moveTo(i, 0)
        cc.lineTo(i, height)
      }
      for (let j = 0; j < height; j += 50) {
        cc.moveTo(0, j)
        cc.lineTo(width, j)
      }
      cc.stroke()
    }
    
    const drawXAxis = _ => {
      cc.lineWidth = 2 * 2
      cc.strokeStyle = 'rgba(60,180,220,0.22)'
      cc.beginPath()
      cc.moveTo(0, height / 2)
      cc.lineTo(width, height / 2)
      cc.stroke()
    }
    
    const drawWaveform = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      const {zoom} = atm
      scope.getByteTimeDomainData(freqData)
      timer.mark('getdata')
      const findingZero = zoom > .2
      const frameIxFromZero = findingZero ? findZeroCrossing(freqData, width, sensitivity) : 0
      const flen = freqData.length
      const scale = height / 256 / 1.2
      const centerY = height / 2
      
      cc.lineWidth = 2.5 * 2
      cc.strokeStyle = 'hsl(0, 100%, 80%)'
      cc.shadowColor = 'hsl(0, 100%, 70%)'
      cc.shadowBlur = 8
      cc.shadowOffsetX = 4
      cc.shadowOffsetY = 4
      cc.beginPath()
      cc.moveTo(0, centerY - (128 - freqData[frameIxFromZero]) * scale)
      
      let version = parseInt(fx.zholger)
      if (version < 15) {
        version = '1.6'
      } else if (version < 30) {
        version = '1.2'
      } else {
        version = '.8'
      }
      version = 1.2
      const step = parseFloat(version)
        
      let j = 0 //: for test/debug
      let frameIx = frameIxFromZero
      let prevj = -1
      
      for (; frameIx < flen && j < width; frameIx++, j += zoom) {
        if (j - prevj > step) {
          const magnitude = (128 - freqData[frameIx]) * scale
          cc.lineTo(j, centerY - magnitude)
          prevj = j
        }
      }
      timer.mark('calc')
      cc.stroke()
      
      const txtx = width - 12
      const used = round(100 * (frameIx - frameIxFromZero) / flen)//: errrr...
      const ffts = int.fftSize + (int.fftSize === 32768 ? ' (max)' : '')
      const msec = round(1000 * (frameIx - frameIxFromZero) / sampleRate)
      const over = j < width ? (width - 1) / j * msec : 0
      const msecex = over ? ` (of ${round(over)}ms)` : ``
      ccext.setTextStyle('#aaa', 'right')
      cc.fillText(`FFT: ${used}% of ${ffts} used`, txtx, 40)
      cc.fillText(`${msec}ms${msecex}${findingZero ? ' Z' : ''}`, txtx, 80)

      if (!findingZero && j < width) {
        ccext.setTextStyle('hsl(180, 100%, 75%)', 'right')
        cc.fillText('FFT window too short!', txtx, height - 20)
      }
      
      if (logPerfOn) {
        timer.mark('stroke&text')
        const sum = timer.sum()
        int.prof.push(sum.dur.sum)
        if (version) {
          if (int.prof.length % 410 === 405) {
            const last = int.prof.slice(-400).map(a => parseFloat(a))
            let agg = 0
            for (let i = 0; i < 400; i++) {
              agg += last[i]
            }
            agg = round(agg * 2.5)
            plog(`##OSCP ${version} avg: ${agg}ms **** `, int.prof.slice(-20).join(' / '))
          }
        }
        parseInt(fx.zholger) === 7 && console.log(timer.summary())
      }
    }
    if (cc) {
      //const profile = startProfile()
      drawGrid()
      drawXAxis()
      drawWaveform()
      //profile.stop(fx, 'draw')
    }
    int.isRAFOn && beeRAF(_ => drawFrame(fx))
  }
  
  const actCmd = 'active' // 'on'

  const oscilloscopeExt = { //8#48d ------- oscilloscope (mostly after Chris Wilson) -------
    def: {
      sensitivity: {defVal: 50, min: 1, max: 100},
      zoom: {defVal: 1, min: .025, max: 2, subType: 'exp'},
      fullZoom: {defVal: 'off', type: 'cmd', name: 'Max'},
      halfZoom: {defVal: 'off', type: 'cmd', name: 'M/2'},
      quartZoom: {defVal: 'off', type: 'cmd', name: 'M/4'},
      beatZoom: {defVal: 'off', type: 'cmd', name: 'Beat'},
      beat2Zoom: {defVal: 'off', type: 'cmd', name: 'B/2'},
      resetZoom: {defVal: actCmd, type: 'cmd', name: 'Real-time'},
      freeze: {defVal: 'off', type: 'cmd', name: 'Freeze'},
      beatTime: {defVal: 60 / 333, skipUi: true},
      bpm: {defVal: 333, skpiUi: true}, //: bpm listener (used only to calc beatTime)
      scope: {type: 'graph'}
    },
    state: { //: experimental state save / load pilot proto test
      disableStandardState: false,
      save: fx => fx.int.extract('isRAFOn,beatZoomOn,beat2ZoomOn'),
      restore: (fx, state) => {
        state.isRAFOn ? fx.startOsc() : fx.stopOsc()
        fx.int.beatZoomOn = state.beatZoomOn
        fx.int.beat2ZoomOn = state.beat2ZoomOn
        fx.setValue('beatTime', fx.atm.beatTime)
      }
    },
    name: 'Scope',
    listen: ['source.bpm:bpm'], //: listen to source bpm changes
    graphs: {
      scope: {
        graphType: 'custom',
        onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
      }
    }
  }
  oscilloscopeExt.setValue = (fx, key, value, {int, atm, exo} = fx) => ({
    reset: nop, //: don't break saved projects, tmp
    bpm: _ => fx.setValue('beatTime', 60 / (value || 333)),
    beatTime: _ => fx.beatTimeChanged(),
    sensitivity: nop,
    zoom: _ => fx.resizeFFT(),
    fullZoom: _ => value === 'fire' && fx.setCmds('fullZoom', int.width / 16384),
    halfZoom: _ => value === 'fire' && fx.setCmds('halfZoom', int.width / 8192),
    quartZoom: _ => value === 'fire' && fx.setCmds('quartZoom', int.width / 4096),
    beatZoom: _ => value === 'fire' && fx.setCmds('beatZoom', int.beatZoom),
    beat2Zoom: _ => value === 'fire' && fx.setCmds('beat2Zoom', int.beat2Zoom),
    resetZoom: _ => value === 'fire' && fx.setCmds('resetZoom', 1),
    freeze: _ => value === 'fire' && (int.isRAFOn ? fx.stopOsc() : fx.startOsc())
  }[key])
  
  oscilloscopeExt.onActivated = (fx, isActive) => isActive ? fx.startOsc() : fx.stopOsc()
  
  oscilloscopeExt.construct = (fx, pars, {int, atm} = fx) => {
    int.prof = []
    int.width = 600   //: baseGraph fills it in onInit
    int.isRAFOn = false
    
    fx.beatTimeChanged = _ => {
      int.beatZoom = int.width / (sampleRate * atm.beatTime)
      int.beat2Zoom = int.width / (sampleRate * atm.beatTime / 2)
      int.beatZoomOn && fx.setValue('zoom', int.beatZoom)
      int.beat2ZoomOn && fx.setValue('zoom', int.beat2Zoom)
    }
    
    const regenFFTArray = fftSize => {
      if (fftSize !== int.fftSize) {
        int.fftSize = fftSize
        int.scope.fftSize = fftSize
        int.freqData = new Uint8Array(int.scope.frequencyBinCount) //: fftSize / 2
        clog(`Scope.regenFFTArray: FFT array resized with fftsize`, fftSize)
      }
    }
    
    int.scope = waCtx.createAnalyser()
    regenFFTArray(2048)
    
    fx.start.connect(int.scope)
    fx.start.connect(fx.output)
    
    fx.resizeFFT = _ => {
      const idealFFTSize = round(int.width / atm.zoom * 2 * pow(2, atm.zoom / 2))
      let found = 32768
      for (let fftSize = 256; fftSize < 32768; fftSize *= 2) {
        if (fftSize > idealFFTSize) {
          found = fftSize
          break
        }
      }
      clog(`Scope.resizeFFT: actual fft reqs recalculated:`, {zoom: atm.zoom.toFixed(3), idealFFTSize, oldFFT: int.fftSize, newFFT: found, width: int.width})
      regenFFTArray(found)
    }
    
    fx.startOsc = _ => {
      if (!int.isRAFOn) {
        int.isRAFOn = true
        beeRAF(_ => drawFrame(fx))
        fx.setValue('freeze', 'off')
      }
    }
    fx.stopOsc = _ => {
      int.isRAFOn = false
      fx.setValue('freeze', actCmd)
    }
    
    fx.setCmds = (act, newZoomVal) => {
      fx.setValue('zoom', newZoomVal)
      fx.setValue('fullZoom', act === 'fullZoom' ? actCmd : 'off')
      fx.setValue('halfZoom', act === 'halfZoom' ? actCmd : 'off')
      fx.setValue('quartZoom', act === 'quartZoom' ? actCmd : 'off')
      fx.setValue('beatZoom', act === 'beatZoom' ? actCmd : 'off')
      fx.setValue('beat2Zoom', act === 'beat2Zoom' ? actCmd : 'off')
      fx.setValue('resetZoom', atm.zoom === 1 ? actCmd : 'off')
      int.beatZoomOn = act === 'beatZoom'
      int.beat2ZoomOn = act === 'beat2Zoom'
    }
  }
  
  registerFxType('fx_oscilloscope', oscilloscopeExt)
})
