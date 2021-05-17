/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib} from '../beeproxy-esm.js'

const {Ø, clamp} = Corelib
    
//8#289 ----- IIR (Coefficienst for Chebyshev filters (cutOffFreq, poles, ripplePt, lo/hi) -----
    
// Getting the math functions out of Math: same speed (I benchmarked it), but less complex code.
 
const {abs, sin, cos, tan, pow, sqrt, log, exp, PI} = Math

// This algorithm is converted from the book (dspguide.com):
// The Scientist and Engineer's Guide to Digital Signal Processing By Steven W. Smith, Ph.D.
// (see end of file for the original BASIC code)

export const chebyDsp = (cutOffFreq, type, ripplePt, poles = 4) => {  // poles: 2..20
  ripplePt = clamp(ripplePt, .1, 29)
  cutOffFreq = clamp(cutOffFreq, 0, .5)
  const isHp = type === 'highpass'
  
  const a = Array(22).fill(0)
  const b = Array(22).fill(0)
  a[2] = 1
  b[2] = 1
  const ta = []
  const tb = []
  
  for (let pole = 1; pole <= poles / 2; pole++)  {
    // Calculate the pole location on the unit circle
    const fi = PI / (poles * 2) + (pole - 1) * PI / poles
    let rp = -cos(fi)
    let ip = sin(fi)
    // Warp from a circle to an ellipse
    const es = sqrt(pow((100 / (100 - ripplePt)), 2) - 1)
    const vx = (1 / poles) * log((1 / es) + sqrt(pow((1 / es), 2) + 1))
    let kx = (1 / poles) * log((1 / es) + sqrt(pow((1 / es), 2) - 1))
    kx = (exp(kx) + exp(-kx)) / 2
    rp = rp * ((exp(vx) - exp(-vx)) / 2) / kx
    ip = ip * ((exp(vx) + exp(-vx)) / 2) / kx
    //console.log({rp, ip, es, vx, kx})
    // s-domain to z-domain conversion
    const t = 2 * tan(.5)
    const w = 2 * PI * cutOffFreq
    const m = rp * rp + ip * ip
    const d = 4 - 4 * rp * t + m * t * t
    const x0 = t * t / d
    const x1 = 2 * t * t / d
    const x2 = t * t / d
    const y1 = (8 - 2 * m * t * t) / d
    const y2 = (-4 - 4 * rp * t - m * t * t) / d
    //console.log({t, w, m, d, x0, x1, x2, y1, y2})

    const k = isHp ? -cos(w / 2 + .5) / cos(w / 2 - .5) : sin(.5 - w / 2) / sin(.5 + w / 2)
    const kk = k * k
    const e = 1 + y1 * k - y2 * kk
    const a0 = (x0 - x1 * k  + x2 * kk) / e
    let a1 = (-2 * x0 * k + x1 + x1 * kk - 2 * x2 * k) / e
    const a2 = (x0 * kk - x1 * k + x2) / e
    let b1 = (2 * k + y1 + y1 * kk - 2 * y2 * k) / e
    const b2 = (-kk - y1 * k + y2) / e
    isHp && (a1 = -a1)
    isHp && (b1 = -b1)
    //console.log({e, kk, a0, a1, a2, b1, b2})
    
    for (let i = 0; i < 22; i++) { // Add coefficients to the cascade
      ta[i] = a[i]
      tb[i] = b[i]
    }
    for (let i = 2; i < 22; i++) {
      a[i] = a0 * ta[i] + a1 * ta[i - 1] + a2 * ta[i - 2]
      b[i] = tb[i] - b1 * tb[i - 1] - b2 * tb[i - 2]
    }
  }
  b[2] = 0  // Finish combining coefficients
    
  for (let i = 0; i < 20; i++) {
    a[i] = a[i + 2]
    b[i] = -b[i + 2]
  }
  let [sa, sb] = [0, 0] // NORMALIZE THE GAIN
  let signedOne = -1
  for (let i = 0; i < 20; i++) {
    signedOne = isHp ? signedOne * -1 : 1
    sa += a[i] * signedOne
    sb += b[i] * signedOne
  }
  const gain = sa / (1 - sb)
  for (let i = 0; i < 20; i++) {
    a[i] /= gain // The final recursion coefficients are in A[ ] and B[ ]
  }
  a[0] = 1
  //console.log({sa, sb, gain}, a, b)
  return {a, b}
}

// isFilterStable() is converted from Chromium source (C++):
//
// Determine if filter is stable based on the feedback coefficients.
// We compute the reflection coefficients for the filter.  If, at any
// point, the magnitude of the reflection coefficient is greater than
// or equal to 1, the filter is declared unstable.
//
// Let A(z) be the feedback polynomial given by
//   A[n](z) = 1 + a[1]/z + a[2]/z^2 + ... + a[n]/z^n
//
// The first reflection coefficient k[n] = a[n].  Then, recursively compute
//
//   A[n-1](z) = (A[n](z) - k[n]*A[n](1/z)/z^n)/(1-k[n]^2);
//
// stopping at A[1](z).  If at any point |k[n]| >= 1, the filter is unstable.

export const isFilterStable = feedbackArray => {
  const coef = [...feedbackArray]
  const order = coef.length - 1
  if (coef[0] !== 1) {// If necessary, normalize filter coefficients so that constant term is 1.
    for (let m = 1; m <= order; m++) {
      coef[m] /= coef[0]
    }
    coef[0] = 1
  }
  // Begin recursion, using a work array to hold intermediate results.
  const local = {
    coef,
    work: []
  }
  for (let n = order; n >= 1; --n) {
    const k = local.coef[n]

    if (abs(k) >= 1) {
      return false
    }
    // Note that A[n](1/z)/z^n is basically the coefficients of A[n] in reverse order.
    const factor = 1 - k * k
    for (let m = 0; m <= n; ++m) {
      local.work[m] = (local.coef[m] - k * local.coef[n - m]) / factor
    }
    const tmp = local.work
    local.work = local.coef
    local.coef = tmp
  }
  return true
}

