/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
/* globals globalThis */ /* ESLINT is still in 1983 */ 

const {AudioWorkletProcessor, registerProcessor} = globalThis

//: This audioWorklet was intended to replace the scriptNodeProcessor in the main thread.
//: As this worklet runs in a separate thred, we should get better performance with it.
//: However, the scriptProcessor version is a bit faster.
//: The main reason for this probably is that we send the audio to the main process while
//: recording, although bundled, after we collected enough frames (can be set as param).
//: So we make an extra round of unneccessary copying, still, it should be much faster.
//: (Unfortunately I could find only near zero examples and docs on audioWorklets.)
//: (So it still has lots of debug/log lines.)

const maxChannel = 2
//: This Recorder will record always in stereo as the Web Audio API calls our process
//: with mono/stereo/undef inputs and we don't want to follow these changes with our
//: data structures as they must be quite fixed if we don't want to make lots of extra
//: copying thanks to audioWorklet's very restricted transfer mechanism.
//: So if mono input comes, we copy it into both channels.

class Recorder extends AudioWorkletProcessor {
  static get parameterDescriptors () {
    return []
  }

  constructor () {
    super()
    this.isRecording = false
    this.compactZoom = 128
    this.frameLimit = 5120
    this.transferCompact = true
    this.transferAudio = false
    this.gotParams = false
    this.data = {
      frames: 0,            //: frames collected (and unsent)
      channels: maxChannel, //: always 2
      channelData: []
    }
    console.log('Recorder constructor called.')
    this.resetData()
    
    this.port.onmessage = ({data}) => {
      if (data.op === 'rec') {
        if (!this.gotParams) {
          console.error(`Cannot start recording without params!`)
          debugger
          return
        }
        this.isRecording = true
        this.hasNoInput = false
      } else if (data.op === 'stop') {
        this.isRecording = false
      } else if (data.op === 'params') {
        this.noRecording = true
        this.flushFrames()         //: usually this doesn't happen while recording, but...
        this.compactZoom = data.params.compactZoom
        this.frameLimit = data.params.frameLimit
        this.transferCompact = data.params.transferCompact
        this.transferAudio = data.params.transferAudio
        this.debug = data.params.debug
        this.resetData()
        this.gotParams = true
        this.noRecording = false
      }
    }
  }
  
  resetData () {
    if (!this.frameLimit) {
      console.error(`No frameLimit defined for recording!`)
      debugger
      this.frameLimit = 5120 //: prevent bigger trouble for a few secs
    } 
    for (let ch = 0; ch < this.data.channels; ch++) {
      this.data.channelData[ch] = new Float32Array(this.frameLimit)
    } 
    this.data.frames = 0  
  }

  flushFrames () {
    const {frames, channels, channelData} = this.data
    if (!frames) {
      return
    }
    if (this.transferAudio) {
      if (frames !== this.frameLimit) { //: this happens only at the end of the recording
        for (let ch = 0; ch < channels; ch++) {
          channelData[ch] = channelData[ch].slice(0, frames)
        }
      }
      this.port.postMessage({op: 'audio', channels, frames, channelData}, 
        channelData.map(arr => arr.buffer))
    }
    //: transferCompact mode is not used any more, this can be eliminated.
    if (this.transferCompact) { //: we send only sampled first channel data for the graph
      const chData = channelData[0]
      const compactLen = frames / this.compactZoom
      const off1 = this.compactZoom / 4
      const off2 = 2 * off1
      const off3 = off1 + off2
      const up = new Float32Array(compactLen)
      for (let fr = 0, x = 0; x < compactLen; x++, fr += this.compactZoom) {
        up[x] = (chData[fr] + chData[fr + off1] + chData[fr + off2] + chData[fr + off3]) / 4
      }
      this.port.postMessage({op: 'compact', channels, frames, up}, [up.buffer])
    }
    this.resetData()
  }
  
  flushFramesIfFull () {
    if (this.data.frames >= this.frameLimit) {
      this.flushFrames()
    }
  }

  process (inputs, outputs, parameters) {
    if (this.isRecording && !this.noRecording) {
      if (!inputs.length || !inputs[0].length) {  //: hacking the "audioWorklet"
        if (!this.hasNoInput) {
          this.hasNoInput = true
          console.warn('Recorder worklet: process got no input. (????)')
          this.port.postMessage({op: 'error', msg: 'no input'})
        }
        return true
      }
      const input = inputs[0]
      if (this.data.frames + input[0].length > this.frameLimit) { //: in theory it's impossible
        console.warn('Recorder worklet: buffer overflow!', this.data)
        return true
      }
      for (let ch = 0; ch < 2; ch++) {
        this.data.channelData[ch].set(input[ch >= input.length ? 0 : ch], this.data.frames)
      }
      //this.data.channels = input.length //: we won't change it, keeping it stereo
      this.data.frames += input[0].length
      this.flushFramesIfFull()
    } else {
      this.data.frames && this.flushFrames()
    }
    return true
  }
}

registerProcessor('Recorder', Recorder)
