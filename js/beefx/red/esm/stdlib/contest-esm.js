/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */

import * as Corelib from './corelib-esm.js'

const {getRnd} = Corelib

export const CT = {
  fp: getRnd(1000, 9999),
  context: []
}

window.CTS = window.CTS || []
window.CTS.push(CT)

CT.ct = {
  ctx: str => {
    CT.context.push({str, state: {}})
  },
  ctxend: _ => {
    const {str, state} = CT.context.pop()
    console.log('conTeSt endContext', str, state)
  },
  eqeqeq: (str, exp1, exp2) => {
    const ctx = CT.context.slice(-1)[0]
    if (exp1 !== exp2) {
      ctx.state = {
        error: true,
        str, exp1, exp2
      }
    }
  },
  cond: (condition, fun) => {
    console.log({condition})
    condition && fun()
  },
  freq: cnt => getRnd(1, cnt) === 1,
  warn: (...args) => console.warn(...args)
}
