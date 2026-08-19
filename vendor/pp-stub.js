// A stub standing in for the `postprocessing` npm package, which
// n8ao.js imports statically for its N8AOPostPass variant. This
// project uses N8AOPass (three's own EffectComposer), so the pmndrs
// path never runs — the import just has to resolve.
export class Pass {}
