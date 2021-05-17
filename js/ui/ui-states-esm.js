/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, DragWithDOM} from '../improxy-esm.js'

const {wassert} = Corelib.Debug
const {div$} = DOMplusUltra
const {addDraggable, addDragTarget} = DragWithDOM

//8#49f -------------------------- States ui (Stage slots & projects) --------------------------

export const extendUi = ui => {
  const {root, pg} = ui

  const dragDroppedOnSlot = dstSlot => (data, mod) => {
    const [source, letter] = data.split('.')
    if (source === 'fromStage') {
      root.stateManager.onStageToSlotDrop({dstSlot, letter})
    } else if (source === 'fromSlot') {
      const srcSlot = parseInt(letter)
      root.stateManager.onSlotToSlotDrop({dstSlot, srcSlot})
    }
      ui.onStageSlotsToggled(true)
  }
  
  ui.onStageSlotsToggled = on => {
    void ui.stageSlots$?.remove()
    
    if (on) {
      const {slots} = root.stateManager
      wassert(slots.length)

      ui.stageSlots$ = div$(ui.stageSlotStrip$, {class: 'state-stageslots-frame'}, 
        div$({class: 'st-stageslots-inframe'}, [
          div$(),
          ...slots.map((state, slot) => {
            const fxs = state.fxarr?.map(fx => pg.getFxType(fx.fxName).name).join(' ◻️ ')
            return addDragTarget(addDraggable(div$({
              class: 'st-stageslot',
              html: `<em>${slot}</em>` + fxs,
              attr: {drid: slot}
            }), 'fromSlot.' + slot), dragDroppedOnSlot(slot))
          })
        ]))
    }
  }
  ui.onProjListToggled = on => {
    void ui.projMatrix$?.remove()
    
    if (on) {
      const projects = root.stateManager.getProjectListExtended()

      ui.projMatrix$ = div$(ui.projStrip$, {class: 'state-projlist-frame'}, 
        div$({class: 'st-projlist-inframe'}, [
          div$(),
          ...projects.map(({projName, projDesc, versions, lastSavedAt}) => {
            return div$({
              class: 'st-proj',
              html: [
                `<strong>${projDesc}</strong>`,
                `${projName} (${versions})`,
                `<em>${lastSavedAt}</em>`
              ].join(`<br>`),
              attr: {drid: projName},
              click: _ => pg.reloadWithProject(projName) //: shift -> no src (but reload kills it)
            })
          })
        ]))
    }
  }
}
