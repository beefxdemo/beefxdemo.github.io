/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import { Corelib, CT } from '../js/improxy-esm.js'

const {ct} = CT

CT.wobble = {}
  
CT.wobble.postModFilters = (fx, {int} = fx) => {
  ct.ctx('wobble.postModFilters')
  ct.eqeqeq('type1', int.filter.type, int.minModFilter.type)
  console.warn('POSTMODFILTERS')
  ct.ctxend()
}

CT.wobble.postFire = `//
  wassert(fire === 'fire')
  console.warn('POSTFIRE!')
  wassert(mode)
`//
