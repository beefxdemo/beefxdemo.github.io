/* eslint-env browser, node, worker */
/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, no-unused-vars, no-return-assign,
  valid-typeof, object-curly-spacing, no-trailing-spaces, indent, new-cap, object-property-newline,
  block-spacing, comma-spacing, handle-callback-err,  camelcase, standard/no-callback-literal,
  no-floating-decimal, no-void, quotes */

//: [Reduced]

export const globalThis = typeof window === 'object' 
  ? window
  : typeof global === 'object'
    ? global
    : typeof self === 'object' 
      ?  self : console.error(`No global scope found`)//:fix for sh** eslint
  
export const wassert = (assertion, fallback) => assertion || brexru(assertion) || fallback

wassert(globalThis)

export const weject = denied => denied && brexru(denied)

export const wejectNaN = num => weject(Number.isNaN(num)) || num

export const sfx = (assertion, ret, ...args) => assertion === 'skip'
  ? sfx(ret, ret, ...args)
  : assertion
    ? ret
    : brexru(console.log('sfx args:', ...args)) || ret

export const loxru = (proc, msg) => console.log((proc(), 'loxru proc called: ' + msg))

export const brexru = _ => {
  debugger
  return _
}

Error.stackTraceLimit = Infinity
