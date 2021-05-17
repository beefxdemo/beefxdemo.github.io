/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady, CT} from '../beeproxy-esm.js'

const {nop} = Corelib
const {wassert} = Corelib.Debug
const {schedule, startEndThrottle} = Corelib.Tardis
void startEndThrottle
void schedule
void wassert
void nop
void CT
const {round, abs, min} = Math

//: WobbleFx is a multifunctional interactive wobble effect.
//: It can manipulate the detune of a biquad filter of any type in the range of 3 octaves.
//: (Not every biquad filter type is meaningful here though.)
//: The LFO freq can go up to 100Hz (vrooming), but the really useful interval is 0-5 Hz.
//: The user can select a waveform.
//: (Later this needs to be connectable to an external source - like wavetable generator output.)
//: Also the LFO freq can be set from the source BPM for the effect being in sync with the tempo.
//: Sadly this is imperfect as WA won't support the phase control of an LFO (yet). 
//: So there is a reverse flag for a very rudimental setting.
//: Still, we won't get reproducable effect with this.
//: Possible solutions for the phase problem:
//: - https://github.com/Flarp/better-oscillator/blob/master/worklet.js
//:   (an oscillator with phase, but it uses CPU)
//: - a controllable delay after the lfoGain (with a slider between 0 and beatTime (0-360deg))
//: We implemented this second one. 
//: The effect is still varies (no perfect sync), but can be tweaked (you can hear it).
//: (Sidenote: BPM should have a phase too. And we have the peaks, so it's not 100% impossible.)
//: (The lesson learned here: we need an internal signal patch system apart from the stages.
//: E.g. the output of the generator effects should be labelled (or fix signal channels).
//: These signals must be accessible from any other Fx.)

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, radioDef, createRadioCmds, beeRAF} = BeeFX(waCtx)
  
  //: Waveform rendering is copied from the scope Fx.
  //: It uses simplified and modified rendering, also a custom zero crossing locator algorithm.
  
  const findFirstZeroCrossingUp = (data, width, step, reverse) => {
    for (let i = 0, preval = 0; i < width; i++) {
      const actval = data[round(i * step)] 
      const found = reverse
        ? preval && preval <= 128 && actval > 128
        : preval && preval >= 128 && actval < 128
      if (found) {
        return {frame: i * step, y: 1, msg: 'found'}
      }
      preval = actval
    }
    return {frame: 0, y: 2, msg: 'no up X'}
  }

  const drawCustomGraphFrame = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height, lfoScope, lfoFreqData} = int
    
    const drawXAxis = _ => {
      cc.clearRect(0, 0, width, height)
      cc.lineWidth = 2 * 2
      cc.strokeStyle = 'rgba(60,180,220,0.22)'
      cc.beginPath()
      cc.moveTo(0, height / 2)
      cc.lineTo(width, height / 2)
      cc.stroke()
      cc.fillStyle = `hsla(300, 50%, 50%, .15)`
      cc.fillRect(0, 0, min(width * atm.phaseDelay / .250, width), height)
    }
    
    const redrawFilters = val => {
      fx.setAt('dynFilter', 'detune', 7200 * (val - 128) / 256)
      fx.valueChanged('filterGraph')
    }
    
    const drawWaveform = _ => {
      lfoScope.getByteTimeDomainData(lfoFreqData)
      const flen = lfoFreqData.length
      redrawFilters(lfoFreqData[flen - 1])
      const zoom = (width * 1.5) / flen
      const step = 1 / zoom
      const foundObj = atm.lfoFreq < 8
        ? {frame: 0, y: 0, msg: '<8'}
        : findFirstZeroCrossingUp(lfoFreqData, width / 2, step, atm.sign === -1)  
      const frameIxFromZero = foundObj.frame || round(flen / 3) //: -> show the last part of it
      const scale = height / 256 / 1.05
      const centerY = height / 2
      
      cc.lineWidth = 2 * 2
      cc.strokeStyle = 'hsl(290, 80%, 85%)'
      cc.shadowColor = 'hsl(290, 100%, 70%)'
      cc.shadowBlur = 8
      cc.shadowOffsetX = 4
      cc.shadowOffsetY = 4
      cc.beginPath()
      cc.moveTo(0, centerY - (128 - lfoFreqData[frameIxFromZero]) * scale)
        
      let j = 0 //: outside for test/debug
      let frameIx = frameIxFromZero
      
      for (; frameIx < flen && j < width; frameIx += step, j++) {
        const magnitude = (128 - lfoFreqData[~~frameIx]) * scale
        cc.lineTo(j, centerY - magnitude)
      }
      cc.stroke()
      cc.font = '32px roboto condensed'
      ccext.setTextStyle('#aaa', 'right')
      cc.fillText(`250ms`, width - 20, 40)
      ccext.setTextStyle('#aaa', 'left')
      cc.fillText(`zero: ${round(frameIxFromZero)} ${foundObj.msg}`, 40, 40 + foundObj.y * 40)
    }
    if (cc) {
      drawXAxis()
      drawWaveform()
    }
    int.isRAFOn && beeRAF(_ => drawCustomGraphFrame(fx))
  }
  
  const beatCmdsDef = {
    beat1: radioDef('off', 'Beat', 1),
    beat2: radioDef('off', 'Bt 2', 2),
    beat4: radioDef('off', 'Bt 4', 4),
    beatH: radioDef('off', 'Bt /2', 1 / 2),
    beatQ: radioDef('off', 'Bt /4', 1 / 4),
    beatM: radioDef('active', 'Manual', 0)
  }
  const lfoTypeCmdsDef = {
    lfoSine: radioDef('active', 'Sine', 'sine'),
    lfoSquare: radioDef('off', 'Square', 'square'),
    lfoSaw: radioDef('off', 'Sawtooth', 'sawtooth'),
    lfoTri: radioDef('off', 'Triangle', 'triangle'),
    lfoExt: radioDef('off', 'Ext', 'ext')
  }
  const biquadTypeCmdsDef = {
    filtLowpass: radioDef('active', 'loPass', 'lowpass'),
    filtHighpass: radioDef('off', 'hiPass', 'highpass'),
    filtLowshelf: radioDef('off', 'loShelf', 'lowshelf'),
    filtHishelf: radioDef('off', 'hiShelf', 'highshelf'),
    filtBandpass: radioDef('off', 'bndPass', 'bandpass'),
    filtPeaking: radioDef('off', 'peak', 'peaking')
  }
  const filterModeCmdsDef = {
    statFilterMode: radioDef('active.ledon', 'Static graph', 'stat', {subType: 'led', color: 120}),
    dynFilterMode: radioDef('off', 'Dynamic graph (375ms lag)', 'dyn', {subType: 'led', color: 290})
  }
  const dynLag = .375
  
  const wobbleFx = { //8#b4f ------- wobble -------
    def: {
      bpm: {defVal: 333, skipUi: true}, //: internal, from listening to the source
      beatTime: {defVal: 60 / 333, skipUi: true}, //: internal, from bpm
      beatTimeMod: {defVal: 0, skipUi: true},
      bpmDisp: {defVal: '333#def', type: 'box', width: 24},
      ...beatCmdsDef,
      lfoLabel: {defVal: 'LFO:#label.ledon#0,0.5s', type: 'box', subType: 'led', cc: 'liteled', width: 24},
      ...lfoTypeCmdsDef,
      lfoType: {defVal: 'sine', skipUi: true}, //: only for state save/reload
      lfoFreq: {defVal: .5, min: .25, max: 100, subType: 'exp', unit: 'Hz', name: 'LFO freq'},
      phaseDeg: {defVal: 0, min: 0, max: 360, unit: 'deg', name: 'LFO phase'},
      phaseDelay: {defVal: 0, skipUi: true},
      phaseLabel: {defVal: 'Phase delay:#label', type: 'box', width: 62},
      phaseDisp: {defVal: '0 / 180ms#def', type: 'box', width: 80},
      reverse: {defVal: 'off', type: 'cmd', subType: 'led', name: 'Reverse'},
      sign: {defVal: 1, skipUi: true}, //: only for state save/reload
      syncPhase: {type: 'cmd', skipUi: true},
      lfoGraph: {type: 'graph'},
      excursion: {defVal: 600, min: 0, max: 3600, subType: 'int', unit: 'cent'},
      ...biquadTypeCmdsDef,
      filterGain: {defVal: 0, min: -40, max: 40, unit: 'dB'},
      filterQ: {defVal: 5, min: 0.001, max: 50, subType: 'exp'},
      filterFreq: {defVal: 500, min: 50, max: 5000, subType: 'exp', unit: 'Hz'},
      filterType: {defVal: 'lowpass', skipUi: true},
      filterGraph: {type: 'graph'},
      ...filterModeCmdsDef,
      filterMode: {defVal: 'stat', skipUi: true} //: only for state save/reload
    },
    midi: {pars: ['lfoFreq,phaseDeg', 'excursion,filterGain', 'filterFreq,filterQ']},
    listen: ['source.bpm:bpm', 'global.syncPhase:syncPhase']
  }
  const graphCommon = {
    graphType: 'freq',
    triggerKeys: ['filterGraph'],
    minDb: -27,
    maxDb: 33,
    freqMarginLeft: -10,
    diynamic: .8
  }
  wobbleFx.graphs = {
    filterGraph: [{
      ...graphCommon,
      filter: 'filter',
      customRenderer: {
        pre: ({fx, cc, ccext, freq}) => { //: no need for that - but we keep it as an example
          const lfoX = freq.freq2X[round(fx.atm.lfoFreq)] || 0
          cc.lineWidth = 5
          cc.strokeStyle = `hsl(150, 99%, 55%)`
          ccext.drawLine(lfoX, 0, lfoX, ccext.height)
        }
      },
      phaseCurveColor: `hsla(130, 99%, 75%, .5)`,
      magCurveColor: `hsl(130, 99%, 75%)`
    }, {
      ...graphCommon,
      filter: 'minModFilter',
      disableInThisFrame: fx => fx.atm.filterMode === 'dyn',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      phaseCurveColor: `hsla(240, 99%, 75%, .5)`,
      magCurveColor: `hsl(240, 99%, 75%)`
    }, {
      ...graphCommon,
      filter: 'maxModFilter',
      disableInThisFrame: fx => fx.atm.filterMode === 'dyn',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      phaseCurveColor: `hsla(40, 99%, 75%, .5)`,
      magCurveColor: `hsl(74, 99%, 75%)`
    }, {
      ...graphCommon,
      filter: 'dynFilter',
      disableInThisFrame: fx => fx.atm.filterMode !== 'dyn',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      phaseCurveColor: `hsla(290, 99%, 75%, .5)`,
      magCurveColor: `hsl(290, 99%, 75%)`
    }],
    lfoGraph: {
      graphType: 'custom',
      css: {width: '240px', height: '80px'},
      width: 600,
      height: 200,
      onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
    }
  }

  wobbleFx.setValue = (fx, key, value, {atm, int} = fx) => ({
    bpm: _ => {
      fx.setValue('bpmDisp', value + (value === fx.exo.def.bpm.defVal ? '#def' : '#set'))
      fx.setValue('beatTime', 60 / (value || 333))
    },
    beatTime: _ => fx.beatTimeChanged(),
    beatTimeMod: _ => fx.beatTimeChanged(),
    phaseDelay: _ => {
      fx.setDelayTime('phaseDelay', atm.phaseDelay)
      const str = `${round(atm.phaseDelay * 1000)} / ${round(int.realBeatTime * 1000)}ms`
      const mod = atm.bpm === fx.exo.def.bpm.defVal ? '#set' : '#mod'
      fx.setValue('phaseDisp', str + mod)
    },
    phaseDeg: _ => fx.recalcPhase(),
    sign: _ => fx.setValue('reverse', atm.sign === -1 ? 'active.ledon' : 'off'),
    lfoType: _ => value !== 'ext' && int.lfo && (int.lfo.type = value), //: no visuals (cmds done)
    lfoFreq: _ => fx.lfoFreqChanged(),
    excursion: _ => {
      fx.setAt('lfoGain', 'gain', value * atm.sign)
      fx.setAt('minModFilter', 'detune', -value * atm.sign)
      fx.setAt('maxModFilter', 'detune', value * atm.sign)
      fx.valueChanged('filterGraph')
    },
    filterType: _ => fx.modFilters(),
    filterGain: _ => fx.modFilters(),
    filterQ: _ => fx.modFilters(),
    filterFreq: _ => fx.modFilters(),
    filterMode: _ => fx.setDelayTime('lagger', value === 'dyn' ? dynLag : 0)
  }[key] || (_ => fx.cmdProc(value, key)))
  
  wobbleFx.onActivated = (fx, isActive) => isActive ? fx.startOsc() : fx.stopOsc()
  
  wobbleFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.isValid = false
    int.realBeatTime = atm.beatTime //: just for avoid div by zero at init
    int.lfoGain = waCtx.createGain()
    int.filter = waCtx.createBiquadFilter()
    int.filter.type = 'lowpass'
    int.minModFilter = waCtx.createBiquadFilter()
    int.minModFilter.type = 'lowpass'
    int.maxModFilter = waCtx.createBiquadFilter()
    int.maxModFilter.type = 'lowpass'
    int.dynFilter = waCtx.createBiquadFilter()
    int.dynFilter.type = 'lowpass'
    int.muting = waCtx.createGain()
    int.muting.gain.value = 0
    int.phaseDelay = waCtx.createDelay(5) //: 5 sec = min freq is .2 Hz
    int.attenuator = waCtx.createGain()
    int.attenuator.gain.value = 1 / exo.def.excursion.max
    int.lagger = waCtx.createDelay(5)
    int.lagger.delayTime.value = 0
    int.fftSize = 32768
    int.lfoScope = waCtx.createAnalyser()
    int.lfoScope.fftSize = int.fftSize
    int.lfoFreqData = new Uint8Array(int.lfoScope.frequencyBinCount) 
    //: lfo should bee the first (but only activation will create and connect it)
    connectArr(int.lfoGain, int.phaseDelay)
    connectArr(int.phaseDelay, int.filter.detune)
    connectArr(int.phaseDelay, int.attenuator, int.lfoScope)
    connectArr(fx.start, int.filter, int.lagger, fx.output)
    connectArr(fx.start, int.minModFilter, int.maxModFilter, int.dynFilter, int.muting, fx.output)
    
    const beatCmds = createRadioCmds(fx, beatCmdsDef)
    const lfoCmds = createRadioCmds(fx, lfoTypeCmdsDef)
    const biquadCmds = createRadioCmds(fx, biquadTypeCmdsDef)
    const filterModeCmds = createRadioCmds(fx, filterModeCmdsDef, {onVal: 'active.ledon'})
    
    fx.updateBeatCmds = _ => 
      beatCmds.evaluate((_, val) => val
       ? abs(int.realBeatTime / atm.beatTime / val - 1) < 0.01
         ? 'active'
         : abs(int.realBeatTime / atm.beatTime / val - 1) < 0.1
           ? 'on' 
           : 'off'
       : 'active')

    fx.recalcPhase = _ => fx.setValue('phaseDelay', atm.phaseDeg * int.realBeatTime / 360)
    
    //: This state change is a bit complicated as these two values depend on each other.
    
    fx.beatTimeChanged = _ => { //: atm.beatTime already set -> realBeatTime
      if (atm.beatTimeMod) {
        int.realBeatTime = atm.beatTime * atm.beatTimeMod
        
        const dbg = {}
        dbg.realBeatTime = int.realBeatTime
        dbg.beatTime = atm.beatTime
        dbg.beatTimeMod = atm.beatTimeMod
        
        int.stateChangeOrigin = 'beatTime'
        fx.setValue('lfoFreq', wassert(1 / int.realBeatTime)) //: setValue -> lfoFreqChanged
        int.stateChangeOrigin = ''
        
        //=ct.start        
        //:wassert(dbg.realBeatTime === int.realBeatTime)
        //:wassert(dbg.beatTime === atm.beatTime)
        //:wassert(dbg.beatTimeMod === atm.beatTimeMod)
        //:CT.ct.warn('BEATTIMECHANGED')
        //=ct.end
      } else {
        //: nothing to do if in manual mode
      }
    }
    
    fx.lfoFreqChanged = _ => { //: atm.lfoFreq already set -> realBeatTime
      //: two exceptions:
      //: - beatTime is the master setter, we just obey
      //: - there is a beatTimeMod bound defined
      if (int.stateChangeOrigin !== 'beatTime' || !atm.beatTimeMod) {
        atm.beatTimeMod = 0 //: so we set it to manual
        int.realBeatTime = 1 / atm.lfoFreq
      }  
      secureStateChange()
    }
    
    const secureStateChange = _ => { //: non-destructive aftermath of state change
      fx.updateBeatCmds()
      fx.recalcPhase()
      int.lfo && fx.setAt('lfo', 'frequency', atm.lfoFreq)
      fx.valueChanged('filterGraph') //: this is for the vertical LFO freq line
      fx.setValue('lfoLabel', `LFO:#label.ledon#290,${round(int.realBeatTime * 1000) / 1000}s`)
    }

    const quadFilterMod = (param, setat, mainVal, minVal = mainVal, maxVal = mainVal) => {
      if (setat) {
        fx.setAt('filter', param, mainVal)
        fx.setAt('minModFilter', param, minVal)
        fx.setAt('maxModFilter', param, maxVal)
        fx.setAt('dynFilter', param, mainVal)
      } else {
        int.filter[param] = mainVal
        int.minModFilter[param] = minVal
        int.maxModFilter[param] = maxVal
        int.dynFilter[param] = mainVal
      }
    }
    fx.modFilters = _ => {
      quadFilterMod('gain', true, atm.filterGain)
      quadFilterMod('frequency', true, atm.filterFreq)
      quadFilterMod('Q', true, atm.filterQ)
      quadFilterMod('type', false, atm.filterType)
      fx.valueChanged('filterGraph')
      //=ct.call wobble:postModFilters(fx) freq(10)
    }
    
    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        if (
          !beatCmds.check(mode, val => fx.setValue('beatTimeMod', val)) &&
          !lfoCmds.check(mode, val =>  fx.setValue('lfoType', val)) &&
          !biquadCmds.check(mode, val => fx.setValue('filterType', val)) &&
          !filterModeCmds.check(mode, val => fx.setValue('filterMode', val))
        ) {
          const action = {
            syncPhase: _ => {
              fx.stopOsc()
              fx.startOsc()
            },
            reverse: _ => {
              fx.setValue('sign', -atm.sign)
              fx.setValue('excursion') //: this will recalc the filter and redraw
            },
            statFreqGraph: _ => fx.setFilterGraphMode(false),
            dynFreqGraph: _ => fx.setFilterGraphMode(true)
          }[mode]
          void action?.()
        }
        //=ct.ins wobble:postFire
      }
    }
    fx.startOsc = _ => {
      if (!int.isValid) {
        int.isValid = true
        int.lfo = waCtx.createOscillator()
        int.lfo.type = atm.lfoType
        int.lfo.frequency.value = atm.lfoFreq
        int.lfo.connect(int.lfoGain)
        int.lfo.start()
        int.isRAFOn = true
        beeRAF(_ => drawCustomGraphFrame(fx))
      }
    }
    fx.stopOsc = _ => {
      if (int.isValid) {
        int.isValid = false
        int.isRAFOn = false
        int.lfo.disconnect(int.lfoGain)
        int.lfo.stop()
        delete int.lfo
      }
    }
  }
  
  registerFxType('fx_wobble', wobbleFx)
})
