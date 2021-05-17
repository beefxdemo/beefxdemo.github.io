/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-return-assign, valid-typeof,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, object-property-newline,
   block-spacing, comma-spacing, handle-callback-err, camelcase, standard/no-callback-literal,
   no-floating-decimal, no-void, quotes */

//: [Reduced]

export const Ø = 'undefined'
export const undef = undefined
export const yes = true
export const yeah = true
export const no = false
export const nooo = false

export const isObj = o => typeof o === 'object' && o && typeof o.splice !== 'function' // not array
export const isArr = o => typeof o === 'object' && o && (typeof o.splice === 'function' || typeof o.fill === 'function' || Array.isArray(o))
export const isNum = n => typeof n === 'number' && !Number.isNaN(n)
export const isStr = s => typeof s === 'string'
export const isFun = f => typeof f === 'function'

export const extendInternalType = (entity, methodName, methodFunction) =>
  Object.defineProperty(entity.prototype, methodName, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: methodFunction
  })
const ET = extendInternalType

const String_begins = (str, begin) => !begin || (str && !str.indexOf(begin))
const String_ends = (str, end) => !end || (str && str.slice(-(end.length)) === end)
const String_isin = (str, lst) => lst.split(',').includes(str)
const String_wipe = (str, towipe) => str && str.split(towipe).join('')
const String_replace = (str, from, to) => str && str.split(from).join(to)
const String_line = (str, ix) => str && (str.split('\n')[ix] || '')//9lehet undef jobb?
const String_lefT = (str, n) => str && str.substr(0, n)
const String_righT = (str, n) => str && str.substr(-n)
const String_noncludes = (str, pat) => !str || !str.includes(pat)

ET(String, 'beginS', function (begin) { return String_begins(this, begin) })
ET(String, 'endS', function (end) { return String_ends(this, end) })
ET(String, 'isIn', function (lst) { return String_isin(this, lst) })
ET(String, 'wipE', function (towipe) { return String_wipe(this, towipe) })
ET(String, 'repL', function (from, to) { return String_replace(this, from, to) })
ET(String, 'linE', function (ix) { return String_line(this, ix) })
ET(String, 'lefT', function (n) { return String_lefT(this, n)})
ET(String, 'righT', function (n) { return String_righT(this, n)})
ET(String, 'lT', function (n) { return String_lefT(this, n)})
ET(String, 'rT', function (n) { return String_righT(this, n)})
ET(String, 'noncludes', function (pat) { return String_noncludes(this, pat)})

extendInternalType(Object, 'capture', function (extras) {
  if (isArr(this) && isArr(extras)) {
    this.push(...extras)
  } else if (isObj(this) && isObj(extras)) {
    for (const key in extras) {
      this[key] = extras[key]
    }
  } else {
    console.log('object.capture cannot mix arg types.', this, extras)
    debugger
  }
  return this
})
extendInternalType(Object, 'extract', function (essence) {
  if (isArr(this) && isArr(essence)) {
    return essence.map(index => this[index])
  } else if (isObj(this) && isStr(essence)) {
    const keyArr = essence.split(essence.includes(',') ? ',' : ' ')
    const reto = {}
    for (const key of keyArr) {
      reto[key] = this[key]
    }
    return reto
  } else {
    console.log('object.extract cannot mix arg types.', this, essence)
    debugger
  }
})

extendInternalType(Object, 'propertiesToArr', function (obj) { //: obj.loopValues(fun)
  obj = obj || this
  const ret = []
  if (isObj(obj)) {
    for (const prop in obj) {
      ret.push(prop)
    }
  }
  return ret
})

extendInternalType(Object, 'getPropertyCnt', function (par1, par2) { // (own | obj | obj, own)
  if (par1 === null) {
    return 0
  }
  const par1Obj = typeof par1 === 'object' && par1
  const obj = par1Obj ? par1 : this
  return Object.keys(obj).length 
})
