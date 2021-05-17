/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, space-unary-ops,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, no-unused-vars, object-curly-newline */

import {Corelib} from '../improxy-esm.js'

const {Ø, nop, clamp, createMaxCollector} = Corelib
const {createPerfTimer, startEndThrottle} = Corelib.Tardis
const {wassert, weject} = Corelib.Debug
const {max, min, round, pow, log: mathlog, log2, floor, LN2, LN10, abs} = Math

//: graphBase draws the commonly used (ie used by more than one fx) graphs.
//: Lots of custom graphs are rendered in the fx modules.
//: (It's a tough question where is the place of fx graph rendering.)
//: Other fxs use graphBase, but still add some extra drawings onto the graph (before or after).
//: Obviously this is not optimal, there should bee(!) a different rendering module
//: for each every graph type. But graphBase was born when we had only one graph 
//: and didn't plan more. -> Later

export const createGraphBase = waCtx => {
  const graphBase = {}
    
  graphBase.createGraph = (graphDesc, panelGraph) => { //: class, instance
    const graph = {}
    
    const logOn = false
    const clog = (...args) => logOn && console.log(...args)
    
    const {canvas$, width, height, fx} = panelGraph
    const halfWidth = width / 2
    const halfHeight = height / 2
    const cc = canvas$.getContext('2d')

    const {     //: these defaults can be overridden from graphDesc
      graphType,
      renderSet = {doClear: true, doGrid: true, doGraph: true},
      disableInThisFrame = _ => false,
      customRenderer = {},
      dbGridColor =  'hsla(200, 70%, 55%, 0.5)',
      dbGridColorLo = 'hsla(200, 70%, 55%, 0.3)',
      dbGridColorHi = 'hsla(200, 70%, 55%, 0.7)',
      dbTextColor = 'hsla(260, 68%, 82%, .75)',
      freqGridColor = 'hsla(200, 70%, 60%, .3)',
      hzTextColor = 'hsla(200, 68%, 82%, .75)',
      genCurveColor =  'hsl(120, 90%, 55%)',
      magCurveColor =  'hsl(120, 90%, 55%)',
      phaseCurveColor = 'hsl(180, 70%, 45%, .6)',
      freqMarginLeft = 0,
      freqMarginRight = 0,
      minFreqScaleGap = 36,
      maxDb = 60,  //  30    5
      minDb = -60, // -30  -60
      dbWidthFactor = 1,
      minMs = 0,
      maxMs = 3000, // compressor: 0..2750
      msOffsetFactor = 0
    } = graphDesc
    
    const dbScale = maxDb - minDb // 60, 65
    const pixPerDbX = width * dbWidthFactor / dbScale
    const pixPerDbY = height / dbScale
    
    const msScale = maxMs - minMs
    const pixPerMsX = halfWidth / msScale
    
    const realFreqWidth = width - freqMarginLeft - freqMarginRight
    const realFreqScaleX = realFreqWidth / width
    
    const scaleAndRoundFreqX = x => round(freqMarginLeft + x * realFreqScaleX)
    
    const dbToY = db => height - (db - minDb) * pixPerDbY
    const dbToX = db => (db - minDb) * pixPerDbX
    
    const msOffsetX = msOffsetFactor * width
    const msToX = ms => (ms - minMs) * pixPerMsX + msOffsetX

    //8#947 Canvas simplifiers

    const initCanvas = _ => {
      renderSet.doClear && cc.clearRect(0, 0, width, height)
      cc.font = '22px roboto condensed'
    }
    
    const setTextStyle = (fillStyle, textAlign) => {
      cc.fillStyle = fillStyle
      cc.textAlign = textAlign
    }
    const setLineStyle = (strokeStyle, lineWidth) => {
      cc.strokeStyle = strokeStyle
      cc.lineWidth = lineWidth
    }
    const canvasLine = (x1, y1, x2, y2) => {
      cc.moveTo(x1, y1)
      cc.lineTo(x2, y2)
    }
    const drawText = (text, fillStyle, textAlign, fontSize, x, y) => {
      x < 0 && (x += width)
      y < 0 && (y += height)
      cc.font = fontSize + ' roboto condensed'
      setTextStyle(fillStyle, textAlign)
      cc.fillText(text, x, y)
    }
    
    let prev = {}
      
    const drawDynLine = (x, y, col) => {//: canvas API is medieval
      cc.strokeStyle = col
      cc.beginPath() 
      if (x) {
        cc.moveTo(prev.x, prev.y)
        cc.lineTo(x, y) 
      }
      prev = {x, y}
      cc.stroke()
    }
    const drawLine = (x1, y1, x2, y2) => {
      cc.beginPath()
      cc.moveTo(x1, y1)
      cc.lineTo(x2, y2)
      cc.stroke()
    }
    const dbdbLine = (dbx1, dby1, dbx2, dby2) => {
      const x1 = dbToX(dbx1)
      const x2 = dbToX(dbx2)
      const y1 = dbToY(dby1)
      const y2 = dbToY(dby2)
      drawLine(x1, y1, x2, y2)
    }
    const dbdbQuadratic = (dbx1, dby1, dbcpx, dbcpy, dbx2, dby2) => {
      const x1 = dbToX(dbx1)
      const x2 = dbToX(dbx2)
      const cx = dbToX(dbcpx)
      const y1 = dbToY(dby1)
      const y2 = dbToY(dby2)
      const cy = dbToY(dbcpy)
      cc.beginPath()
      cc.moveTo(x1, y1)
      cc.quadraticCurveTo(cx, cy, x2, y2)
      cc.stroke()
    }
    const msdb = {x: 0, y: 0}
    const msdbLine = (msx1, dby1, msx2, dby2) => {
      msdb.x = msToX(msx1)
      msdb.y = dbToY(dby1)
      msdbLineTo(msx2, dby2)
    }
    const msdbLineTo = (msx2 = msdb.x, dby2 = msdb.y) => {
      const x1 = msdb.x
      const y1 = msdb.y
      const x2 = msToX(msx2)
      const y2 = dbToY(dby2)
      drawLine(x1, y1, x2, y2)
      msdb.x = x2
      msdb.y = y2
    }
    
    const ccext = {setTextStyle, setLineStyle, drawLine, drawText, width, height}
    
    //8#939 -------------- BeeFx-specific parts --------------
    
    const calibrateFreqScale = ({diynamic = 1} = {}) => {
      const freq = {diynamic}
      const nOctaves = 11
      const maxNyquistFreq = waCtx.sampleRate / 2 // 22050
      const minNyquistFreq = maxNyquistFreq / pow(2, nOctaves - 1)
      const nyquistRange = maxNyquistFreq / minNyquistFreq // this is constant if ..22050: 1024
      freq.capture({nOctaves, minNyquistFreq, maxNyquistFreq, nyquistRange})
      freq.i2Hz = i => maxNyquistFreq * pow(2, nOctaves * (pow(i / width, diynamic) - 1))
      freq.hzArr = new Float32Array(width + 1)
      freq.magResponse = new Float32Array(width + 1)
      freq.phaseResponse = new Float32Array(width + 1)
      freq.freq2X = new Int16Array(maxNyquistFreq)
      let freqIx = 0
     
      for (let i = 0; i <= width; i++) {
        const hz = freq.hzArr[i] = freq.i2Hz(i)
        while (freqIx < hz && freqIx < maxNyquistFreq) { //: reverse array
          freq.freq2X[freqIx++] = i
        }
      }
      return freq
    }
    
    const drawFreqGrid = freq => { //8#77b9 ----- draw octave grid -----
      const {nOctaves, i2Hz} = freq
      setTextStyle(hzTextColor, 'left')
      setLineStyle(freqGridColor, 4)
      cc.beginPath()
      const txty = 36
      let lastx = -100
      
      for (let octave = 0; octave <= nOctaves; octave++) {// Draw frequency scale
        const xx = octave * width / nOctaves
        const x = scaleAndRoundFreqX(xx)
        if (lastx + minFreqScaleGap > x) {
          continue
        }
        lastx = x
        canvasLine(x, txty, x, height - 1)
        
        const txtx = clamp(x - 2, 10, width - 18)
        const valueHerz = round(i2Hz(xx))
        const [value, unit] = valueHerz > 1000
          ? [round(valueHerz / 100) / 10, 'k']//was kHz but it won't fit on small rect
          : [valueHerz, '']//was Hz
          
        cc.save()
        cc.translate(txtx, txty)
        cc.rotate(-Math.PI / 4)
        cc.fillText(value + unit, 0, 0)
        cc.restore()
      }
      cc.stroke()
    }
    
    const drawDbGrid = ({doLeft = false, doRight = true, maxDbLimitY = 52} = {}) => {
      setTextStyle(dbTextColor, 'right')                      //8#96a ---- draw dB grid ----
      const minDb10 = round(minDb / 10) * 10
      
      for (let db = minDb10; db < maxDb - 10; db += 10) { 
        const y = round(dbToY(db))
        
        if (y < height - 6 && y > maxDbLimitY) {
          doLeft && cc.fillText(db + "dB", 54, y - 4)
          doRight && cc.fillText(db + "dB", width - 4, y - 4)
        }
        setLineStyle(db ? dbGridColorLo : dbGridColorHi, db ? 3 : 3)
        drawLine(0, y, width, y)
      }
    }
    
    const drawMagResponse = ({magResponse, curveColor}) => { //8#88e --- draw magResponse curve ---
      cc.lineWidth = 4.5
      for (let x = 0; x < width; ++x) {
        const magReX = magResponse[x]
        if (!Number.isNaN(magReX)) {
          const dbResponse = 20 * mathlog(magReX) / LN10
          const y = dbToY(dbResponse)
          drawDynLine(x, y, curveColor({fx, xpt: x / width}))
        }
      }
    }

    const drawPhaseResponse = ({phaseResponse}) => { //8#aae --- draw phaseResponse curve ---
      setLineStyle(phaseCurveColor, 4)
      cc.beginPath()
      for (let x = 0; x < width; ++x) {
        const phReX = phaseResponse[x]
        if (!Number.isNaN(phReX)) {
          const dbResponse = 20 * mathlog(phReX) / LN10
          const y = dbToY(dbResponse)
          x ? cc.lineTo(x, y) : cc.moveTo(x, y)
        }
      }
      cc.stroke()
    }
        
    const renderers = {}
      
    renderers.freq = _ => { //8#c08 ---------- Frequency graph renderer --------
      const {diynamic = 1, filter} = graphDesc
      const freq = calibrateFreqScale({diynamic})
      freq.curveColor = graphDesc.curveColor || (_ => magCurveColor)
      
      const render = _ => {
        initCanvas()
        void customRenderer.pre?.({fx, cc, ccext, freq})
        if (renderSet.doGrid) {
          drawFreqGrid(freq)
          drawDbGrid({doLeft: true, doRight: true})
        }
        graph.filter = fx.int[filter] //: have to reread here every time as filter can change!
        
        if (renderSet.doGraph && graph.filter) {
          graph.filter.getFrequencyResponse(freq.hzArr, freq.magResponse, freq.phaseResponse)
          drawPhaseResponse(freq)
          drawMagResponse(freq)
        }
        void customRenderer.post?.({fx, cc, ccext, freq})
      }
      return {render}    
    }
    
    renderers.sigmoid = _ => { //8#b08 ---------- Sigmoid graph renderer --------
      const render = _ => {
        initCanvas()

        if (renderSet.doGrid) {
          const alg = fx.int.lastAlgName
          cc.font = '32px roboto condensed'
          setTextStyle(dbTextColor, 'right')
          cc.fillText(alg, width - 8, height - 10)
          
          setLineStyle(dbGridColorHi, 4)
          drawLine(0, halfHeight, width, halfHeight)
          drawLine(halfWidth, 0, halfWidth, height)
    
          setLineStyle(dbGridColorLo, 3)
          drawLine(0, halfHeight * 3 / 2, width, halfHeight * 3 / 2)
          drawLine(0, halfHeight / 2, width, halfHeight / 2)
          drawLine(halfWidth * 3 / 2, 0, halfWidth * 3 / 2, height)
          drawLine(halfWidth / 2, 0, halfWidth / 2, height)        
        }
        if (renderSet.doGraph) {
          const size = fx.int.nSamples
          const data = fx.int.wsCurve
          const step = fx.int.graphDiv
          setLineStyle(genCurveColor, 4)
          cc.beginPath()
          for (let ix = 0; ix < size; ix += step) {
            const x = ix * width / size
            const y = halfHeight - halfHeight * data[ix]
            x ? cc.lineTo(x, y) : cc.moveTo(x, y)
          }
          cc.stroke()
        }
      }
      return {render}    
    }
    
    renderers.compressor = _ => { //8#a08 ---------- Compressor graph renderer --------
      const render = _ => {
        const {attack, release, ratio, threshold, knee, makeupGain} = fx.atm
        initCanvas()

        drawDbGrid({doLeft: true, doRight: true, maxDbLimitY: 32}) //: left side db/db grid
        setLineStyle(dbGridColorHi, 2)            //: right side ms/db grid
        msdbLine(0, minDb, 0, maxDb)
        msdbLine(1000, minDb, 1000, maxDb)
        msdbLine(2000, minDb, 2000, maxDb)
        setLineStyle(dbGridColorLo, 2)
        msdbLine(500, minDb, 500, maxDb)
        msdbLine(1500, minDb, 1500, maxDb)
        msdbLine(2500, minDb, 2500, maxDb)
        
        const refColor = 'hsl(200, 60%, 40%)'
        const thresholdColor = 'hsl(0, 75%, 50%)'
        const makeupColor = 'hsl(30, 80%, 50%)'
        const kneeCurveColor = 'hsl(60, 85%, 45%)'        
        const inColor = 'hsl(200, 60%, 40%)'
        const outBaseColor = 'hsl(30, 90%, 50%)'
        
        const topDb = 0
        const bottomDb = -40
        const startMs = -500
        const upMs = 250
        const downMs = 1500
        const thrDb = threshold
        
        setLineStyle(thresholdColor, 4)           //: threshold cross horizontal line
        msdbLine(-maxMs, thrDb, maxMs, thrDb)
            //dbdbLine(threshold, minDb, threshold, maxDb)
  
        setLineStyle(inColor, 12)                 //: right side timing diagram base
        msdbLine(startMs, bottomDb, upMs, bottomDb)
        msdbLineTo(upMs, topDb)
        msdbLineTo(downMs, topDb)
        msdbLineTo(downMs, bottomDb)
        msdbLineTo(maxMs, bottomDb)
        
        const mug = makeupGain                    //: right side timing diagram live signal
        setLineStyle(outBaseColor, 4)
        msdbLine(startMs, mug + bottomDb, upMs, mug + bottomDb)
        msdbLineTo(upMs, mug + topDb)
        msdbLineTo(upMs + attack, mug + thrDb + (topDb - thrDb) / ratio)
        msdbLineTo(downMs, mug + thrDb + (topDb - thrDb) / ratio) 
        msdbLineTo(downMs, mug + thrDb + (topDb - thrDb) / ratio - (topDb - bottomDb))
        msdbLineTo(downMs + release, mug + bottomDb)
        msdbLineTo(maxMs, mug + bottomDb)
  
        setLineStyle(refColor, 8)                 //: left side fix 45deg dB line
        dbdbLine(minDb, minDb, maxDb, maxDb)
  
        setLineStyle(thresholdColor, 4)           //: threshold cross vertical line
        dbdbLine(threshold, minDb, threshold, maxDb)
        
        const compx1 = threshold
        const compx2 = maxDb
        const compWi = compx2 - compx1
        const compy1 = threshold + makeupGain
        const compHi = compWi / ratio
        
        const kneeRight = min(maxDb + 3, compx1 + knee) - compx1
        const kneex1 = compx1 - knee
        const kneex2 = compx1 + kneeRight
        const kneey1 = compy1 - knee
        const kneey2 = compy1 + kneeRight / ratio
        
        setLineStyle(kneeCurveColor, 5)           //: left side live knee
        dbdbQuadratic(kneex1, kneey1, compx1, compy1, kneex2, kneey2)
  
        setLineStyle(makeupColor, 5)              //: left side live non-knee
        dbdbLine(minDb, minDb + makeupGain, kneex1, kneey1)
        dbdbLine(kneex2, kneey2, compx2, compy1 + compHi)
      }
      return {render}    
    }
    
    renderers.custom = _ => { //8#90a ---------- Custom graph renderer --------
      wassert(graphDesc.onInit)      
      graphDesc.onInit({cc, width, height, fx, ccext}) //: let the o'scope know the drawing context
      
      const render = _ => nop //: the rendering is in the caller module itself
      return {render}    
    }
    
    renderers.audioBuffer = _ => { //8#80c ---------- Audio sample (from buffer) renderer --------
      const bufferHost = fx.int[graphDesc.bufferHost]
      
      const render = _ => {
        const buffer = bufferHost.buffer
        if (!buffer) {
          return clog('no sample buffer')
        }
        const timer = createPerfTimer()
        const length = buffer.length
        const isMono = buffer.numberOfChannels === 1
        const samplePerPix = length / width
        
        const data0 = buffer.getChannelData(0)
        const data1 = isMono ? data0 : buffer.getChannelData(1)
  
        const sec = length / buffer.sampleRate
        //const randomizer04 = parseInt(fx.zholger) % 5
        const OVERSAMPLING = 8 // Math.pow(2, randomizer04) // 8
        const samplePerPixOver = samplePerPix / OVERSAMPLING
        const oversamp = []
        for (let x = 0; x < width * OVERSAMPLING; ++x) {
          const dataIx = ~~(x * samplePerPixOver)
          oversamp[x] = (data0[dataIx] + data1[dataIx]) / 2
        }
        oversamp[0] = 0 //: filtering glitches out
        timer.mark('oversampling')
        
        const bigminusarr = []
        const bigplusarr = []
        const avgarr = []
        
        for (let i = 0, oIndex = 0; i < width; ++i) {
          for (let o = 0; o < OVERSAMPLING; o++, oIndex++) {
            const oSample = oversamp[oIndex] 
            if (o === 0) {
              bigminusarr[i] = oSample
              bigplusarr[i] = oSample
              avgarr[i] = 0
            } else {
              if (oSample > 0) {
                bigplusarr[i] = max(bigplusarr[i], oSample)
              } else {
                bigminusarr[i] = min(bigminusarr[i], oSample)
              }
            }
            bigminusarr[i] = min(bigminusarr[i], 0)
            bigplusarr[i] = max(bigplusarr[i], 0)
            avgarr[i] += oSample
          }
          avgarr[i] /= OVERSAMPLING
        }

        const maxer = createMaxCollector(3)
        const mixer = createMaxCollector(3)
        let lastOver01 = 1
        for (let i = 0; i < width; i++) {
          maxer(bigplusarr[i])
          mixer(-bigminusarr[i])
          max(abs(bigplusarr[i]), abs(bigminusarr[i])) > .01 && (lastOver01 = i)
        }
        const maxPlus = maxer(0)[0]
        const minMinus = mixer(0)[0]
        const maxAbs = (abs(maxPlus) + abs(minMinus)) / 2
        const yScaleFactor = maxAbs < .25 ? 4 : maxAbs < .5 ? 2 : 1
        const yScale = halfHeight * yScaleFactor
        const xScale = clamp(width / (lastOver01 + 10), 1, 5)
        const pixPerSec = width / sec * xScale
        timer.mark('minmaxavg')
        
        clog('End', {pixPerSec, maxPlus, minMinus, maxAbs, lastOver01, xScale, yScale})
        const tab = []
        for (let i = 0, j = 0; i < width; i += 30, j++) {
          tab[j] = {
            bigplus: bigplusarr[i].toFixed(3),
            bigminus: bigminusarr[i].toFixed(3),
            avg: avgarr[i].toFixed(3)
          }
        }
        //console.table(tab)
        
        initCanvas()
        cc.font = '32px roboto condensed'
        
        if (pixPerSec > 10) {
          if (pixPerSec > 200) {
            setLineStyle(dbGridColor, 3)
            for (let x = 0; x < width; x += pixPerSec / 10) {
              drawLine(x, 0, x, height)
            }
          }
          setLineStyle(dbGridColorHi, 3)
          for (let x = 0; x < width; x += pixPerSec) {
            drawLine(x, 0, x, height)
          }
        }
        
        const audioBufferTextColor = 'hsl(50, 30%, 50%)'
        const ms = isMono ? 'Mono' : 'Stereo'
        const viewSec = round(sec / xScale * 1000) / 1000
        const fullSec = round(sec * 1000) / 1000
        
        setTextStyle(audioBufferTextColor, 'right')
        const txtx = width - 12
        cc.fillText(`zoomX: ${xScale.toFixed(1)}`, txtx, 40)
        cc.fillText(`zoomY: ${yScaleFactor}`, txtx, 80)
        cc.fillText(`overSampling: ${OVERSAMPLING}x`, txtx, height - 60)
        cc.fillText(`${viewSec}s of ${fullSec}s ${ms}`, txtx, height - 20)
        
        const audioBufferMaxColor = `hsl(100, 70%, 70%, .66)`
        const audioBufferAvgColor = `hsl(100, 99%, 90%, .99)`
        
        setLineStyle(audioBufferMaxColor, 3)
        cc.beginPath()
        for (let x = 0; x < width; ++x) {
          const ytop = bigplusarr[x] * yScale + halfHeight
          const ybottom = bigminusarr[x] * yScale + halfHeight
          const xx = xScale * x
          x ? cc.lineTo(xx, ytop) : cc.moveTo(xx, ytop)
          cc.lineTo(xx, ybottom)
        }
        cc.stroke()
        timer.mark('maxdraw')  
        
        setLineStyle(audioBufferAvgColor, 3)
        cc.beginPath()
        for (let x = 0; x < width; ++x) {
          const sample = avgarr[x]
          const y = sample * yScale + halfHeight
          const xx = xScale * x
          x ? cc.lineTo(xx, y) : cc.moveTo(xx, y)
        }
        cc.stroke()
        timer.mark('avgdraw')  
        clog(`sampleDraw`, timer.summary())
      }
      return {render}    
    }
      
    if (renderers[graphType]) {
      graph.renderer = renderers[graphType]()
    } else {
      console.warn('no renderer for graph!', graphType, graphDesc)
    }
    
    graph.render = (...pars) => { //: this is not throttled, be cautious when calling!
      if (graph.renderer) {
        if (!disableInThisFrame(fx)) {
          graph.renderer.render(...pars)
          graphDesc.postRender && graphDesc.postRender({fx, cc, ccext})
        }
      } else {
        console.warn(`no renderer!!!!!!!`, graph)
      }
    }
    return graph
  }
  
  return graphBase
}
