/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */

import {Corelib} from './beeproxy-esm.js'

const {isFun, merge, nop} = Corelib
const {wassert} = Corelib.Debug
const {max} = Math

//8#936 ------------- Bee debug -> it'sd like Audion SE tailored to our needs. -------------

export const createBeeDebug = waCtx => {
  const {AudioWorkletNode, MediaElementAudioSourceNode, GainNode} = window
  const fxStageHash = {}
  const connections = {}
  const resMap = {}
  const conns = []
  const discos = []
  const zharr = []
  const debug = {
    checkSetAt: true,
    on: false,     //: must be turned off if not used as it interferes too much
    nuid: 2000
  }
  const auNStr = node => node.toString().split(' ')[1].slice(0, -1)
  
  const getResOf = node => node.__bee_res_id__ = node.__bee_res_id__ || node.__resource_id__ ||
    (node instanceof AudioWorkletNode
    ? 'AW.' + debug.nuid++
    : node instanceof MediaElementAudioSourceNode
      ? (node.__resource_id__ = debug.nuid++)
      : 'Unknown.' + debug.nuid++)
  
  const getGraphString = node => {
    const res = getResOf(node)
    return res + ' -> ' + (connections[res] || {}).propertiesToArr()
      .filter(a => a !== 'type').join(', ')
  }
  debug.table = tab => {
    const columns = {}
    for (const item of tab) {
      for (const key in item) {
        if (key !== 'isActive') {
          columns[key] = columns[key] || {maxlen: key.length}
          columns[key].maxlen = max(columns[key].maxlen, item[key].length)
        }
      }
    }
    for (const item of [0, ...tab]) {
      let line = ''
      for (const key in columns) {
        const str = item ? merge('', item[key]) : key
        line += ' | ' + str + ' '.repeat(columns[key].maxlen - str.length)
      }
      const letter = item.stage?.[0]
      const hue = {A: 130, B: 220, C: 280, D: 340, E: 60, F: 180, G: 250, H: 30}[letter] || 0
      const cols = item 
        ? line[4] === '_' 
          ? `color:#888;background:hsl(${hue}, 100%, 96%);`
          : `color:#000;background:hsl(${hue}, 100%, 91%);border-top: 3px solid #00c;`
        : 'color:#000;background:#fc9;'
      const act = item.isActive ? '' : 'font-style: italic; color: #bbb;'
      console.log(`%c${line}`, 'font: 400 11px hack;padding: 1px 0; margin: 0;' + cols + act)
    }
  }
  const getInsOuts = res => {
    const outs = connections[res]?.propertiesToArr().filter(a => a !== 'type').join(', ')
    const type = connections[res]?.type
    const inArr = []
    for (const key in connections) {
      const conns = connections[key]
      conns && conns.propertiesToArr().includes(res) && inArr.push(key)
    }
    return {ins: inArr.join(', '), outs, type}
  }
  debug.marks = _ => {
    const tab = []
    for (const res in resMap) {
      const mark = resMap[res]
      const {ins, outs, type} = getInsOuts(res)
      tab.push({res, mark, ins, outs, type})
    }
    console.table(tab)
  }
  debug.dump = msg => {
    msg && console.log(msg)
    const taa = []
    for (const fx of zharr) {
      const {isActive, zholger} = fx
      const stage = fxStageHash[zholger] || 'No stage!'
      const bItem = {
        fx,
        isActive,
        zh: (isActive ? `🔸` : '🔹') + zholger,
        zholger,
        stage,
        short: fx.getName(),
        in: getGraphString(fx.input),
        start: getGraphString(fx.start),
        id: '',
        out: getGraphString(fx.output)
      }
      taa.push(bItem)
    }
    taa.sort((a, b) => a.stage > b.stage ? 1 : -1)
    const tab = []
    for (const item of taa) {
      const {isActive, zholger, fx, stage} = item
      delete item.fx
      delete item.zholger
      tab.push(item)
    
      for (const int in fx.int) {
        const intern = fx.int[int]
        if (intern?.__bee_res_id__) {
          const extra = intern instanceof GainNode ? ` (${intern.gain.value.toFixed(3)})` : ''
          tab.push({
            isActive,
            zh: '__' + zholger,
            stage,
            short: '__' + auNStr(intern) + extra,
            id: getGraphString(intern)
          })
        }
      }
    }
    debug.table(tab)
    debug.marks()
    console.log({connections, zharr, fxStageHash})
  }
  debug.addStage = (fx, stageLetter) => fxStageHash[fx.zholger || 0] = stageLetter
          
  debug.addCon = (src, dst) => {
    conns.push({src, dst})
    const srcRes = getResOf(src)
    const dstRes = getResOf(dst)
    connections[srcRes] = connections[srcRes] || {type: auNStr(src)}
    connections[srcRes][dstRes] = true
    if (srcRes.beginS?.('Unknown') || dstRes.beginS?.('Unknown')) {
      console.warn(`AudioNode without resourceId:`, src, dst)
    }  
  }
  debug.addDisco = (src, dst) => {
    discos.push({src, dst})
    const srcRes = getResOf(src)
    if (srcRes) {
      const dstRes = dst && getResOf(dst)
      if (dstRes) {
        wassert(connections[srcRes][dstRes])
        delete connections[srcRes][dstRes]
      } else {
        connections[srcRes] = {type: auNStr(src)}
      }
    } else {
      console.warn(`AudioNode without resourceId:`, src, dst)
    }  
  }
  debug.markNode = (node, mark) => {
    if (node) {
      const res = getResOf(node)
      if (res) {
        resMap[res] = (resMap[res] || '') + '//' + mark
      } else {
        console.warn(`AudioNode without resourceId:`, node)
      }
    }
  }
  debug.addFx = fx => zharr.push(fx)
  
  //: if Audion is not active, we have to dummify our methods:
  
  !(!waCtx.destination.__resource_id__ || !debug.on) ||
    debug.propertiesToArr().map(key => isFun(debug[key]) && (debug[key] = nop))
    
  return debug
}