/* Original Chebyshev algorithm from dspguide.com:

100 'CHEBYSHEV FILTER- RECURSION COEFFICIENT CALCULATION
110 '
120 'INITIALIZE VARIABLES
130 DIM A[22] 'holds the "a" coefficients upon program completion
140 DIM B[22] 'holds the "b" coefficients upon program completion
150 DIM TA[22] 'internal use for combining stages
160 DIM TB[22] 'internal use for combining stages
170 '
180 FOR I% = 0 TO 22
190 A[I%] = 0
200 B[I%] = 0
210 NEXT I%
220 '
230 A[2] = 1
240 B[2] = 1
250 PI = 3.14159265
260 'ENTER THE FOUR FILTER PARAMETERS
270 INPUT "Enter cutoff frequency (0 to .5): ", FC
280 INPUT "Enter 0 for LP, 1 for HP filter: ", LH
290 INPUT "Enter percent ripple (0 to 29): ", PR
300 INPUT "Enter number of poles (2,4,...20): ", NP
310 '
320 FOR P% = 1 TO NP/2 'LOOP FOR EACH POLE-PAIR
330 '
  340 GOSUB 1000 'The subroutine in TABLE 20-5
  350 '
  360 FOR I% = 0 TO 22 'Add coefficients to the cascade
  370 TA[I%] = A[I%]
  380 TB[I%] = B[I%]
  390 NEXT I%
  400 '
  410 FOR I% = 2 TO 22
  420 A[I%] = A0*TA[I%] + A1*TA[I%-1] + A2*TA[I%-2]
  430 B[I%] = TB[I%] - B1*TB[I%-1] - B2*TB[I%-2]
  440 NEXT I%
450 '
460 NEXT P%
470 '
480 B[2] = 0 'Finish combining coefficients
490 FOR I% = 0 TO 20
500 A[I%] = A[I%+2]
510 B[I%] = -B[I%+2]
520 NEXT I%
530 '
540 SA = 0 'NORMALIZE THE GAIN
550 SB = 0
560 FOR I% = 0 TO 20
570 IF LH = 0 THEN SA = SA + A[I%]
580 IF LH = 0 THEN SB = SB + B[I%]
590 IF LH = 1 THEN SA = SA + A[I%] * (-1)^I%
600 IF LH = 1 THEN SB = SB + B[I%] * (-1)^I%
610 NEXT I%
620 '
630 GAIN = SA / (1 - SB)
640 '
650 FOR I% = 0 TO 20
660 A[I%] = A[I%] / GAIN
670 NEXT I%
680 ' 'The final recursion coefficients are in A[ ] and B[ ]
690 END

1000 'THIS SUBROUTINE IS CALLED FROM TABLE 20-4, LINE 340
1010 '
1020 ' Variables entering subroutine: PI, FC, LH, PR, HP, P%
1030 ' Variables exiting subroutine: A0, A1, A2, B1, B2
1040 ' Variables used internally: RP, IP, ES, VX, KX, T, W, M, D, K,
1050 ' X0, X1, X2, Y1, Y2
1060 '
1070 ' 'Calculate the pole location on the unit circle
1080 RP = -COS(PI/(NP*2) + (P%-1) * PI/NP)
1090 IP = SIN(PI/(NP*2) + (P%-1) * PI/NP)
1100 '
1110 ' 'Warp from a circle to an ellipse
1120 IF PR = 0 THEN GOTO 1210
1130 ES = SQR( (100 / (100-PR))^2 -1 )
1140 VX = (1/NP) * LOG( (1/ES) + SQR( (1/ES^2) + 1) )
1150 KX = (1/NP) * LOG( (1/ES) + SQR( (1/ES^2) - 1) )
1160 KX = (EXP(KX) + EXP(-KX))/2
1170 RP = RP * ( (EXP(VX) - EXP(-VX) ) /2 ) / KX
1180 IP = IP * ( (EXP(VX) + EXP(-VX) ) /2 ) / KX
1190 '
1200 ' 's-domain to z-domain conversion
1210 T = 2 * TAN(1/2)
1220 W = 2*PI*FC
1230 M = RP^2 + IP^2
1240 D = 4 - 4*RP*T + M*T^2
1250 X0 = T^2/D
1260 X1 = 2*T^2/D
1270 X2 = T^2/D
1280 Y1 = (8 - 2*M*T^2)/D
1290 Y2 = (-4 - 4*RP*T - M*T^2)/D
1300 '
1310 ' 'LP TO LP, or LP TO HP transform
1320 IF LH = 1 THEN K = -COS(W/2 + 1/2) / COS(W/2 - 1/2)
1330 IF LH = 0 THEN K = SIN(1/2 - W/2) / SIN(1/2 + W/2)
1340 D = 1 + Y1*K - Y2*K^2
1350 A0 = (X0 - X1*K + X2*K^2)/D
1360 A1 = (-2*X0*K + X1 + X1*K^2 - 2*X2*K)/D
1370 A2 = (X0*K^2 - X1*K + X2)/D
1380 B1 = (2*K + Y1 + Y1*K^2 - 2*Y2*K)/D
1390 B2 = (-(K^2) - Y1*K + Y2)/D
1400 IF LH = 1 THEN A1 = -A1
1410 IF LH = 1 THEN B1 = -B1
1420 '
1430 RETURN
*/
