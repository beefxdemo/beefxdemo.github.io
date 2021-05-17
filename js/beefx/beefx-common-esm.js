/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */

import {Corelib} from './beeproxy-esm.js'

const {clamp, isArr} = Corelib
const {wassert} = Corelib.Debug
const {round, pow, max} = Math

export const extendBeeFx = beeFx => { //8#c69 -------- BeeFX common helpers --------
  const {beeState, pepper, debug, waCtx} = beeFx
  
  beeFx.radioDef = (defVal, name, refVal, p = {}) => ({defVal, name, refVal, type: 'cmd', ...p})
  
  beeFx.createRadioCmds = (fx, robj, {onVal = 'active', offVal = 'off'} = {}) => {
    const radioCmds = {}
      
    radioCmds.evaluate = validator => {
      for (const key in robj) {
        fx.setValue(key, validator(key, robj[key].refVal))
      }
    }  
    radioCmds.validate = validator => 
      radioCmds.evaluate((key, val) => validator(key, val) ? onVal : offVal)

    radioCmds.check = (req, onFound) => {
      for (const key in robj) {
        if (key === req) {
          onFound(robj[key].refVal, key)
          radioCmds.validate(k => k === key)
          return true
        }
      }
      return false
    }
    return radioCmds
  }

  beeFx.concatAudioBuffers = (buf1, buf2) => {
    if (!buf1) {
      return buf2 
    }
    wassert(buf2)
    const {numberOfChannels} = buf1
    const tmp = waCtx.createBuffer(numberOfChannels, buf1.length + buf2.length, buf1.sampleRate)
  
    for (let i = 0; i < numberOfChannels; i++) {
      const data = tmp.getChannelData(i)
      data.set(buf1.getChannelData(i))
      data.set(buf2.getChannelData(i), buf1.length)
    }
    return tmp
  }
  
  beeFx.dB2Gain = db => max(0, round(1000 * pow(2, db / 6)) / 1000)
  
  beeFx.gain2dB = gain => clamp(round(Math.log2(gain) * 6 * 1000) / 1000, -60, 60)

  const delayedRAF = (renderer, delay = 0) => {
    window.requestAnimationFrame(_ => {
      delay ? delayedRAF(renderer, delay - 1) : renderer()
    })
  }
  beeFx.beeRAF = renderer => delayedRAF(renderer, beeState.redreshOn ? 1 : 0)
  
  beeFx.connectArr = (...arr) => { //: array item in arr: node + in/out index
    const arrarr = arr.map(item => isArr(item) ? item : [item])
    
    for (let ix = 0; ix < arrarr.length - 1; ix++) {
      arrarr[ix][0].connect(...arrarr[ix + 1])
    }
  }
  
  //8#e92------- Connect/disconnect override --------
    
  void (_ => { //: init only Once In A Lifetime
    const gain = waCtx.createGain()
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(gain)) //: From Tuna. I don't get it.
    const wauConnect = proto.connect
    const wauDisconnect = proto.disconnect
    proto.connect = shimConnect
    proto.disconnect = shimDisconnect
    let cc = 0
    let dc = 0

    function shimConnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      cc++
      beeFx.logConnects && console.log(`shimConnect`, {cc, from: this, to: arguments[0]})
      try {
        wauConnect.apply(this, arguments)
      } catch (err) {
        console.log(node, arguments)
        console.error(err)
        debugger
      }
      debug.addCon(this, arguments[0])
      return node
    }

    function shimDisconnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      dc++
      beeFx.logDisconnects && console.log(`shimDisconnect`, {dc, from: this, to: arguments[0]})
      try {
        wauDisconnect.apply(this, arguments)
      } catch (err) {
        console.log(node, arguments)
        console.error(err)
        debugger
      }
      debug.addDisco(this, arguments[0])
    }
  })()
}
