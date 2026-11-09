/**
 * Whether a list can scroll to this position right now (09/11: «scrollToIndex out of range:
 * requested index 4 is out of 0 to 0» reached José from the chat). A jump looks its row up in
 * one render and fires in a later one, when the list may hold fewer rows: then it does nothing.
 */
export const indexInRange = (index: number, count: number): boolean => Number.isInteger(index) && index >= 0 && index < count;
