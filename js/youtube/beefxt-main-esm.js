/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, space-unary-ops, valid-typeof,
   object-curly-spacing, object-curly-newline, object-property-newline, no-floating-decimal,
   handle-callback-err, quotes, yoda, no-void, import/first, standard/no-callback-literal */

import {Corelib, DOMplusUltra, onWaapiReady, Playground} from '../improxy-esm.js'

const {onDomReady, div$, q$, set$} = DOMplusUltra
const {adelay} = Corelib.Tardis

onDomReady(async _ => {
  console.log('CromBee beeFx/Youtube main started.')

  const config = {
    showEndSpectrums: false,
    maxSources: 4
  }
  const root = {
    config,
    waCtx: await onWaapiReady,
    mediaElement: null,
    onYoutube: true,
    killEmAll: false
  }

  const trigger$ = div$(document.body, {class: 'beetrigger', text: 'BeeeFX!'})

  const videoTagWaitingTick = _ => { //: Should continue if video not found? After 5-10s?
    const video = q$('video')
    if (video) {
      set$(trigger$, {class: 'hasvideo', click: event => {
        root.mediaElement = video
        root.killEmAll = event.shiftKey //: we'll remove most of Youtube if Shift was pressed
        Playground.runPlayground(root)
      }})
      console.log('CromBee found video tag:', video)
    } else {
      adelay(1000).then(videoTagWaitingTick)
      console.log(`CromBee didn't found video tag, will retry in 1s`)
    }
  }
  videoTagWaitingTick()
})
