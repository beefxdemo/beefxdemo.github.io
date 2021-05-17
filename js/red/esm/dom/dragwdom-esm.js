/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, object-curly-newline,
   standard/no-callback-literal */
   
//[Red]   

import * as Corelib from '../stdlib/corelib-esm.js'
import * as DOMplusUltra from './dom-plus-ultra-esm.js'

const {undef} = Corelib
const {wassert} = Corelib.Debug
const {NoW} = Corelib.Tardis
const {set$, haltEvent} = DOMplusUltra

const createDragWithDOM = _ => { 
  const ddrag = {
    dragOn: false,
    draggedSrc: undef,
    dragDst: undef,
    lastData: undef,
    dridHash: {}
  }
    
  const postDragStart = (event, src$, data) => {
    if (event.dataTransfer) {
      ddrag.dragOn = true
      ddrag.dropped = false
      ddrag.draggedSrc = src$
      ddrag.dragDst = undef
      ddrag.dragModDst = undef
      ddrag.lastMod = undef
      ddrag.draggedData = data
      set$(src$, {class: 'dragged'})
      event.dataTransfer.dropEffect = ddrag.dragType = event.shiftKey ? 'copy' : 'move'
      event.dataTransfer.effectAllowed = 'all'
      event.dataTransfer.setData('text/plain', data)
    }
  }  
  const postDragEnd = (event, src$) => {
    if (ddrag.dragOn) {
      ddrag.dragOn = false
      set$(src$, {declass: 'dragged'})
      ddrag.dragDst && set$(ddrag.dragDst, {declass: 'dragover'})
      ddrag.draggedSrc = undef
      ddrag.dragDst = undef
    }
  }
  const postDragEnter = (event, dst$, callback) => {
    const drid = wassert(dst$.getAttribute('drid'))
    ddrag.dridHash[drid] || (ddrag.dridHash[drid] = {})
    ddrag.dridHash[drid].lastDragEnterAt = NoW()
    const drmod = dst$.getAttribute('drmod')
    if (drmod) {
      ddrag.lastMod = drmod
      ddrag.dragModDst && set$(ddrag.dragModDst, {declass: 'dragovermod'})
      ddrag.dragModDst = dst$
      set$(dst$, {class: 'dragovermod'})
    } else {
      ddrag.dragDst && set$(ddrag.dragDst, {declass: 'dragover'})
      ddrag.dragDst = dst$
      set$(ddrag.dragDst, {class: 'dragover'})
    }
    haltEvent(event)
  }
  const postDragLeave = (event, dst$, callback) => {
    const drid = wassert(dst$.getAttribute('drid'))
    const drmod = dst$.getAttribute('drmod')
    if (NoW() - ddrag.dridHash[drid]?.lastDragEnterAt > 4) {
      if (drmod) {
        ddrag.lastMod = undef
        set$(dst$, {declass: 'dragovermod'})
        if (dst$ === ddrag.dragModDst) {
          ddrag.dragModDst = undef
        }
      } else if (!ddrag.lastMod) {
        set$(dst$, {declass: 'dragover'})
        if (dst$ === ddrag.dragDst) {
          ddrag.dragDst = undef
        }
      }
    }
  }
  const postDrop = (event, dst$, callback) => {
    if (!ddrag.dropped) {
      ddrag.dropped = true
      set$(dst$, {declass: 'dragover dragovermod'})
      callback(ddrag.draggedData, ddrag.lastMod, event)
    } else {
      console.warn('skip drop duplicate', event.target, event, dst$)
    }
  }
  
  const draggableHandler = (event, item$, data) => {
    event.type === 'dragstart' && postDragStart(event, item$, data)
    event.type === 'dragend' && postDragEnd(event, item$, data)
    if (event.type !== 'dragstart' && event.type !== 'drag') {
      haltEvent(event)      
      return false
    }
  }
  const dragTargetHandler = (event, item$, callback) => {
    event.type === 'dragenter' && postDragEnter(event, item$, callback)
    event.type === 'dragleave' && postDragLeave(event, item$, callback)
    event.type === 'drop' && postDrop(event, item$, callback)
    if (event.type !== 'drag') {
      haltEvent(event)      
      return false
    }
  }
  ddrag.addDraggable = (src$, data) => {
    set$(src$, {attr: {draggable: 'true'}, on: {
      dragstart: event => draggableHandler(event, src$, data),
      drag: event => draggableHandler(event, src$, data),
      dragend: event => draggableHandler(event, src$, data)
    }})
    return src$
  }
  ddrag.addDragTarget = (dst$, callback) => {
    set$(dst$, {on: {
      dragenter: event => dragTargetHandler(event, dst$, callback),
      dragover: event => dragTargetHandler(event, dst$, callback),
      dragleave: event => dragTargetHandler(event, dst$, callback),
      drop: event => dragTargetHandler(event, dst$, callback)
    }})
    return dst$
  }

  return ddrag
}

export const DragWithDOM = createDragWithDOM()
