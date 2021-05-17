/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady, BPM} from '../beeproxy-esm.js'

const {nop, clamp} = Corelib
const {wassert, weject} = Corelib.Debug // eslint-disable-line
const {post, schedule} = Corelib.Tardis
const {max, round, floor} = Math
const {AudioWorkletNode, requestAnimationFrame: RAF} = window

onWaapiReady.then(waCtx => {
  const beeFx = BeeFX(waCtx)
  const {registerFxType, connectArr, concatAudioBuffers, getJsPath, nowa} = beeFx
  const {radioDef, createRadioCmds} = beeFx
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  //: Off and on AudioWorklets are subject of unsolicited caching.
  //: Even full reload or 'Disable cache' in devtools network tab won't help.
  //: Also they are not shown at all in the devtools network tab which is extra helpful.
  //: The only thing that worked here is to add some garbage to the end of the filename :-((
  //: (This method isn't foolproof, but we still can pray for the reload. ymmv.)
  
  const auWorkletPromise = waCtx.audioWorklet.addModule(getJsPath('beefx/ext/recorderWorker.js?d'))

  auWorkletPromise
    .then(_ => console.log(`Recorder audioWorklet loaded.`))
    .catch(err => console.error(`Recorder audioWorklet failed to load.`, err))
  
  const drawBpmDia = fx => {
    const {int} = fx
    if (!int.bpmDia) {
      return
    }
    const {cc, ccext, width, height} = int.bpmDia
    cc.clearRect(0, 0, width, height)
    cc.lineWidth = 2
    
    if (int.inBpm) {
      return
    }
    let maxCount = 0
    
    for (const {count} of int.groups) {
      maxCount = max(maxCount, count)
    }
    const xScale = width / 4 / maxCount
    
    const drawBpmRect = (bpmMin, bpmMax, left, right, {toLeft}) => {
      const top = 12
      const bottom = height - 1
      const hi = bottom - top
      const wi = right - left
      const yScale = hi / (bpmMax - bpmMin)
      const align = toLeft ? 'right' : 'left'
      const alignMod = toLeft ? 10 : -10

      cc.font = '400 12px roboto condensed'
      cc.lineWidth = .5
      cc.strokeStyle = '#fff'
      toLeft
        ? ccext.drawLine(left, top, left, bottom)
        : ccext.drawLine(right, top, right, bottom)
      
      const bpmMinDec = ~~(bpmMin / 10) * 10
      const bpmMaxDec = ~~(bpmMax / 10) * 10
      
      for (let tempo = bpmMinDec; tempo <= bpmMaxDec; tempo += 10) {
        const y = bottom - (tempo - bpmMin) * yScale
        cc.strokeStyle = 'hsl(220, 50, 70%, .25)'
        ccext.drawLine(left + 1, y, right - 1, y)
        ccext.setTextStyle(tempo === bpmMaxDec || tempo === bpmMinDec ? '#fff' : '#ddd', align)
        toLeft
         ? cc.fillText(tempo, right - 3, y - 1)  
         : cc.fillText(tempo, left + 3, y - 1)  
      }
      
      cc.font = '700 13px roboto condensed'
      cc.lineWidth = 1.7

      for (const {tempo, count} of int.groups) {
        if (tempo >= bpmMin && tempo <= bpmMax) {
          const y = bottom - (tempo - bpmMin) * yScale
          const hue = tempo % 10
          cc.strokeStyle = cc.fillStyle = `hsl(${hue * 36}, 70%, 85%)`
          if (tempo === int.bpm || tempo === int.bpm2) {
            cc.fillText(tempo, left + wi / 2 + alignMod, y - 1)
          }
          toLeft
            ? ccext.drawLine(left + 1, y, left + count * xScale, y)
            : ccext.drawLine(right - 1, y, right - count * xScale, y)
        }
      }
    }

    drawBpmRect(45, 90, 0, width / 3 - 1, {toLeft: false})
    drawBpmRect(90, 180, width / 3 + 2, width * 2 / 3, {toLeft: true})
    drawBpmRect(75, 150, width * 2 / 3, width - 1, {toLeft: false})
  }
  
  const drawWaveOverview = fx => {
    const {int} = fx
    const {cc, ccext, width, height, disp, final, recorded} = int
    const {sampleRate} = waCtx
    if (!cc) {
      return
    }
    
    const sec2Pix = sec => (sec - disp.startRel) * sampleRate / disp.zoom
    
    const startx = sec2Pix(final.startRel)
    const midx = sec2Pix(final.startRel + final.len / 2)
    const endx = sec2Pix(final.endRel)
    
    const hasBpm = int.peaks?.length
    
    const drawRecIndicator = _ => {
      if (int.mode === 'modeRecord') {
        const timeFrac = (nowa() * 1000) % 1000
        if (timeFrac > 450) {
          cc.beginPath()
          cc.arc(width - 30, 30, 12, 0, 2 * Math.PI, false)
          cc.fillStyle = int.inBpm ? '#e40' : '#e00'
          cc.fill()
          cc.stroke()
        }
      }
    }
    const drawGrid = _ => {
      cc.clearRect(0, 0, width, height)
      cc.font = '700 32px roboto condensed'
      const pixPerSec = sec2Pix(1) - sec2Pix(0)
      if (pixPerSec > 150) {
        cc.lineWidth = 2
        cc.strokeStyle = hasBpm ? 'hsla(200, 70%, 50%, 0.4)' : 'hsla(200, 70%, 50%, 0.6)'
        for (let sec = floor(disp.startRel); sec < floor(disp.endRel) + 1; sec += .1) {
          const secX = sec2Pix(sec)
          ccext.drawLine(secX, 0, secX, height)
        }
      }
      cc.lineWidth = 3
      cc.strokeStyle = hasBpm ? 'hsla(200, 70%, 50%, 0.6)' : 'hsla(200, 70%, 50%, 0.8)'
      for (let sec = floor(disp.startRel); sec < floor(disp.endRel) + 1; sec++) {
        const secX = sec2Pix(sec)
        ccext.drawLine(secX, 0, secX, height)
      }
      cc.lineWidth = 5
      cc.strokeStyle = 'hsla(70, 70%, 65%, 0.8)'
      ccext.drawLine(startx, 0, startx, height)
      cc.strokeStyle = 'hsla(330, 70%, 65%, 0.8)'
      ccext.drawLine(endx, 0, endx, height)
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(25, 70%, 65%, 0.8)'
      ccext.drawLine(midx, 0, midx, height)
      drawRecIndicator()
      if (int.bpmMsg) {
        ccext.setTextStyle('#eee', 'left')
        cc.fillText(`BPM: ${int.bpmMsg}`, 20, 40)
        ccext.setTextStyle('#eee', 'left')
        cc.fillText(`${round(int.inBpmSec)}s`, 20, 80)
      }
      if (int.isRecorder || int.isBpm || int.isSampler) {
        cc.font = '400 32px roboto condensed'
        const maxSec = recorded.len || 0
        const mem = round(maxSec * sampleRate * 2 * 2 / 1024 / 1024 * 10) / 10
        ccext.setTextStyle('#aaf', 'right')
        cc.fillText(`Length: ${maxSec.toFixed(1)}s`, width - 12, 40) // height - 50)
        cc.fillText(`Mem: ${mem}MB`, width - 12, 80) //height - 18)
      }
    }
    
    const drawWave = _ => {
      const scale = hasBpm ? height / 3 : height / 2
      const centerY = height / 2
      const data = int.audioBuffer.getChannelData(0)
      
      cc.lineWidth = 2.5
      cc.strokeStyle = hasBpm 
        ? `hsl(${clamp(int.inBpmSec * 5 - 30, 0, 140)}, 75%, 60%)` 
        : int.isBpm
          ? 'hsl(200, 100%, 84%)'
          : 'hsl(35, 100%, 80%)'
      cc.beginPath()
      
      let frameIx = disp.startRel * sampleRate
      const maxFrame = disp.endRel * sampleRate
      
      cc.moveTo(0, centerY - data[round(frameIx)] * scale)
      const step = hasBpm ? 1 / (2.4 + Math.random() / 5) : 1 / (2 + Math.random())
      const startX = hasBpm ? .4 + Math.random() / 5 : Math.random() / 2
      const fstep = disp.zoom * step
      
      for (let x = startX; frameIx < maxFrame && x < width; x += step, frameIx += fstep) {
        const magnitude = data[round(frameIx)] * scale
        cc.lineTo(x, centerY - magnitude)
      }
      cc.stroke()

      if (hasBpm) {
        const frameStart = disp.startRel * sampleRate
        cc.strokeStyle = 'hsl(50, 100%, 90%)'
        for (const {position, volume} of int.peaks) {
          if (volume) {
            const x = (position - frameStart) / disp.zoom
            const vol = Math.pow(volume, .5)
            cc.lineWidth = 1 + 2 * vol
            ccext.drawLine(x, height, x, height - height * vol / 4) 
          }
        }
      }
    }
    
    if (cc) {
      if (int.audioBuffer) {
        drawGrid()
        drawWave()
      }
    }
    int.isRAFOn && RAF(_ => drawWaveOverview(fx))
  }
  
  const createRecorderVariant = (variant, {usePitchShift = false} = {}) => {
    const isSampler = variant === 'sampler'
    const isRecorder = variant === 'recorder' // eslint-disable-line no-unused-vars
    const isBpm = variant === 'bpm'
    const fxName = isBpm
      ? `BPM detector`
      : isRecorder
        ? `Recorder`
        : `Sampler` + (usePitchShift ? ' (note)' : '')
    const sampName = isSampler ? 'Sampler' : isRecorder ? 'Stop' : 'Playback'
    
    const beatCmdsDef = {
      beat1: radioDef('off', 'Beat', 1),
      beat2: radioDef('off', 'Bt 2', 2),
      beat4: radioDef('off', 'Bt 4', 4),
      beat8: radioDef('off', 'Bt 8', 8),
      beat16: radioDef('off', 'Bt 16', 16),
      beatM: radioDef('active', 'Off', 0)
    }
    const ledCmd = (defVal, color) => ({defVal, type: 'cmd', subType: 'led', color})

    const recMultiExt = { //8#aa8 -------loop -------
      def: {
        log: {defVal: '-', type: 'info'},
        modeBypass: {...ledCmd('active.ledon', 140), name: 'Bypass'},
        modeRecord: {...ledCmd('on', 0), name: 'Record'},
        modeSampler: {...ledCmd('off', 180), name: sampName},
        useScriptProc: {...ledCmd('on', 15), cc: 'liteled', name: 'scriptProcessor (slow)'},
        useWorklet: {...ledCmd('off', 330), cc: 'liteled', name: 'audioWorklet (slow)'},
        wave: {type: 'graph'},
        ...(isSampler ? {
          trimLeft: {defVal: 'on', type: 'cmd', name: 'Trim left (1s)'},
          trimReset: {defVal: 'on', type: 'cmd', name: 'Reset'},
          trimRight: {defVal: 'on', type: 'cmd', name: 'Trim right (1s)'},
          startMod: {defVal: 0, min: -1, max: 1, unit: 's'},
          endMod: {defVal: 0, min: -1, max: 1, unit: 's'},
          bpm: {defVal: 333, skipUi: true},
          beatTime: {defVal: 60 / 333, skipUi: true},
          beatDisp: {defVal: '333 / 180ms#def', type: 'box', width: 64},
          ...beatCmdsDef,
          fixBeatMod: {defVal: 0, skipUi: true},
          samplePlay: {defVal: 'off', type: 'cmd', name: 'Play'},
          sampleLoop: {...ledCmd('off', 80), name: 'Loop sample'},
          sampleStop: {defVal: 'off', type: 'cmd', name: 'Stop loop'}
        } : {
          startMod: {defVal: 0, min: -1, max: 1, unit: 's', skipUi: true},
          endMod: {defVal: 0, min: -1, max: 1, unit: 's', skipUi: true}
        }),
        ...(isBpm ? {
          bpm10: {...ledCmd('on.ledoff', 20), name: 'BPM 10s'},
          bpm15: {...ledCmd('on.ledoff', 40), name: 'BPM 15s'},
          bpm25: {...ledCmd('on.ledoff', 95), name: 'BPM 25s'},
          bpmRec: {defVal: 'on', type: 'cmd', name: 'BPM this'},
          bpmGraph: {type: 'graph'}
        } : {}),
        ...(usePitchShift ? {piano: {defVal: 'Cm', type: 'piano'}} : {})
      },
      promises: isBpm ? [auWorkletPromise] : [], //: beeFx waits until this promise is resolved
      midi: {pars: isSampler ? ['startMod', 'endMod'] : []} ,
      listen: isSampler
        ? ['source.bpm:bpm', 'global.syncStartLoop:sampleLoop', 'global.syncStopLoop:sampleStop']
        : [],
      name: fxName,
      graphs: {
        wave: {
          graphType: 'custom',
          onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
        },
        bpmGraph: {
          graphType: 'custom',
          width: 240,
          height: 120, //: I hoped that this will solve the canvas-antialias issues, but nope.
          onInit: ({cc,  width, height, fx, ccext}) => fx.int.bpmDia = {cc, width, height, ccext}
        }
      }
    }

    recMultiExt.setValue = (fx, key, value, {atm, int} = fx) => ({
      log: nop,
      bpm: _ => {
        fx.setValue('beatTime', 60 / (value || 333))
        const mod = value === fx.exo.def.bpm.defVal ? '#def' : '#set'
        fx.setValue('beatDisp', `${value} / ${round(atm.beatTime * 1000)}ms` + mod)
      },
      beatTime: _ => fx.recalcMarkers(),
      fixBeatMod: _ => fx.recalcMarkers(),
      startMod: _ => fx.recalcMarkers(),
      endMod: _ => fx.recalcMarkers(),
      piano: _ => fx.setTone(value)
    }[key] || (_ => fx.cmdProc(value, key))) //: all commands sent to cmdProc

    recMultiExt.onActivated = (fx, isActive) => isActive || fx.shutdownFx() //: cleanup!
    
    recMultiExt.construct = (fx, pars, {int, atm} = fx) => {
      const recorded = {}     //: this is the full recorded sample
      const trim = {}         //: trim from the start and the end (in theory it's reversible)
      const sample = {}       //: can be changed with trim
      const final = {}        //: sample modified with startMod/endMod (sliders)
      const disp = {}         //: graph display interval (sometimes we zoom)
      int.capture({final, disp, recorded}) //: as we will need these in the graph redraw
      int.capture({isSampler, isRecorder, isBpm})
      if (isSampler) {
        int.beatCmds = createRadioCmds(fx, beatCmdsDef)
      }
        
      const initFx = _ => {
        int.chMax = isBpm ? 2 : 2 //: Can be 1 for Bpm, more tests needed.
        int.isRAFOn = false
        int.detune = 0
        int.useScriptProcessor = false
        int.procFrames = 4096
        int.muteInputOn = true    //: so the next line will have a real effect
        muteInput(false)
        setMainMode('modeBypass')
        setScriptProcMode(int.useScriptProcessor)

        int.maxRunningLength = 6
        int.isLoopPlaying = false
        int.aubLength = 0
        int.sampleStored = false //: not used yet
        resetMarkers()
      }
      const resetMarkers = _ => { //: called at the start of a recording segment
        recorded.startAt = recorded.endAt = nowa()
        trim.left = trim.right = 0
      }
      const muteInput = on => { //: we have two states: 'audio pass through' / 'sampler as source'
        if (int.muteInputOn !== on) {
          int.muteInputOn = on
          on ? fx.start.disconnect(fx.output) : fx.start.connect(fx.output)
        }
      }
      const setRAF = on => {
        if (on && !int.isRAFOn) {
          RAF(_ => drawWaveOverview(fx)) //: could be called directly, but RAF gives a bit time gap
        }                         //: + this is called by onaudioprocess, better not touch the DOM
        int.isRAFOn = on
      }
      const relativize = interval => {
        interval.startRel = interval.startAt - recorded.startAt
        interval.endRel = interval.endAt - recorded.startAt
        interval.len = interval.endAt - interval.startAt
      }
      fx.recalcMarkers = _ => {
        recorded.len = recorded.endAt - recorded.startAt
        const isInRec = int.mode === 'modeRecord'
        if (isInRec) {
          const padding = clamp(recorded.len / 20, .01, 1)
          sample.startAt = recorded.startAt + padding
          sample.endAt = recorded.endAt - padding
        } else {
          sample.startAt = recorded.startAt + .0 + trim.left
          sample.endAt = max(recorded.endAt - .0 - trim.right, sample.startAt + .01)
        }
        relativize(sample)
        if (int.isBeatLoopModeOn) {
          wassert(atm.fixBeatMod)
          final.endAt = recorded.endAt
          final.startAt = final.endAt - atm.fixBeatMod * atm.beatTime
        } else {
          final.startAt = clamp(sample.startAt + atm.startMod, recorded.startAt, recorded.endAt)
          final.endAt = atm.fixBeatMod
            ? clamp(final.startAt + atm.beatTime * atm.fixBeatMod, 0, recorded.endAt)
            : clamp(sample.endAt + atm.endMod, final.startAt + .01, recorded.endAt)
          }
        relativize(final)
        
        if (isInRec) {
          disp.startAt = max(recorded.startAt, recorded.endAt - int.maxRunningLength)
          disp.endAt = recorded.endAt
        } else {        
          const margin = isBpm ? 0 : clamp(final.len / 10, .1, 1)
          disp.startAt = final.startAt - margin
          disp.endAt = final.endAt + margin
        }
        relativize(disp)
        disp.frames = disp.len * waCtx.sampleRate
        disp.zoom = disp.frames / int.width

        setRAF(true)
        post(updateLog) //: we can be in onaudioprocess, so we'll post it (not sure this works...)
        int.trimmable = int.mode === 'modeSampler' && sample.len > 2
        if (int.mode === 'modeSampler') { //: we cannot be in audioprocess if in sampler mode
          if (isSampler) {
            fx.setValue('trimLeft', int.trimmable ? 'on' : 'off')
            fx.setValue('trimRight', int.trimmable ? 'on' : 'off')
          }
        }
        if (isBpm) {
          if (recorded.len > 5 && !int.inBpm) {
            if (atm.bpmRec !== 'on') {
              post(_ => fx.setValue('bpmRec', 'on'))
            }
          } else {
            if (atm.bpmRec === 'on') {
              post(_ => fx.setValue('bpmRec', 'off'))
            }
          }
        }
      }
      const updateLog = _ => {
        const fix = v => round(v * 100) / 100
        
        if (!recorded.len) {
          fx.setValue('log', `No sample recorded.<br>Sample: - Final: -`)
        } else {
          const recTime = `Recorded/Sample/Final: ${recorded.len.toFixed(3)}s / ${fix(sample.len)}s / ${fix(final.len)}s`
          const sampleTime = `Sample: ${fix(sample.startRel)}-${fix(sample.endRel)} `
          const finalTime = `Final: ${fix(final.startRel)}-${fix(final.endRel)} Tr[-${trim.left}, -${trim.right}]`
          
          fx.setValue('log', [recTime, sampleTime + finalTime].join('<br>'))
        }
      }

      const setScriptProcMode = (useScriptProcessor, isActive = false) => {
        int.useScriptProcessor = useScriptProcessor
        const act = isActive ? 'ledon' : 'ledoff'
        fx.setValue('useWorklet', useScriptProcessor ? 'off.ledoff' : 'on.' + act)
        fx.setValue('useScriptProc', useScriptProcessor ? 'on.' + act : 'off.ledoff')
      }
      const appendBuffer = (buffer, frames) => {
        int.audioBuffer = concatAudioBuffers(int.audioBuffer, buffer)
        int.aubLength += frames
        recorded.endAt = nowa()
        fx.recalcMarkers()
      }
      const setupRecorder = _ => { //: the output of both is int.audioBuffer / int.aubLength
        delete int.audioBuffer
        int.aubLength = 0
        setScriptProcMode(int.useScriptProcessor, true)

        if (int.useScriptProcessor) { //8#a43 Rec w/ ScriptProcessorNode. Slow, simple & deprecated.
          int.scriptNode = int.scriptNode || 
            waCtx.createScriptProcessor(int.procFrames, int.chMax, int.chMax)
          int.scriptNode.onaudioprocess = data => appendBuffer(data.inputBuffer, int.procFrames)
          //: should be checked whether it gives less clicks on the destination
          connectArr(fx.start, int.scriptNode, fx.output) //, waCtx.destination)
        } else {                      //8#43a Rec w/ AudioWorklet. Slow, complex & unstable.
          const pars = {outputChannelCount: [int.chMax]}
          int.recorder = int.recorder || new AudioWorkletNode(waCtx, 'Recorder', pars)
          int.recorder.port.onmessage = event => {
            const {data} = event
            if (data.op === 'audio') {
              const {frames, channels, channelData} = data
              const transBuff = waCtx.createBuffer(channels, frames, waCtx.sampleRate)
                
              for (let ch = 0; ch < channels; ch++) {
                transBuff.copyToChannel(channelData[ch], ch , 0)
              }
              appendBuffer(transBuff, frames)
            } else if (data.op === 'error') {
              exitRecordMode()
              //int.inBpm = false //: ...
              console.warn('Recorder got error from worklet:', data.msg, event)
            } else {
              console.warn('Recorder got invalid message from worklet:', event)
            }
          }
          fx.start.connect(int.recorder)
          const params = {
            frameLimit: int.procFrames, 
            transferCompact: false, 
            transferAudio: true,
            debug: fx.zholger
          }
          int.recorder.port.postMessage({op: 'params', params})
          int.recorder.port.postMessage({op: 'rec'})
        }
      }
      fx.shutdownRecorder = _ => {
        setScriptProcMode(int.useScriptProcessor, false)
        if (int.useScriptProcessor) {
          if (int.scriptNode) {
            int.scriptNode.onaudioprocess = null
            delete int.scriptNode
          }
        } else {
          if (int.recorder) {
            int.recorder.port.postMessage({op: 'stop'})
            delete int.recorder
          }
        }
      }
      fx.shutdownFx = _ => { //: if inactivated
        fx.shutdownRecorder()
        setMainMode('modeBypass')
        setRAF(false)
      }
      
      const updateMode = mode => {
        clog('enter ' + mode)
        int.mode = mode
        fx.setValue('modeBypass', 'on.ledoff')
        fx.setValue('modeRecord', 'on.ledoff')
        sample.len
          ? fx.setValue('modeSampler', 'on.ledoff')
          : fx.setValue('modeSampler', 'off.ledoff')
        fx.setValue(mode, 'active.ledon')
        setRAF(int.mode !== 'modeBypass')
        fx.recalcMarkers()
      }
      
      const enterBypassMode = _ => int.mode !== 'modeBypass' && updateMode('modeBypass')

      const exitBypassMode = _ => _
      
      const enterRecordMode = _ => {
        if (int.mode !== 'modeRecord') {
          setupRecorder()
          int.peaks = []
          if (isSampler) {
            fx.setValue('startMod', 0)
            fx.setValue('endMod', 0)
            fx.setValue('trimLeft', 'off')
            fx.setValue('trimRight', 'off')
            atm.fixBeatMod && fx.setValue('sampleLoop', 'active')
          }
          resetMarkers()
          updateMode('modeRecord')
        }
      }
      const exitRecordMode = _ => {
        if (int.mode === 'modeRecord') {
          int.inBpm = false
          fx.shutdownRecorder()
        }
      }

      const enterSamplerMode = _ => {
        if (int.mode !== 'modeSampler') {
          muteInput(true)
          if (isSampler) {
            fx.setValue('samplePlay', 'on')
            fx.setValue('sampleLoop', 'on')
            fx.setValue('sampleStop', 'on')
            fx.setValue('trimReset', 'on')
          }
          updateMode('modeSampler')
        }
      }
      const exitSamplerMode = _ => {
        if (int.mode === 'modeSampler') {
          muteInput(false)
          if (isSampler) {
            endPlayOnce()
            endPlayLoop()
            fx.setValue('samplePlay', 'off')
            fx.setValue('sampleLoop', 'off')
            fx.setValue('sampleStop', 'off')
            fx.setValue('trimReset', 'off')
          }
        }
      }
      
      const setMainMode = mode => {
        if (int.mode !== mode) {
          void (exitBypassMode(), exitRecordMode(), exitSamplerMode())
          mode === 'modeBypass' && enterBypassMode()
          mode === 'modeRecord' && enterRecordMode()
          mode === 'modeSampler' && enterSamplerMode()
        }
      }
      
      const markBpmCmds = _ => {
        for (const sec of [10, 15, 25]) {
          const cmd = 'bpm' + sec
          const val = int.inBpm
            ? int.inBpmSec === sec
              ? 'active.ledon' 
              : 'off.ledoff'
            : 'on.ledoff'
          fx.setValue(cmd, val)
        }
      }
      
      const detectBpmFromRecorded = async (calcSec = recorded.len) => {
        int.inBpm = false
        setMainMode('modeBypass')
        if (calcSec < 2) {
          int.bpmMsg = `Sample too short.`
          void int.bpmListener?.(false)
        } else {
          int.inBpmSec = calcSec
          int.bpmAuditor = int.bpmAuditor || BPM.createBPMAuditor(waCtx)
          const {candidates, error, peaks, groups} = await int.bpmAuditor.detect(int.audioBuffer)
          console.log({candidates, error, peaks}) //: we still need this, WIP
          const [cand1, cand2] = candidates || []
          const [tempo1 = 333, tempo2 = 333] = [cand1?.tempo, cand2?.tempo]
          const [count1 = 0, count2 = 0] = [cand1?.count, cand2?.count]
          const bpm = tempo1
          if  (bpm > 55 && bpm < 200 && candidates?.length > 1) {
            int.bpm = int.bpmMsg = bpm 
            int.bpm2 = 0
            const trust = count1 / (count1 + count2)
            let bpmStr = bpm
            if (bpm < 90) {
              let maxCount = 1 // count1 / 10
              let actDupTempo = 0
              for (const {tempo, count} of candidates) {
                if (Math.abs(tempo - bpm * 2) < 2 && count > maxCount) {
                  maxCount = count
                  actDupTempo = tempo
                }
              }
              if (actDupTempo) {
                bpmStr += ` / ${actDupTempo}`
                int.bpm2 = actDupTempo
              }
            }
            int.bpmMsg = `${bpmStr} (${round(100 * trust)}%)`
            count1 < count2 * 3 && (int.bpmMsg += ` / ${tempo2}`)
            void int.bpmListener?.(true)
          } else {
            int.bpmMsg = `Detection failed.`
            void int.bpmListener?.(false)
          }
          int.peaks = peaks
          int.groups = groups
          drawBpmDia(fx)
        }
      }
      
      const startBpmDetector = calcSec => {
        if (!int.inBpm) {
          setMainMode('modeRecord')
          int.inBpmSec = calcSec
          int.inBpm = true
          int.bpmMsg = ''
          int.peaks = []
          int.bpm = 0
          markBpmCmds()
          drawBpmDia(fx)
          schedule(calcSec + 's').then(_ => {
            if (int.inBpm) {
              detectBpmFromRecorded(calcSec)
              markBpmCmds()
            }
          })
        } else {
          console.log(`Cannot start detection while detecting.`)
        }
      }
      
      fx.startPrivilegedBpmRequest = async calcSec => new Promise((resolve, reject) => {
        int.bpmListener = isOk => {
          isOk ? resolve(int.bpm2 || int.bpm) : reject(int.bpmMsg)
        delete int.bpmListener
        }
        startBpmDetector(calcSec)
      })

      fx.cmdProc = (fire, mode) => {
        if (fire === 'fire') {
          if (int.beatCmds?.check(mode, val => fx.setValue('fixBeatMod', val))) {
            return
          }
          const action = {
            modeBypass: _ => setMainMode(mode),
            modeRecord: _ => setMainMode(mode),
            modeSampler: _ => setMainMode(mode),
            trimLeft: _ => int.trimmable && trim.left++,
            trimRight: _ => int.trimmable && trim.right++,
            trimReset: _ => trim.left = trim.right = 0,
            samplePlay: _ => int.mode === 'modeSampler' && playOnce(),
            sampleLoop: _ => {
              if (int.mode === 'modeRecord' && atm.fixBeatMod) {
                setMainMode('modeSampler')
                // startmod = endmod - atm.,fixBeatMod * time
                startPlayLoop()
              } else {
                int.mode === 'modeSampler' && startPlayLoop()
              }
            },
            sampleStop: _ => int.mode === 'modeSampler' && endPlayLoop(),
            useScriptProc: _ => int.mode !== 'modeRecord' && setScriptProcMode(true),
            useWorklet: _ => int.mode !== 'modeRecord' && setScriptProcMode(false),
            bpm10: _ => startBpmDetector(10),
            bpm15: _ => startBpmDetector(15),
            bpm25: _ => startBpmDetector(25),
            bpmRec: _ => detectBpmFromRecorded()
          }[mode]
          void action?.()
          fx.recalcMarkers()
        }
      }
      
      const playOnce = _ => {
        if (int.mode === 'modeSampler') {
          int.singleSource = waCtx.createBufferSource()
          int.singleSource.buffer = int.audioBuffer
          int.singleSource.connect(fx.output)
          int.singleSource.detune.value = int.detune
          int.singleSource.start(0, final.startRel, final.len)
        }
      }
      const endPlayOnce = _ => int.singleSource?.stop()
      
      const startPlayLoop = _ => {
        if (int.mode === 'modeSampler' && !int.isLoopPlaying) {
          int.isLoopPlaying = true
          int.source = waCtx.createBufferSource()
          int.source.buffer = int.audioBuffer
          int.source.connect(fx.output)
          int.source.loop = true
          int.source.loopStart = final.startRel
          int.source.loopEnd = final.endRel
          int.source.start(0, final.startRel)
          fx.setValue('sampleLoop', 'active.ledon')
        } else {
          endPlayLoop()
          startPlayLoop() //: so this is a 'loopRestart'
        }
      }
      const endPlayLoop = _ => {
        int.isBeatLoopModeOn = false
        void (int.isLoopPlaying && int.source?.stop())
        int.isLoopPlaying = false
        fx.setValue('sampleLoop', 'on')
      }
      
      fx.setTone = tone => {      
        const val = 'abcdefghijklmnopqrstuvwxy'.indexOf(tone[1])
        int.tone = tone
        int.inOff = val
        int.detune = ((val - 12) / 12 || 0) * 100
        int.source && (int.source.detune.value = int.detune)
        int.isLoopPlaying || playOnce()
      }
      initFx()
    }
    return recMultiExt
  }
  registerFxType('fx_samplerNote', createRecorderVariant('sampler', {usePitchShift: true}))
  registerFxType('fx_sampler', createRecorderVariant('sampler', {usePitchShift: false}))
  registerFxType('fx_recorder', createRecorderVariant('recorder'))
  registerFxType('fx_bpm', createRecorderVariant('bpm'))
})
