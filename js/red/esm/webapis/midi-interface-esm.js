/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, indent, new-cap,
   object-curly-spacing, no-trailing-spaces, block-spacing, comma-spacing, handle-callback-err,
   no-return-assign, camelcase, yoda, object-property-newline, no-void, quotes, import/first,
   no-floating-decimal, space-unary-ops, prefer-promise-reject-errors */

//8#3ae4Midi control (Akai Midimix)

const undef = undefined

export const createInterface = onController => {
  const konfig = {
     sysex: true,
     searchDevice: 'MIDI Mix'
  }

  const midi = {
    initialized: false,
    access: undef,
    in: null,
    out: null    
  }
  
  const CONTROLCHANGE    = 0xB0//:b2=controller, b3=value
    
  const processAkaiMidiMix = event => {
    const status = event.data[0] & 0xF0
    const byte2 = event.data[1]
    const byte3 = event.data[2]

    if (status === CONTROLCHANGE) {
      let core = 0
      if (byte2 >= 16 && byte2 <= 31) {
        core = byte2 - 16
      } else if (byte2 >= 46 && byte2 <= 61) { 
        core = byte2 - 30
      } else if (byte2 === 62) {
        core = 35
      } else {
        console.log(`BAD controller msg:`, event.data)
      }
      
      const cc = ['hi', 'mid', 'lo', 'vol'][core & 3]
      const trak = (core >> 2) + 1
      onController(trak, cc, byte3)
    }
  }

  const setInputDevice = deviceName => {
    if (midi.access) {
      for (const [_, device] of midi.access.inputs) { // eslint-disable-line no-unused-vars
        if (device.name === deviceName) {
          midi.in = device
          midi.in.open()
          device.name === 'MIDI Mix' && (midi.in.onmidimessage = processAkaiMidiMix)
          console.log('device IN was set:', device)
        }
      }
    }
  }
  const setOutputDevice = deviceName => {
    if (midi.access) {
      for (const [_, device] of midi.access.outputs) { // eslint-disable-line no-unused-vars
        if (device.name === deviceName) {
          midi.out = device
          midi.out.open()
          console.log('device OUT was set:', device)
        }
      }
    }
  }

  midi.readyPromise = new Promise((resolve, reject) => {
    if (!navigator.requestMIDIAccess) {
      console.log('This browser does not support WebMIDI!')
      reject()
    }

    navigator.requestMIDIAccess({sysex: konfig.sysex})
      .then(midiAccess => {
        console.groupCollapsed('Initializing MIDI...')
        midi.access = midiAccess
        
        for (const [key, device] of midi.access.inputs) {
          console.log('IN:', {key, device})
          if (device.name.includes('MIDI Mix')) {
            setInputDevice(device.name)
            console.log('setInputDevice was called with', device.name)
            break
          }
        }
        for (const [key, device] of midi.access.outputs) {
          console.log('OUT:', {key, device})
          if (device.name.includes(konfig.searchDevice)) {
            setOutputDevice(device.name)
            console.log('setOutputDevice was called with', device.name)
            break
          }
        }
        console.groupEnd(`MIDI initialized.`)
        resolve()
      })
      .catch(error => console.error(error.message))
  })
  
  midi.init = _ => midi.readyPromise
  
  return midi
}
