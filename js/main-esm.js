/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import {DOMplusUltra, onWaapiReady, Playground} from './improxy-esm.js'

DOMplusUltra.onDomReady(async _ => {
  const config = {
    showEndSpectrums: false,
    presetDisplayOn: true,
    maxSources: 8
  }
  const root = {
    config,
    waCtx: await onWaapiReady,
    mediaElement: null
  }
  Playground.runPlayground(root)
})
