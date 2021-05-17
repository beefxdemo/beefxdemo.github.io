/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-trailing-spaces, comma-spacing,
   no-floating-decimal, no-extend-native, object-curly-spacing, object-property-newline,
   camelcase, valid-typeof, block-spacing, no-return-assign, no-void, quotes, indent */

//: [Reduced]

import * as DateHumanizer from './date-humanizer-esm.js'
import * as Debug from './debug-esm.js'
import * as Tardis from './tardis-esm.js'
import * as Types from './types-esm.js'

//8#fa6 Core library - What are the barks of the trees made of? 

const {isArr, isObj, isNum, isFun, isStr,  nObj} = Types
const {Ø, undef, yes, yeah, no, nooo} = Types
const {maxFract, safeParseJSON, safeStringifyJSON} = Types
const {floor, random, pow, round} = Math

export const merge = (f, a = f) => a

export const sanitize = obj => {
  for (const key in obj) {
    if (typeof obj[key] === Ø) {
      delete obj[key]
    }
  }
}

export const getRnd = (fr, to) => typeof to !== Ø
  ? floor(random() * (1 + to - fr)) + fr
  : Number.isNaN(fr) ? 0 : getRnd(0, fr)
  
export const getRndFloat = (fr, to) => typeof to !== Ø
  ? random() * (to - fr) + fr
  : Number.isNaN(fr) ? 0 : getRndFloat(0, fr)
  
export const getRndArrItem = arr => isArr(arr) ? arr[getRnd(0, arr.length - 1)] : undef

export const getRndDig = dig => getRnd(pow(10, dig - 1), pow(10, dig) - 1)

export const rndColor = a => `rgba(${getRnd(255)}, ${getRnd(255)}, ${getRnd(255)}, ${a || 1})`

export const hashOfString = (str, salt = '') => {
  str += salt
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = char + (hash << 5) + (hash << 9) - hash
    hash |= 0        
  }
  return hash < 0 ? -hash : hash
}  

export const ascii = a => a.charCodeAt(0)

export const getIncArray = (z, to, len = to - z + 1) => Array(len).fill(0).map((_, ix) => ix + z)
  
export const clamp = (num, min, max) => num <= min ? min : num >= max ? max : num

export const createMaxCollector = (maxMax = 5) => {
  const maxArr = new Array(maxMax).fill(-1)
  let maxLimit = -1

  return nuVal => {
    if (nuVal > maxLimit) {
      maxArr[0] = nuVal
      maxArr.sort((a, b) => a - b)
      maxLimit = maxArr[0]
    }
    return maxArr
  }
}

export const nop = _ => _
export const s_a = s => s ? s.split(',').map(a => a.trim()) : []

export const transformProps = (obj, trans = nop) => {
  const ret = {}
  for (const key in obj) {
    ret[key] = trans(obj[key])
  }
  return ret
}
export const fixRound = v => typeof v === 'number' ? round(v) : v
export const fix = n => v => typeof v === 'number' ? v.toFixed(n) : v
export const fix3 = v => fix(3)(v) // typeof v === 'number' ? v.toFixed(3) : v
export const fixObj = n => obj => transformProps(obj, fix(n))

export const pipe = (...fs) => async par => fs[0] ? pipe(...fs.slice(1))(await fs[0](par)) : par
export const pipeA = (fsa) => async par => fsa[0] ? pipeA(fsa.slice(1))(await fsa[0](par)) : par

export {
  Debug,
  Tardis,
  DateHumanizer,
  Types,
  maxFract, safeParseJSON, safeStringifyJSON,
//#Types:
  yes,
  yeah,
  no,
  nooo,
  Ø,
  undef, nObj, nObj as hashObj,
  isArr, isObj, isNum, isStr, isFun
}
