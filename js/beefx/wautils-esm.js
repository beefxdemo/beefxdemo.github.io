/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, object-curly-spacing,
   quotes, no-void, no-return-assign, object-property-newline, object-curly-newline */

import {Corelib} from '../improxy-esm.js'

const {undef} = Corelib
const {AudioContext} = window

const onDomReady = _ => new Promise(resolve => document.getElementsByTagName('head').length
  ? resolve()
  : document.addEventListener('readystatechange', _ => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      resolve()
    }
  })
)

const verboseLogInit = false

const ilog = (...args) => verboseLogInit && console.log(...args)
const wlog = (...args) => console.warn(...args)
const elog = (...args) => console.error(...args)

const onError = err => {
  wau.ctxError = err
  elog(`Error, AudioContext:`, err, window.AudioContext)
  const {body} = document
  onDomReady().then(_ => body.setAttribute('error', (body.getAttribute('error') || '') + err))
}

export const wau = {
  waCtx: undef,
  callbacksOnStart: [],
  ctxError: '',
  ctxOk: false,
  ctxStateOk: false,
  checkState: _ => wau.ctxOk && (wau.ctxStateOk = wau.waCtx.state === 'running')
}

export const onReady = new Promise(resolve => wau.resolve = resolve)

export const onRun = cb => wau.waCtx?.state === 'running'
  ? cb(wau.waCtx)
  : wau.callbacksOnStart.push(cb)

void (_ => {
  AudioContext
    ? wau.waCtx = new AudioContext({sampleRate: 44100})
    : onError('Web Audio API is not supported by current browser.')

  if (wau.waCtx && typeof wau.waCtx.currentTime === 'number') {
    wau.createTime = wau.waCtx.currentTime
    wau.ctxOk = true
    ilog(`🔈 🔉 🔊 waCtx created as early as possible, state:`, wau.waCtx.state, wau.waCtx)

    //: It's a horrible yuck hack we are forced to do here in the name of Policy.
    if (wau.waCtx.state !== 'running') {
      wau.clicker = document.createElement('div')
      wau.clicker.className = 'clicker'
      wau.clicker.addEventListener('click', _ => wau.waCtx.resume())
      //div$(document.body, {class: 'clicker', click: _ => wau.waCtx.resume()})
      document.body.appendChild(wau.clicker)
    }
    wau.onReady = wau.waCtx.resume()

    wau.onReady.then(_ => {
      wau.resolve(wau.waCtx)

      void wau.clicker?.remove()
      wau.clicker = null
      for (const cb of wau.callbacksOnStart) {
        cb(wau.waCtx)
      }
    })
  } else {
    wlog(`🔈 🔉 🔊 couldn't get a valid AudioContext!`)
  }
})()
