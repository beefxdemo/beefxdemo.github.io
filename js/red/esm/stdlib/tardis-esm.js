/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-return-assign, valid-typeof,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, object-property-newline, 
   block-spacing, comma-spacing, handle-callback-err, camelcase, standard/no-callback-literal,
   no-floating-decimal, no-void, quotes */

//: [Reduced]

let performanceNowObject = window.performance || Date

export const setPerformanceObject = perfObj => performanceNowObject = perfObj

//%General timing

export const NoW = _ => Date.now() //+BAAD Date.now()

export const pNow = _ => performanceNowObject.now()

export const flexTime = t => typeof t === 'string' && t.slice(-1) === 's' ? parseInt(t) * 1000 : t

export const since = ref => NoW() - ref//4ref is always absolute time, so flexTime is not valid!

export const pSince = ref => pNow() - ref//4ref is always absolute time, so flexTime is not valid!

export const until = ref => ref - NoW()

export const fromNow = delay => NoW() + flexTime(delay)

const refZero = NoW()

export const relNoW = _ => since(refZero)

//%Async timing

export const post = fun => Promise.resolve().then(fun)

export const schedule = delay => new Promise(resolve => setTimeout(_ => resolve(), flexTime(delay)))

export const adelay = delay  => new Promise(resolve => setTimeout(resolve, flexTime(delay)))

export const debounce = (callback, delay) => {
  let inDebounce
  return (...args) => {
    clearTimeout(inDebounce)
    inDebounce = setTimeout(_ => callback(...args), delay)
  }
}

export const startEndThrottle = (callback, limit) => {
  let pendingCall = false
  let waiting = false
  let lastArgs = null
  
  const tick = _ => {
    if (pendingCall) {
      waiting = true
      pendingCall = false
      callback(...lastArgs)
      schedule(limit).then(tick)
    } else {
      waiting = false
    }
  }
  
  return (...args) => {
    lastArgs = args
    pendingCall = true
    
    waiting || tick()
  }
}

export const createPerfTimer = (konf = {}) => {
  const timer = {
    arr: [],
    dur: {},
    points: [],
    konf: {
      fixDigits: 1,
      ...konf
    }
  }
  timer.start = konf => {
    timer.arr = [{label: 'start', at: pNow()}] 
    konf && (timer.konf.capture(konf))
  } 
  timer.mark = label => timer.arr.push({label, at: pNow()})
  timer.skip = _ => timer.mark('')
  timer.sum = konf => {
    pSince(timer.arr.slice(-1)[0].at) > 1 && timer.mark('rest')
    konf && (timer.konf.capture(konf))
    const sum = {
      points: [],
      dur: {}
    }
    let runningTime = 0
    for (const {label, at} of timer.arr) {
      if (!label) {
      } else if (label === 'start') {
      } else {
        sum.points.push({label, dur: (at - runningTime)})
      }
      runningTime = at  
    }
    sum.points.push({label: 'sum', dur: runningTime - timer.arr[0].at})
    for (const point of sum.points) {
      point.dur = point.dur.toFixed(timer.konf.fixDigits)
      sum.dur[point.label] = point.dur
    }
    sum.summary = sum.points.filter(({label}) => label !== 'sum')
      .map(({label, dur}) => `${label}=${dur}`).join(' + ')
    sum.summary += ` -> sum=${sum.dur.sum}`  
    return sum
  }
  timer.summary = _ => timer.sum().summary
  
  timer.limit = (limit, logFun, exec) => {
    const start = pNow()
    exec()
    const dur = pSince(start)
    dur > limit && logFun(dur.toFixed(timer.konf.fixDigits))
  }
  timer.start()
  return timer
}

export const pinky = (pinky => {
  pinky.promise = (str, fun) => new Promise((resolve, reject) => {
    pinky[str] = {resolve, reject}
    void fun?.(resolve, reject)
  })
  return pinky
})({})
