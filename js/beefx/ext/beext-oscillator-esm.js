/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {fetch} = window

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, getPresetPath, nowa, radioDef, createRadioCmds} = BeeFX(waCtx)
  
  const waveFormCmdsDef = {
    wfOff: radioDef('active', 'Off', 'off'),
    wfSine: radioDef('off', 'Sine', 'sine'),
    wfSquare: radioDef('off', 'Square', 'square'),
    wfSaw: radioDef('off', 'Sawtooth', 'sawtooth'),
    wfTri: radioDef('off', 'Triangle', 'triangle')
  }
  
  const oscillatorFx = { //8#b0c ------- oscillator with built-in WA-waveforms------
    def: {
      ...waveFormCmdsDef,
      waveForm: {defVal: 'off', skipUi: true},
      freqDisp: {defVal: '220#def', type: 'box'},
      on: {defVal: false, skipUi: true},
      frequency: {defVal: 220, min: 20, max: 22050, subType: 'exp', unit: 'Hz'},
      detune: {defVal: 100, min: 90, max: 110, unit: '%'}
    },
    midi: {pars: ['frequency']}
  }
  oscillatorFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    waveForm: _ => {
      fx.setValue('on', value !== 'off')
      value !== 'off' && fx.regen()
    },
    detune: _ => fx.setRealFreq(),
    frequency: _ => fx.setRealFreq(),
    on: _ => value ? fx.rebuild() : fx.destroy()
  }[key] || (_ => fx.cmdProc(value, key)))
  
  oscillatorFx.onActivated = (fx, isActive) => isActive ? fx.rebuild() : fx.destroy()

  oscillatorFx.construct = (fx, pars, {int, atm} = fx) => {
    const waveFormCmds = createRadioCmds(fx, waveFormCmdsDef)
    
    fx.setRealFreq = _ => {
      int.realFreq = Math.round(atm.frequency * atm.detune / 100)
      int.isValid && fx.setAt('oscillator', 'frequency', int.realFreq)
      fx.setValue('freqDisp', int.realFreq + '#mod')
    }
    
    fx.rebuild = _ => {
      if (fx.isActive) {
        if (!int.isValid) {
          int.isValid = true
          int.oscillator = waCtx.createOscillator()
          fx.setRealFreq()
          fx.regen()
          connectArr(int.oscillator, fx.output)
        }
        atm.on && fx.goLive()
      }
    }
    fx.destroy = _ => {
      if (int.isValid) {
        if (int.isLive) {
          int.oscillator.stop()
          int.isLive = false
        }
        int.oscillator.disconnect()
        delete int.oscillator
        int.isValid = false
      }
    }
    fx.goLive = _ => {
      if (!int.isLive) {
        int.oscillator.start()
        int.isLive = true
        fx.regen()
      } 
    }
    fx.regen = _ => {
      if (int.isValid) {
        int.oscillator.type = atm.waveForm
      }
    }
    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        waveFormCmds.check(mode, val => fx.setValue('waveForm', val))
      }
    }
    
    int.isValid = false
    int.isLive = false
  }
  registerFxType('fx_oscillator', oscillatorFx)

  const waveGeneratorFx = { //8#b09 ------- wave generator (8 sine waves) -------
    def: {
      on: {defVal: false, type: 'boolean'},
      frequency: {defVal: 220, min: 20, max: 22050, subType: 'exp', unit: 'Hz'},
      normalize: {defVal: true, type: 'boolean'},
      real: {defVal: 0, min: -1, max: 1, arrayIx: [0, 7], unit: 'sin'},
      imag: {defVal: 0, min: -1, max: 1, arrayIx: [0, 7], unit: 'cos'}
    }
  }
  waveGeneratorFx.setValue = (fx, key, value, {int} = fx) => ({
    real: _ => fx.regen(),
    imag: _ => fx.regen(),
    frequency: _ => int.isValid && fx.setAt('oscillator', 'frequency', value),
    normalize: _ => fx.regen(),
    on: _ => value ? fx.rebuild() : fx.destroy()
  }[key])

  waveGeneratorFx.onActivated = oscillatorFx.onActivated //: it's the same, we steal it

  waveGeneratorFx.construct = (fx, pars, {int, atm} = fx) => {
    fx.rebuild = _ => {
      if (fx.isActive) {
        if (!int.isValid) {
          int.isValid = true
          int.oscillator = waCtx.createOscillator()
          int.oscillator.frequency.value = atm.frequency
          fx.regen()
          connectArr(int.oscillator, fx.output)
        }
        atm.on && fx.goLive()
      }
    }
    fx.destroy = _ => {
      if (int.isValid) {
        if (int.isLive) {
          int.oscillator.stop()
          int.isLive = false
        }
        int.oscillator.disconnect()
        delete int.oscillator
        int.isValid = false
      }
    }
    fx.goLive = _ => {
      if (!int.isLive) {
        int.oscillator.start()
        int.isLive = true
        fx.regen()
      } 
    }
    fx.regen = _ => {
      if (int.isValid) {
        const real = new Float32Array([0, ...fx.getValueArray('real')])
        const imag = new Float32Array([0, ...fx.getValueArray('imag')])
        const wave = waCtx.createPeriodicWave(real, imag, {disableNormalization: !atm.normalize})
        int.oscillator.setPeriodicWave(wave)
      }
    }
    
    int.isValid = false
    int.isLive = false
  }
  registerFxType('fx_waveGenerator', waveGeneratorFx)
  
  const wavePresets = [ //: this collections is from mohayonao
    'Bass',
    'BassAmp360',
    'BassFuzz',
    'BassFuzz2',
    'BassSubDub',
    'BassSubDub2',
    'Brass',
    'BritBlues',
    'BritBluesDriven',
    'Buzzy1',
    'Buzzy2',
    'Celeste',
    'ChorusStrings',
    'Dissonant1',
    'Dissonant2',
    'DissonantPiano',
    'DroppedSaw',
    'DroppedSquare',
    'DynaEPBright',
    'DynaEPMed',
    'Ethnic33',
    'Full1',
    'Full2',
    'GuitarFuzz',
    'Harsh',
    'MklHard',
    'Noise',
    'Organ2',
    'Organ3',
    'PhonemeAh',
    'PhonemeBah',
    'PhonemeEe',
    'PhonemeO',
    'PhonemeOoh',
    'PhonemePopAhhhs',
    'Piano',
    'Pulse',
    'PutneyWavering',
    'Saw',
    'Square',
    'TB303Square',
    'Throaty',
    'Triangle',
    'Trombone',
    'TwelveOpTines',
    'TwelveStringGuitar1',
    'WarmSaw',
    'WarmSquare',
    'WarmTriangle',
    'Wurlitzer',
    'Wurlitzer2'
  ].map(a => a.map ? a : [a, a]).sort((a, b) => a[1] > b[1] ? 1 : -1)
  
  const waveTablePrefix = getPresetPath('wavetables/')
  
  const getFullWaveTablePath = conv => waveTablePrefix + conv + '.json'
  
  const loadWaveTable = (value, {onBufferReady}) => fetch(getFullWaveTablePath(value))
    .then(response => {
       if (!response.ok) {
         throw new Error("HTTP error, status = " + response.status)
       }
       return response.json()
     })
     .then(data => onBufferReady(data))
  
  const waveTablesFx = { //8#a69 ------- wave tables (predefined) -------
    def: {
      waveTable: {defVal: wavePresets[0][0], type: 'strings', size: 8, subType: wavePresets},
      on: {defVal: false, type: 'boolean'},
      frequency: {defVal: 220, min: 20, max: 22050, subType: 'exp', unit: 'Hz'},
      normalize: {defVal: true, type: 'boolean'}
    }
  }
  //: todo: add a piano to this
  
  waveTablesFx.setValue = (fx, key, value, {int} = fx) => ({
    waveTable: _ => loadWaveTable(value, int),
    frequency: _ => int.isValid && fx.setAt('oscillator', 'frequency', value),
    normalize: _ => fx.regen(),
    on: _ => value ? fx.rebuild() : fx.destroy()
  }[key])

  waveTablesFx.onActivated = oscillatorFx.onActivated //: it's the same, we steal it

  waveTablesFx.construct = (fx, pars, {int, atm} = fx) => {
    fx.rebuild = _ => {
      if (fx.isActive) {
        if (!int.isValid) {
          int.oscillator = waCtx.createOscillator()
          connectArr(int.oscillator, fx.output)
          int.isValid = true
        }
        atm.on && fx.goLive()
      }
    }
    fx.destroy = _ => {
      if (int.isValid) {
        if (int.isLive) {
          int.oscillator.stop()
          int.isLive = false
        }
        int.oscillator.disconnect()
        delete int.oscillator
        int.isValid = false
      }
    }
    fx.goLive = _ => {
      if (!int.isLive) {
        int.oscillator.start()
        int.isLive = true
        fx.regen()
      } 
    }
    fx.regen = _ => {
      if (int.isValid && int.real) {
        const real = new Float32Array([0, ...int.real])
        const imag = new Float32Array([0, ...int.imag])
        const wave = waCtx.createPeriodicWave(real, imag, {disableNormalization: !atm.normalize})
        int.oscillator.setPeriodicWave(wave)
      }
    }
    int.onBufferReady = data => {
      int.real = data.real
      int.imag = data.imag
      fx.regen()
    }
    
    int.isValid = false
    int.isLive = false
  }
  registerFxType('fx_waveTables', waveTablesFx)
  
  const createDCOffset = _ => {
    const buffer = waCtx.createBuffer(1, 1, waCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < 1; i++) {
      data[i] = 1
    }
    const bufferSource = waCtx.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.loop = true
    return bufferSource
  }
  
  const pwmOscillatorFx = { //8#b05 ------- PWM Oscillator (Chris Wilson) ------
    def: {
      on: {defVal: false, type: 'boolean'},
      frequency: {defVal: 220, min: 20, max: 22050, subType: 'exp', unit: 'Hz'},
      dutyCycle: {defVal: 50, min: 0, max: 100, unit: '%'}
    },
    name: 'Oscillator (PWM)'
  }
  pwmOscillatorFx.setValue = (fx, key, value, {int} = fx) => ({
    frequency: _ => fx.regen(),
    dutyCycle: _ => fx.regen(),
    on: _ => value ? fx.rebuild() : fx.destroy()
  }[key])
  
  pwmOscillatorFx.onActivated = oscillatorFx.onActivated //: it's the same, we steal it
  
  pwmOscillatorFx.construct = (fx, pars, {int, atm} = fx) => {
  /* Oscillator Fxs have extremely ugly constructors as Web Audio API is not able to restart
     an oscillator, so we have to destroy and rebuild everything every time the user clicks 
     the 'on' checkbox Also we have to restore the previous state.
       1. Luckily it's the same in init and restore, as BeeFx calls the constructor with 
       an already valid public state.
       2. Not so luckily that also means destroying and rebuilding other nodes too.
     It's like you had to destroy and recreate a Youtube player iframe every time
     the user clicks on the pause button. */
           
    fx.rebuild = _ => {
      if (fx.isActive) {
        if (!int.isValid) {
          int.osc1 = waCtx.createOscillator()
          int.osc2 = waCtx.createOscillator()
          int.osc1.type = 'sawtooth'
          int.osc2.type = 'sawtooth'
          int.osc1.frequency.value = atm.frequency
          int.osc2.frequency.value = atm.frequency
          
          int.inverter = waCtx.createGain()
          int.inverter.gain.value = -1
            
          int.delay = waCtx.createDelay()
          
          int.dcGain = waCtx.createGain()
          int.dcOffset = createDCOffset()
          
          connectArr(int.osc1, fx.output)
          connectArr(int.osc2, int.inverter, int.delay, fx.output)
          connectArr(int.dcOffset, int.dcGain, fx.output)
          int.isValid = true
        }
        atm.on && fx.goLive() //: restart LIVE only if the 'on' button is on
      }
    }
    fx.destroy = _ => {
      if (int.isValid) {
        if (int.isLive) {
          int.dcOffset.stop()
          int.osc1.stop()
          int.osc2.stop()
          int.isLive = false
        }
        int.osc1.disconnect()
        int.osc2.disconnect()
        int.inverter.disconnect()
        int.delay.disconnect()
        int.dcGain.disconnect()
        int.dcOffset.disconnect()
        delete int.osc1
        delete int.osc2
        delete int.inverter
        delete int.delay
        delete int.dcGain
        delete int.dcOffset
        int.isValid = false
      }
    }
    fx.goLive = _ => {
      if (!int.isLive) {
        const at = nowa(.05)
        int.dcOffset.start(at) 
        int.osc1.start(at) 
        int.osc2.start(at)
        int.isLive = true
        fx.regen()
      } 
    }
    
    int.isValid = false
    int.isLive = false
    
    fx.regen = _ => {
      if (int.isValid) {
        fx.setAt('osc1', 'frequency', atm.frequency)
        fx.setAt('osc2', 'frequency', atm.frequency)
        int.delay.delayTime.value = atm.dutyCycle / 100 / atm.frequency
        fx.setAt('dcGain', 'gain', 1.7 * (.5 - atm.dutyCycle / 100))
      }
    }
  }
  registerFxType('fx_pwmOscillator', pwmOscillatorFx)
})
